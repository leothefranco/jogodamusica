import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
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
import { withThemeContentLock } from "@/server/repositories/theme-content-repository";
const boundary = vi.hoisted(() => ({ database: vi.fn() }));
vi.mock("@/db", () => ({ getDatabase: boundary.database }));
const client = new PGlite();
const database = drizzle(client, { schema });
const themeId = "10000000-0000-4000-8000-000000000071";
const songId = (i: number) =>
  `20000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
const now = new Date("2026-10-07T12:00:00.000Z");
const context = () => captureProjectionContext(now);
async function seed(size = 64) {
  await database
    .insert(schema.themes)
    .values({
      id: themeId,
      name: "QA",
      slug: "qa-projection",
      editorialState: "published",
      isActive: true,
    });
  await database
    .insert(schema.songs)
    .values(
      Array.from({ length: size }, (_, i) => ({
        id: songId(i),
        provider: "youtube" as const,
        providerContentId: `qa-${i}`,
        sourceTitle: "QA",
        sourceChannel: "QA",
        thumbnailUrl: `/qa-${i}.jpg`,
        durationSeconds: 180,
        isEmbeddable: false,
      })),
    );
  await database
    .insert(schema.themeSongs)
    .values(
      Array.from({ length: size }, (_, i) => ({
        themeId,
        songId: songId(i),
        title: "QA",
        artist: "QA",
        previewDurationSeconds: 30,
        isActive: true,
        displayOrder: i,
      })),
    );
  await database
    .insert(schema.sourceAvailabilityObservations)
    .values(
      Array.from({ length: size }, (_, i) => ({
        songId: songId(i),
        region: "BR",
        confirmedState: "available" as const,
        confirmationReason: "available" as const,
        observedAt: now,
        lastAttemptAt: now,
        lastConfirmedAt: now,
        validUntil: new Date(now.getTime() + 7 * 86400000),
        graceUntil: new Date(now.getTime() + 8 * 86400000),
        nextCheckAt: new Date(now.getTime() + 7 * 86400000),
        revision: 1,
        policyVersion: 1,
      })),
    );
}
const projection = async () =>
  (await database.select().from(schema.themeStateProjections))[0];

beforeAll(async () => {
  await client.exec("create role anon; create role authenticated;");
  const journal = JSON.parse(
    readFileSync("drizzle/meta/_journal.json", "utf8"),
  ) as { entries: { idx: number; tag: string }[] };
  for (const entry of journal.entries.filter(
    ({ idx }) => idx <= 6 || idx >= 10,
  ))
    await client.exec(readFileSync(`drizzle/${entry.tag}.sql`, "utf8"));
});
beforeEach(async () => {
  await client.exec("truncate themes, songs cascade");
  boundary.database.mockReturnValue(database);
  vi.stubEnv("THEME_PROJECTION_WRITE_MODE", "enabled");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
afterAll(async () => {
  await client.close();
});

describe("projeção no mesmo commit editorial", () => {
  it("cria e repete sem alterar calculated_at ou valores persistidos", async () => {
    await seed(4);
    const first = await database.transaction((tx) =>
      recalculateThemeProjectionUsing(tx, themeId, context()),
    );
    expect(first.status).toBe("created");
    const before = await projection();
    const next = await database.transaction((tx) =>
      recalculateThemeProjectionUsing(
        tx,
        themeId,
        captureProjectionContext(new Date(now.getTime() + 1000)),
      ),
    );
    expect(next.status).toBe("unchanged");
    expect(next.changedFields).toEqual([]);
    expect(await projection()).toEqual(before);
  });
  it.each([
    [64, 64],
    [32, 32],
  ])(
    "retirada editorial em %s atualiza projeção e remove somente modo %s",
    async (size, lost) => {
      await seed(size);
      await database.transaction((tx) =>
        recalculateThemeProjectionUsing(tx, themeId, context()),
      );
      const before = await projection();
      await withThemeContentLock(themeId, (repo) =>
        repo.removeThemeSongRecord(songId(0)),
      );
      const after = await projection();
      expect(after.playableCount).toBe(size - 1);
      expect(after.supportedModes).toEqual(
        before.supportedModes.filter((mode) => mode !== lost),
      );
      expect(after.editorialState).toBe("published");
    },
  );
  it("falha de projeção faz rollback também da retirada editorial", async () => {
    await seed(4);
    await database.transaction((tx) =>
      recalculateThemeProjectionUsing(tx, themeId, context()),
    );
    const before = await projection();
    await client.exec(
      "alter table theme_state_projections add constraint qa_reject_three check (playable_count <> 3) not valid",
    );
    try {
      await expect(
        withThemeContentLock(themeId, (repo) =>
          repo.removeThemeSongRecord(songId(0)),
        ),
      ).rejects.toThrow();
      expect(await projection()).toEqual(before);
      expect(await database.select().from(schema.themeSongs)).toHaveLength(4);
    } finally {
      await client.exec(
        "alter table theme_state_projections drop constraint qa_reject_three",
      );
    }
  });
  it("rebuild corrige drift com nomes de campos controlados", async () => {
    await seed(4);
    await database.transaction((tx) =>
      recalculateThemeProjectionUsing(tx, themeId, context()),
    );
    await database
      .update(schema.themeStateProjections)
      .set({ ruleVersion: 99, thumbnailUrls: ["/drift.jpg"] })
      .where(eq(schema.themeStateProjections.themeId, themeId));
    const rebuilt = await database.transaction((tx) =>
      recalculateThemeProjectionUsing(tx, themeId, context(), "rebuild"),
    );
    expect(rebuilt.status).toBe("corrected");
    expect(rebuilt.changedFields).toEqual(["ruleVersion", "thumbnailUrls"]);
    expect(rebuilt.metric.driftCorrected).toBe(true);
    expect(rebuilt.metric).not.toHaveProperty("themeId");
    expect((await projection()).ruleVersion).toBe(1);
  });
});
