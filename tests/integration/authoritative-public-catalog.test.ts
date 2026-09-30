import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq, and } from "drizzle-orm";
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
import { createAuthoritativePublicThemeRepository } from "@/server/repositories/authoritative-public-theme-repository";
import { createAuthoritativePublicThemeService } from "@/server/services/public-theme-service";
import {
  SOURCE_AVAILABILITY_POLICY,
  deriveEffectiveSourceAvailability,
} from "@/domain/music/source-availability";
import { getPublicThemes } from "@/server/services/public-theme-service";
import HomePage from "@/app/(public)/page";
import ThemePage, { generateMetadata } from "@/app/(public)/tema/[slug]/page";
import { GET } from "@/app/api/themes/route";

const boundaries = vi.hoisted(() => ({ getDatabase: vi.fn() }));
vi.mock("@/db", () => ({ getDatabase: boundaries.getDatabase }));
vi.mock("next/navigation", () => ({
  notFound() {
    throw new Error("GENERIC_NOT_FOUND");
  },
}));

vi.mock("next/server", () => ({ connection: async () => {} }));

const now = new Date("2026-01-08T00:00:00.000Z");
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
const id = (kind: number, index: number) =>
  `${kind}0000000-0000-4000-8000-${String(index).padStart(12, "0")}`;

async function addTheme(
  size: number,
  editorialState: "published" | "draft" = "published",
) {
  const themeId = id(1, size);
  await database.insert(schema.themes).values({
    id: themeId,
    name: `Tema ${size}`,
    slug: `tema-${size}`,
    editorialState,
    isActive: editorialState === "published",
  });
  await database.insert(schema.themeSongs).values(
    Array.from({ length: size }, (_, i) => ({
      themeId,
      songId: id(2, i + 1),
      title: "QA",
      artist: "QA",
      previewDurationSeconds: 30,
      displayOrder: i,
      isActive: true,
    })),
  );
}

beforeAll(async () => {
  await client.exec("create role anon; create role authenticated;");
  const journal = JSON.parse(
    readFileSync("drizzle/meta/_journal.json", "utf8"),
  ) as {
    entries: { idx: number; tag: string }[];
  };
  for (const entry of journal.entries.filter(
    ({ idx }) => idx <= 6 || idx >= 10,
  )) {
    await client.exec(readFileSync(`drizzle/${entry.tag}.sql`, "utf8"));
  }
  await database.insert(schema.songs).values(
    Array.from({ length: 128 }, (_, i) => ({
      id: id(2, i + 1),
      provider: "youtube" as const,
      providerContentId: `qa-${i}`,
      sourceTitle: "QA",
      sourceChannel: "QA",
      thumbnailUrl: `/qa-${i + 1}.jpg`,
      durationSeconds: 180,
      isEmbeddable: false,
    })),
  );
  await database.insert(schema.sourceAvailabilityObservations).values(
    Array.from({ length: 128 }, (_, i) => ({
      songId: id(2, i + 1),
      region: "BR",
      confirmedState: "available" as const,
      confirmationReason: "available" as const,
      observedAt: new Date("2026-01-01Z"),
      lastAttemptAt: new Date("2026-01-01Z"),
      lastConfirmedAt: new Date("2026-01-01Z"),
      validUntil: now,
      graceUntil: new Date("2026-01-09Z"),
      nextCheckAt: now,
      policyVersion: 1,
      revision: 1,
    })),
  );
  await addTheme(3);
  await addTheme(4);
});
afterAll(async () => {
  await client.close();
});
beforeEach(async () => {
  await client.exec("begin");
  queries.length = 0;
  boundaries.getDatabase.mockReturnValue(database);
});
afterEach(async () => {
  await client.exec("rollback");
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("catálogo autoritativo BR", () => {
  it("lê sem provider ou escrita e tolera falha de métricas", async () => {
    const fetch = vi.fn(() => {
      throw new Error("Provider I/O proibido");
    });
    vi.stubGlobal("fetch", fetch);
    const service = createAuthoritativePublicThemeService({
      ...createAuthoritativePublicThemeRepository(database),
      clock: () => now,
      metrics: {
        record() {
          throw new Error("Exporter indisponível");
        },
      },
    });
    queries.length = 0;
    const theme = await service.getTheme("tema-4");
    expect(theme?.activeSongCount).toBe(4);
    expect(Object.keys(theme ?? {}).sort()).toEqual([
      "activeSongCount",
      "coverUrl",
      "description",
      "id",
      "modeGroups",
      "name",
      "slug",
      "supportedBracketSizes",
      "thumbnailUrls",
    ]);
    expect(fetch).not.toHaveBeenCalled();
    expect(queries).toHaveLength(1);
    expect(queries[0]).toMatch(/^select /i);
  });

  it("ordena thumbnails por ordem editorial, criação e identidade, ignorando inativas e outra região", async () => {
    await addTheme(8);
    const entries = schema.themeSongs;
    await database
      .update(entries)
      .set({ displayOrder: 1, createdAt: new Date("2026-01-01T00:00:00Z") })
      .where(eq(entries.themeId, id(1, 8)));
    await database
      .update(entries)
      .set({ isActive: false })
      .where(and(eq(entries.themeId, id(1, 8)), eq(entries.songId, id(2, 1))));
    await database
      .update(entries)
      .set({ displayOrder: 0 })
      .where(and(eq(entries.themeId, id(1, 8)), eq(entries.songId, id(2, 8))));
    await database
      .update(entries)
      .set({ createdAt: new Date("2025-01-01T00:00:00Z") })
      .where(and(eq(entries.themeId, id(1, 8)), eq(entries.songId, id(2, 7))));
    await database.insert(schema.sourceAvailabilityObservations).values({
      songId: id(2, 2),
      region: "US",
      confirmedState: "unknown",
      observedAt: now,
      lastAttemptAt: now,
      nextCheckAt: now,
    });
    const service = createAuthoritativePublicThemeService({
      ...createAuthoritativePublicThemeRepository(database),
      clock: () => now,
    });
    expect(await service.getTheme("tema-8")).toMatchObject({
      activeSongCount: 7,
      thumbnailUrls: ["/qa-8.jpg", "/qa-7.jpg", "/qa-2.jpg", "/qa-3.jpg"],
    });
  });

  it("não cria um fim artificial na página 9999 e rejeita paginação inválida antes do DB", async () => {
    vi.stubEnv("PUBLIC_CATALOG_READ_MODE", "authoritative_direct");
    vi.stubEnv("VERCEL_ENV", "preview");
    const response = await GET(
      new Request("http://localhost/api/themes?page=10000"),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ themes: [] });
    for (const page of [
      "0",
      "-1",
      "1.5",
      "1e3",
      "NaN",
      "99999999999999999999",
    ]) {
      queries.length = 0;
      const invalid = await GET(
        new Request(`http://localhost/api/themes?page=${page}`),
      );
      expect(invalid.status).toBe(400);
      expect(queries).toEqual([]);
    }
  });

  it("mantém legado em produção não Vercel mesmo com configuração autoritativa acidental", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", undefined);
    vi.stubEnv("PUBLIC_CATALOG_READ_MODE", "authoritative_direct");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    expect(await getPublicThemes()).toEqual([]);
  });

  it("oferece a próxima página quando 200 publicados suspensos precedem um Tema saudável", async () => {
    await database.insert(schema.themes).values(
      Array.from({ length: 200 }, (_, i) => ({
        id: id(1, 1000 + i),
        name: `A suspenso ${i}`,
        slug: `suspenso-${i}`,
        editorialState: "published" as const,
        isActive: true,
      })),
    );
    const service = createAuthoritativePublicThemeService({
      ...createAuthoritativePublicThemeRepository(database),
      clock: () => now,
    });
    expect(await service.listPage()).toEqual({ themes: [], nextPage: 2 });
    const next = await service.listPage(2);
    expect(next.themes.map((theme) => theme.slug)).toEqual(["tema-4"]);
    expect(next.nextPage).toBeNull();
    expect(await service.getTheme("tema-4")).toEqual(next.themes[0]);
    vi.stubEnv("PUBLIC_CATALOG_READ_MODE", "authoritative_direct");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    expect(await (await GET()).json()).toEqual({ themes: [], nextPage: 2 });
    expect((await HomePage()).props.nextPage).toBe(2);
    expect(
      await (
        await GET(
          new Request(
            "http://localhost/api/themes?page=2&mode=legacy_guardrail&region=US&now=2030-01-01",
          ),
        )
      ).json(),
    ).toEqual({ themes: next.themes });
    expect(
      (await HomePage({ searchParams: Promise.resolve({ page: "2" }) })).props
        .themes,
    ).toEqual(next.themes);
  });

  it("home, API e slug usam leitura autoritativa apenas por configuração do servidor", async () => {
    vi.stubEnv("PUBLIC_CATALOG_READ_MODE", "authoritative_direct");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    const listed = await getPublicThemes();
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      slug: "tema-4",
      activeSongCount: 4,
      supportedBracketSizes: [4],
    });
    const home = await HomePage();
    expect(home.props.themes).toEqual(listed);
    const response = await GET();
    expect(await response.json()).toEqual({ themes: listed });
    expect(
      await generateMetadata({ params: Promise.resolve({ slug: "tema-4" }) }),
    ).toEqual({ title: "Tema 4", description: null });
    expect(
      await ThemePage({ params: Promise.resolve({ slug: "tema-4" }) }),
    ).toBeDefined();
    for (const slug of ["tema-3", "inexistente"]) {
      await expect(
        ThemePage({ params: Promise.resolve({ slug }) }),
      ).rejects.toThrow("GENERIC_NOT_FOUND");
      expect(
        await generateMetadata({ params: Promise.resolve({ slug }) }),
      ).toEqual({ title: "Tema não encontrado" });
    }
    // In production, even an accidental server-side opt-in cannot cut over CAT05.
    vi.stubEnv("VERCEL_ENV", "production");
    expect(await getPublicThemes()).toEqual([]);
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("PUBLIC_CATALOG_READ_MODE", "");
    expect(await getPublicThemes()).toEqual([]);
  });

  it("limita a leitura a 200 Temas mais sentinela e usa uma consulta mesmo com Fonte compartilhada", async () => {
    await database.insert(schema.themes).values(
      Array.from({ length: 205 }, (_, i) => ({
        id: id(1, 1000 + i),
        name: `Catálogo ${String(i).padStart(3, "0")}`,
        slug: `catalogo-${i}`,
        editorialState: "published" as const,
        isActive: true,
      })),
    );
    await database.insert(schema.themeSongs).values(
      Array.from({ length: 205 }, (_, i) =>
        [1, 2, 3, 4].map((index) => ({
          themeId: id(1, 1000 + i),
          songId: id(2, index),
          title: "QA",
          artist: "QA",
          previewDurationSeconds: 30,
          displayOrder: index,
        })),
      ).flat(),
    );
    queries.length = 0;
    const rows = await createAuthoritativePublicThemeRepository(
      database,
    ).queryThemes({ now, policy: SOURCE_AVAILABILITY_POLICY });
    expect(rows).toHaveLength(201);
    expect(queries).toHaveLength(1);
    expect(rows[199].slug).toBe("catalogo-199");
    expect(rows.every((row) => row.counts.availableFresh === 4)).toBe(true);
  });

  it("oculta três e apresenta quatro Entradas jogáveis sem depender de isEmbeddable", async () => {
    const service = createAuthoritativePublicThemeService({
      ...createAuthoritativePublicThemeRepository(database),
      clock: () => now,
    });
    expect(await service.listThemes()).toEqual([
      {
        id: id(1, 4),
        name: "Tema 4",
        slug: "tema-4",
        description: null,
        coverUrl: null,
        thumbnailUrls: ["/qa-1.jpg", "/qa-2.jpg", "/qa-3.jpg", "/qa-4.jpg"],
        activeSongCount: 4,
        supportedBracketSizes: [4],
        modeGroups: { primary: [], quick: [4], extended: [] },
      },
    ]);
    expect(await service.getTheme("tema-3")).toBeNull();
    expect(await service.getTheme("tema-4")).toEqual(
      (await service.listThemes())[0],
    );
  });

  it("grace conta e registra degradação agregada; unavailable, unknown, expirada e outra região não contam", async () => {
    await addTheme(8);
    const observations = schema.sourceAvailabilityObservations;
    const patch = (
      index: number,
      value: Partial<typeof observations.$inferInsert>,
    ) =>
      database
        .update(observations)
        .set(value)
        .where(eq(observations.songId, id(2, index)));
    await patch(1, {
      validUntil: new Date(now.getTime() - 1),
      graceUntil: now,
    });
    await patch(2, {
      confirmedState: "unavailable",
      confirmationReason: "region_blocked",
      validUntil: null,
      graceUntil: null,
    });
    await patch(3, {
      confirmedState: "unknown",
      confirmationReason: null,
      lastConfirmedAt: null,
      validUntil: null,
      graceUntil: null,
    });
    await patch(7, {
      validUntil: new Date(now.getTime() - 2),
      graceUntil: new Date(now.getTime() - 1),
    });
    await patch(8, { region: "US" });
    const events: unknown[] = [];
    const service = createAuthoritativePublicThemeService({
      ...createAuthoritativePublicThemeRepository(database),
      clock: () => now,
      metrics: {
        record(event) {
          events.push(event);
        },
      },
    });
    expect(await service.getTheme("tema-8")).toEqual({
      id: id(1, 8),
      name: "Tema 8",
      slug: "tema-8",
      description: null,
      coverUrl: null,
      activeSongCount: 4,
      supportedBracketSizes: [4],
      modeGroups: { primary: [], quick: [4], extended: [] },
      thumbnailUrls: ["/qa-1.jpg", "/qa-4.jpg", "/qa-5.jpg", "/qa-6.jpg"],
    });
    expect(events).toEqual([
      {
        metric: "public_catalog_read",
        mode: "authoritative_direct",
        policyVersion: 1,
        durationMs: expect.any(Number),
        examinedThemes: 1,
        visibleThemes: 1,
        states: {
          editorial_draft: 0,
          healthy: 0,
          degraded: 1,
          suspended_pending_verification: 0,
          suspended_insufficient_healthy_entries: 0,
        },
      },
    ]);
    await database
      .update(schema.themeSongs)
      .set({ isActive: false })
      .where(
        and(
          eq(schema.themeSongs.themeId, id(1, 8)),
          eq(schema.themeSongs.songId, id(2, 6)),
        ),
      );
    expect(await service.getTheme("tema-8")).toBeNull();
  });

  it.each([
    [31, [4, 8, 16]],
    [32, [4, 8, 16, 32]],
    [63, [4, 8, 16, 32]],
    [64, [4, 8, 16, 32, 64]],
  ] as const)(
    "listagem e slug mantêm modalidades no limite %i",
    async (size, modes) => {
      await addTheme(size);
      const service = createAuthoritativePublicThemeService({
        ...createAuthoritativePublicThemeRepository(database),
        clock: () => now,
      });
      const detail = await service.getTheme(`tema-${size}`);
      expect(detail).toMatchObject({
        activeSongCount: size,
        supportedBracketSizes: [...modes],
      });
      expect(
        (await service.listThemes()).find(
          (theme) => theme.slug === `tema-${size}`,
        ),
      ).toEqual(detail);
    },
  );

  it("expõe grupos de apresentação do classificador e os entrega à página, sem estado interno", async () => {
    await addTheme(128);
    vi.stubEnv("PUBLIC_CATALOG_READ_MODE", "authoritative_direct");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    const service = createAuthoritativePublicThemeService({
      ...createAuthoritativePublicThemeRepository(database),
      clock: () => now,
    });
    expect(await service.getTheme("tema-128")).toMatchObject({
      modeGroups: { primary: [32, 64], quick: [4, 8, 16], extended: [128] },
    });
  });

  it("draft com 128 e slug inexistente são igualmente ocultos; projeção adulterada é irrelevante", async () => {
    await addTheme(128, "draft");
    const service = createAuthoritativePublicThemeService({
      ...createAuthoritativePublicThemeRepository(database),
      clock: () => now,
    });
    const before = await service.listThemes();
    expect(before.map((theme) => theme.slug)).toEqual(["tema-4"]);
    expect(await service.getTheme("tema-128")).toBeNull();
    expect(await service.getTheme("inexistente")).toBeNull();
    await client.exec(
      "create table theme_projection (theme_id uuid, playable_count integer, visibility text); insert into theme_projection values ('10000000-0000-4000-8000-000000000128', 100000, 'visible');",
    );
    expect(await service.listThemes()).toEqual(before);
  });

  it("consulta e política CAT03 concordam nos milissegundos de validade e tolerância, com clock único", async () => {
    const [observation] = await database
      .select()
      .from(schema.sourceAvailabilityObservations)
      .where(eq(schema.sourceAvailabilityObservations.songId, id(2, 1)));
    const repository = createAuthoritativePublicThemeRepository(database);
    for (const instant of [
      "2026-01-07T23:59:59.999Z",
      "2026-01-08T00:00:00.000Z",
      "2026-01-08T00:00:00.001Z",
      "2026-01-09T00:00:00.000Z",
      "2026-01-09T00:00:00.001Z",
    ]) {
      const point = new Date(instant);
      const clock = vi.fn(() => point);
      const service = createAuthoritativePublicThemeService({
        ...repository,
        clock,
      });
      const detail = await service.getTheme("tema-4");
      expect(Boolean(detail)).toBe(
        deriveEffectiveSourceAvailability(observation, point).playable,
      );
      expect(clock).toHaveBeenCalledTimes(1);
    }
  });
});
