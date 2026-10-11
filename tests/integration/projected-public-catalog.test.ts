import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq, inArray } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import * as schema from "@/db/schema";
import {
  recalculateThemeProjectionUsing,
  captureProjectionContext,
} from "@/server/repositories/theme-projection-repository";
import { createAuthoritativePublicThemeRepository } from "@/server/repositories/authoritative-public-theme-repository";
import { createProjectedPublicThemeRepository } from "@/server/repositories/projected-public-theme-repository";
import { createAuthoritativePublicThemeService } from "@/server/services/public-theme-service";
import { classifyThemeState } from "@/domain/music/theme-state";
import { SOURCE_AVAILABILITY_POLICY } from "@/domain/music/source-availability";
const boundary = vi.hoisted(() => ({ database: vi.fn() }));
vi.mock("@/db", () => ({ getDatabase: boundary.database }));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/navigation", () => ({
  notFound() {
    throw new Error("GENERIC_NOT_FOUND");
  },
}));
import HomePage from "@/app/(public)/page";
import ThemePage from "@/app/(public)/tema/[slug]/page";
import { GET } from "@/app/api/themes/route";
const client = new PGlite();
const queries: string[] = [];
const database = drizzle(client, {
  schema,
  logger: {
    logQuery(query) {
      queries.push(query);
    },
  },
});
const now = new Date("2026-10-07T12:00:00.000Z");
const themeId = (i: number) =>
  `10000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
const songId = (i: number) =>
  `20000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
const cases = [
  {
    editorial: "draft" as const,
    fresh: 128,
    grace: 0,
    unavailable: 0,
    unknown: 0,
  },
  {
    editorial: "published" as const,
    fresh: 4,
    grace: 0,
    unavailable: 0,
    unknown: 0,
  },
  {
    editorial: "published" as const,
    fresh: 3,
    grace: 1,
    unavailable: 0,
    unknown: 0,
  },
  {
    editorial: "published" as const,
    fresh: 4,
    grace: 0,
    unavailable: 1,
    unknown: 1,
  },
  {
    editorial: "published" as const,
    fresh: 3,
    grace: 0,
    unavailable: 0,
    unknown: 1,
  },
  {
    editorial: "published" as const,
    fresh: 3,
    grace: 0,
    unavailable: 1,
    unknown: 0,
  },
  ...[31, 32, 63, 64].map((fresh) => ({
    editorial: "published" as const,
    fresh,
    grace: 0,
    unavailable: 0,
    unknown: 0,
  })),
];
const directRepo = createAuthoritativePublicThemeRepository(database);
const projectedRepo = createProjectedPublicThemeRepository(database);
function services(at = now) {
  return {
    direct: createAuthoritativePublicThemeService({
      ...directRepo,
      clock: () => at,
    }),
    projected: createAuthoritativePublicThemeService({
      ...projectedRepo,
      clock: () => at,
    }),
  };
}
beforeAll(async () => {
  await client.exec("create role anon; create role authenticated");
  const journal = JSON.parse(
    readFileSync("drizzle/meta/_journal.json", "utf8"),
  ) as { entries: { idx: number; tag: string }[] };
  for (const entry of journal.entries.filter(
    ({ idx }) => idx <= 6 || idx >= 10,
  ))
    await client.exec(readFileSync(`drizzle/${entry.tag}.sql`, "utf8"));
  let sourceIndex = 0;
  for (const [i, fixture] of cases.entries()) {
    await database.insert(schema.themes).values({
      id: themeId(i),
      name: `QA ${i}`,
      slug: `qa-${i}`,
      editorialState: fixture.editorial,
      isActive: fixture.editorial === "published",
    });
    for (const [state, count] of Object.entries({
      fresh: fixture.fresh,
      grace: fixture.grace,
      unavailable: fixture.unavailable,
      unknown: fixture.unknown,
    })) {
      for (let j = 0; j < count; j++) {
        const id = songId(sourceIndex++);
        await database.insert(schema.songs).values({
          id,
          provider: "youtube",
          providerContentId: `qa-${sourceIndex}`,
          sourceTitle: "QA",
          sourceChannel: "QA",
          thumbnailUrl: `/qa-${sourceIndex}.jpg`,
          durationSeconds: 180,
          isEmbeddable: false,
        });
        await database.insert(schema.themeSongs).values({
          themeId: themeId(i),
          songId: id,
          title: "QA",
          artist: "QA",
          previewDurationSeconds: 30,
          isActive: true,
          displayOrder: sourceIndex,
        });
        const confirmedAt = new Date(
          now.getTime() - (state === "grace" ? 7 * 86400000 + 1 : 0),
        );
        if (state !== "unknown")
          await database.insert(schema.sourceAvailabilityObservations).values({
            songId: id,
            region: "BR",
            confirmedState:
              state === "unavailable" ? "unavailable" : "available",
            confirmationReason:
              state === "unavailable" ? "not_found" : "available",
            observedAt: confirmedAt,
            lastAttemptAt: now,
            lastConfirmedAt: confirmedAt,
            validUntil:
              state === "unavailable"
                ? null
                : new Date(confirmedAt.getTime() + 7 * 86400000),
            graceUntil:
              state === "unavailable"
                ? null
                : new Date(confirmedAt.getTime() + 8 * 86400000),
            nextCheckAt: new Date(now.getTime() + 86400000),
            revision: 1,
            policyVersion: 1,
          });
      }
    }
    await database.transaction((tx) =>
      recalculateThemeProjectionUsing(
        tx,
        themeId(i),
        captureProjectionContext(now),
      ),
    );
  }
});
beforeEach(() => {
  boundary.database.mockReturnValue(database);
  vi.stubEnv("THEME_PROJECTION_WRITE_MODE", "enabled");
});
afterEach(() => vi.unstubAllEnvs());
afterAll(async () => client.close());

describe("contrato público direto/projetado", () => {
  it.each(cases.map((fixture, i) => ({ ...fixture, i })))(
    "igualdade campo a campo e classificação $i",
    async ({ i }) => {
      const { direct, projected } = services();
      expect(await projected.getTheme(`qa-${i}`)).toEqual(
        await direct.getTheme(`qa-${i}`),
      );
      const query = {
        now,
        policy: SOURCE_AVAILABILITY_POLICY,
        slug: `qa-${i}`,
      };
      expect(
        classifyThemeState((await projectedRepo.queryThemes(query))[0]),
      ).toEqual(classifyThemeState((await directRepo.queryThemes(query))[0]));
    },
  );
  it("listagem conserva janela/ordem e allowlist, sem N+1", async () => {
    const { direct, projected } = services();
    const expected = await direct.listPage();
    queries.length = 0;
    const actual = await projected.listPage();
    expect(actual).toEqual(expected);
    expect(queries).toHaveLength(1);
    expect(JSON.stringify(actual)).not.toMatch(
      /availableFresh|unknown|operationalState|policyVersion|calculatedAt|nextTransitionAt|songId/,
    );
  });
  it("projeção ausente usa fallback direto em conjunto, sem escrever ao ler", async () => {
    await database
      .delete(schema.themeStateProjections)
      .where(eq(schema.themeStateProjections.themeId, themeId(1)));
    try {
      const { direct, projected } = services();
      queries.length = 0;
      expect(await projected.listPage()).toEqual(await direct.listPage());
      expect(queries.filter((sql) => sql.startsWith("select"))).toHaveLength(3);
      expect(
        await database
          .select()
          .from(schema.themeStateProjections)
          .where(eq(schema.themeStateProjections.themeId, themeId(1))),
      ).toEqual([]);
    } finally {
      await database.transaction((tx) =>
        recalculateThemeProjectionUsing(
          tx,
          themeId(1),
          captureProjectionContext(now),
        ),
      );
    }
  });
  it("expiração recorre ao direto nas bordas fresh/grace/unknown", async () => {
    const [record] = await database
      .select()
      .from(schema.themeStateProjections)
      .where(eq(schema.themeStateProjections.themeId, themeId(1)));
    for (const delta of [
      7 * 86400000,
      7 * 86400000 + 1,
      8 * 86400000,
      8 * 86400000 + 1,
    ]) {
      const { direct, projected } = services(new Date(now.getTime() + delta));
      expect(await projected.getTheme("qa-1")).toEqual(
        await direct.getTheme("qa-1"),
      );
    }
    expect(
      (
        await database
          .select()
          .from(schema.themeStateProjections)
          .where(eq(schema.themeStateProjections.themeId, themeId(1)))
      )[0],
    ).toEqual(record);
  });
  it("rollback desliga projetor/leitura e continua no direto", async () => {
    vi.stubEnv("THEME_PROJECTION_WRITE_MODE", "disabled");
    const { direct, projected } = services();
    expect(await projected.listPage()).toEqual(await direct.listPage());
  });
  it("home/API/detalhe reais selecionam o adaptador só no QA opt-in", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("PUBLIC_CATALOG_READ_MODE", "authoritative_projected");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    try {
      const response = await GET(new Request("http://localhost/api/themes"));
      const payload = await response.json();
      expect(payload).toEqual({
        themes: await services().projected.listThemes(),
      });
      expect(
        await HomePage({ searchParams: Promise.resolve({}) }),
      ).toBeTruthy();
      expect(
        await ThemePage({ params: Promise.resolve({ slug: "qa-1" }) }),
      ).toBeTruthy();
      await expect(
        ThemePage({ params: Promise.resolve({ slug: "qa-0" }) }),
      ).rejects.toThrow("GENERIC_NOT_FOUND");
    } finally {
      vi.useRealTimers();
    }
  });
  it("201 Temas preservam paginação e buracos ocultos com fallback em lote", async () => {
    const ids = Array.from({ length: 201 }, (_, i) => themeId(1000 + i));
    await database.insert(schema.themes).values(
      ids.map((id, i) => ({
        id,
        name: "AA QA " + String(i).padStart(3, "0"),
        slug: "qa-page-" + i,
        editorialState: "published" as const,
        isActive: true,
      })),
    );
    const sourceIds = (
      await database
        .select({ songId: schema.themeSongs.songId })
        .from(schema.themeSongs)
        .where(eq(schema.themeSongs.themeId, themeId(1)))
    ).map((row) => row.songId);
    await database.insert(schema.themeSongs).values(
      ids.flatMap((id, i) =>
        sourceIds.slice(0, i === 0 ? 3 : 4).map((songId, index) => ({
          themeId: id,
          songId,
          title: "QA",
          artist: "QA",
          previewDurationSeconds: 30,
          displayOrder: index,
          isActive: true,
        })),
      ),
    );
    try {
      const { direct, projected } = services();
      const expected = await direct.listPage(1);
      queries.length = 0;
      const actual = await projected.listPage(1);
      expect(actual).toEqual(expected);
      expect(actual.nextPage).toBe(2);
      expect(actual.themes).toHaveLength(199);
      expect(actual.themes.some((theme) => theme.slug === "qa-page-200")).toBe(
        false,
      );
      expect(queries).toHaveLength(2);
      expect(await projected.listPage(2)).toEqual(await direct.listPage(2));
      expect((await projected.listPage(2)).themes[0].slug).toBe("qa-page-200");
      expect(
        await database
          .select()
          .from(schema.themeStateProjections)
          .where(inArray(schema.themeStateProjections.themeId, ids)),
      ).toEqual([]);
    } finally {
      await database
        .delete(schema.themes)
        .where(inArray(schema.themes.id, ids));
    }
  });
});
