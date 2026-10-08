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
  withThemeCoverUrlLock,
  insertTheme,
  setThemeActiveRecord,
  updateThemeRecord,
  importPlaylistTracks,
  updateThemeSongAssociation,
  upsertSongAndAssociation,
  removeThemeSongRecord,
} from "@/server/repositories/theme-content-repository";
import {
  recalculateThemeProjectionUsing,
  captureProjectionContext,
} from "@/server/repositories/theme-projection-repository";
import { persistSourceAvailabilityObservation } from "@/server/repositories/source-availability-repository";
import { applySourceAvailabilityResult } from "@/domain/music/source-availability";
import { rebuildThemeProjectionRecord } from "@/server/services/theme-projection-service";
import { postgresRowsAdapter } from "../support/postgres-rows-adapter";
const boundary = vi.hoisted(() => ({ database: vi.fn() }));
vi.mock("@/db", () => ({ getDatabase: boundary.database }));
vi.mock("@/server/auth/session", () => ({ requireAdmin: vi.fn() }));
const client = new PGlite();
const database = drizzle(client, { schema });
const themeId = "10000000-0000-4000-8000-000000000071",
  actorId = "30000000-0000-4000-8000-000000000071";
const songId = (i: number) =>
  `20000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
const now = new Date("2026-10-07T12:00:00.000Z");
const projection = async () =>
  (
    await database
      .select()
      .from(schema.themeStateProjections)
      .where(eq(schema.themeStateProjections.themeId, themeId))
  )[0];
const unavailable = () =>
  persistSourceAvailabilityObservation({
    contextThemeId: themeId,
    providerContentId: "qa-0",
    track: null,
    observation: applySourceAvailabilityResult({
      current: null,
      observedAt: new Date(now.getTime() + 1),
      result: { type: "unavailable", reason: "not_found", track: null },
    }),
  });
async function seed() {
  await database.insert(schema.themes).values({
    id: themeId,
    name: "QA",
    slug: "qa",
    editorialState: "published",
    isActive: true,
  });
  await database.insert(schema.songs).values(
    Array.from({ length: 4 }, (_, i) => ({
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
  await database.insert(schema.themeSongs).values(
    Array.from({ length: 4 }, (_, i) => ({
      themeId,
      songId: songId(i),
      title: "QA",
      artist: "QA",
      previewDurationSeconds: 30,
      isActive: true,
      displayOrder: i,
    })),
  );
  await database.insert(schema.sourceAvailabilityObservations).values(
    Array.from({ length: 4 }, (_, i) => ({
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
  await database.transaction((tx) =>
    recalculateThemeProjectionUsing(tx, themeId, captureProjectionContext(now)),
  );
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
});
beforeEach(async () => {
  await client.exec("truncate themes, songs, admin_profiles cascade");
  boundary.database.mockReturnValue(postgresRowsAdapter(database));
  vi.stubEnv("THEME_PROJECTION_WRITE_MODE", "enabled");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
afterAll(async () => client.close());
describe("todas as mutações editoriais e revalidação em contexto", () => {
  it("criação inicia projeção draft sem Entradas no mesmo commit", async () => {
    const created = await insertTheme({
      id: themeId,
      name: "QA",
      slug: "qa",
      editorialState: "draft",
      isActive: false,
    });
    expect(created).toBe(themeId);
    expect(await projection()).toMatchObject({
      editorialState: "draft",
      operationalState: "editorial_draft",
      playableCount: 0,
      activeEntryCount: 0,
    });
  });
  it("publicação/metadata direta usa o mesmo hook e conserva intenção editorial", async () => {
    await seed();
    await setThemeActiveRecord(themeId, false);
    expect((await projection()).editorialState).toBe("draft");
    await updateThemeRecord(themeId, { name: "Novo nome" });
    expect((await projection()).playableCount).toBe(4);
  });
  it("associação direta e retirada atualizam contagens e thumbnail derivada", async () => {
    await seed();
    await updateThemeSongAssociation({
      themeId,
      songId: songId(0),
      title: "QA",
      artist: "QA",
      startTimeSeconds: 0,
      previewDurationSeconds: 30,
      displayOrder: 0,
      isActive: false,
    });
    expect((await projection()).playableCount).toBe(3);
    await removeThemeSongRecord(themeId, songId(1));
    expect((await projection()).activeEntryCount).toBe(2);
  });
  it("upsert direto mantém projeção com metadata da Fonte", async () => {
    await seed();
    await upsertSongAndAssociation({
      themeId,
      providerContentId: "qa-0",
      title: "QA",
      artist: "QA",
      sourceTitle: "QA",
      sourceChannel: "QA",
      thumbnailUrl: "/new.jpg",
      durationSeconds: 180,
      isEmbeddable: false,
      startTimeSeconds: 0,
      previewDurationSeconds: 30,
      isActive: true,
    });
    expect((await projection()).thumbnailUrls).toContain("/new.jpg");
  });
  it("importação e projeção confirmam a nova Entrada unknown", async () => {
    await seed();
    await importPlaylistTracks(
      themeId,
      [
        {
          providerContentId: "qa-new",
          sourceTitle: "Novo",
          sourceChannel: "QA",
          thumbnailUrl: "/new.jpg",
          durationSeconds: 180,
          isEmbeddable: true,
          isRegionAllowed: true,
        },
      ],
      {
        providerContentIdsToAssociate: ["qa-new"],
        providerContentIdsToCountAsExisting: [],
      },
    );
    expect(await projection()).toMatchObject({
      playableCount: 4,
      unknown: 1,
      activeEntryCount: 5,
      operationalState: "degraded",
    });
  });
  it("revalidação individual atualiza observação e projeção atomicamente no Tema em contexto", async () => {
    await seed();
    expect((await unavailable()).applied).toBe(true);
    expect(await projection()).toMatchObject({
      editorialState: "published",
      playableCount: 3,
      unavailable: 1,
      visibility: "hidden",
    });
  });
  it("falha de projeção faz rollback também da observação confirmada", async () => {
    await seed();
    const before = await projection();
    await client.exec(
      "alter table theme_state_projections add constraint qa_reject_three check (playable_count<>3) not valid",
    );
    try {
      await expect(unavailable()).rejects.toThrow();
      expect(await projection()).toEqual(before);
      expect(
        (
          await database
            .select()
            .from(schema.sourceAvailabilityObservations)
            .where(eq(schema.sourceAvailabilityObservations.songId, songId(0)))
        )[0].confirmedState,
      ).toBe("available");
    } finally {
      await client.exec(
        "alter table theme_state_projections drop constraint qa_reject_three",
      );
    }
  });
  it("rebuild exige perfil ativo dentro da transação e corrige derivações do banco", async () => {
    await seed();
    await expect(
      rebuildThemeProjectionRecord(themeId, actorId),
    ).rejects.toMatchObject({
      code: "THEME_PROJECTION_REBUILD_FORBIDDEN",
      status: 403,
    });
    await database.insert(schema.adminProfiles).values({
      userId: actorId,
      displayName: "QA",
      role: "admin",
      isActive: true,
    });
    expect((await rebuildThemeProjectionRecord(themeId, actorId)).status).toBe(
      "unchanged",
    );
    await database
      .update(schema.themeStateProjections)
      .set({ ruleVersion: 99 })
      .where(eq(schema.themeStateProjections.themeId, themeId));
    expect(await rebuildThemeProjectionRecord(themeId, actorId)).toEqual({
      status: "corrected",
      changedFields: ["ruleVersion"],
    });
    await database
      .update(schema.adminProfiles)
      .set({ isActive: false })
      .where(eq(schema.adminProfiles.userId, actorId));
    await expect(
      rebuildThemeProjectionRecord(themeId, actorId),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("rollback do projetor não cria derivados e mantém dados-base", async () => {
    vi.stubEnv("THEME_PROJECTION_WRITE_MODE", "disabled");
    await insertTheme({
      id: themeId,
      name: "QA",
      slug: "qa",
      editorialState: "draft",
      isActive: false,
    });
    expect(await projection()).toBeUndefined();
    expect(await database.select().from(schema.themes)).toHaveLength(1);
  });
  it("criação com lock da capa projeta antes do commit; falha do projetor reverte a criação", async () => {
    const values = {
      id: themeId,
      name: "QA",
      slug: "qa",
      editorialState: "draft" as const,
      isActive: false,
    };
    await client.exec(
      "alter table theme_state_projections add constraint qa_reject_empty check (active_entry_count<>0) not valid",
    );
    try {
      await expect(
        withThemeCoverUrlLock("/qa-cover.jpg", (repo) => repo.insert(values)),
      ).rejects.toThrow();
      expect(await database.select().from(schema.themes)).toEqual([]);
      expect(
        await database.select().from(schema.themeStateProjections),
      ).toEqual([]);
    } finally {
      await client.exec(
        "alter table theme_state_projections drop constraint qa_reject_empty",
      );
    }
    expect(
      await withThemeCoverUrlLock("/qa-cover.jpg", (repo) =>
        repo.insert(values),
      ),
    ).toBe(themeId);
    expect(await projection()).toMatchObject({
      editorialState: "draft",
      activeEntryCount: 0,
    });
  });
  it("falha ao importar faz rollback da Fonte, associação e projeção", async () => {
    await seed();
    const before = await projection();
    await client.exec(
      "alter table theme_state_projections add constraint qa_reject_five check (active_entry_count<>5) not valid",
    );
    try {
      await expect(
        importPlaylistTracks(
          themeId,
          [
            {
              providerContentId: "qa-new",
              sourceTitle: "Novo",
              sourceChannel: "QA",
              thumbnailUrl: "/new.jpg",
              durationSeconds: 180,
              isEmbeddable: true,
              isRegionAllowed: true,
            },
          ],
          {
            providerContentIdsToAssociate: ["qa-new"],
            providerContentIdsToCountAsExisting: [],
          },
        ),
      ).rejects.toThrow();
      expect(await database.select().from(schema.songs)).toHaveLength(4);
      expect(await database.select().from(schema.themeSongs)).toHaveLength(4);
      expect(await projection()).toEqual(before);
    } finally {
      await client.exec(
        "alter table theme_state_projections drop constraint qa_reject_five",
      );
    }
  });
});
