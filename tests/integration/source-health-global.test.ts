import type { SourceHealthInvalidation } from "@/domain/music/catalog-invalidation";
import * as themeRepository from "@/server/repositories/theme-content-repository";
import { createThemeContentService } from "@/server/services/theme-content-service";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { createSourceAvailabilityService } from "@/server/services/source-availability-service";
import {
  findSourceAvailabilityByProviderContentId,
  persistSourceAvailabilityObservation,
} from "@/server/repositories/source-availability-repository";
import {
  captureProjectionContext,
  recalculateThemeProjectionUsing,
} from "@/server/repositories/theme-projection-repository";
import { createAuthoritativePublicThemeRepository } from "@/server/repositories/authoritative-public-theme-repository";
import { createProjectedPublicThemeRepository } from "@/server/repositories/projected-public-theme-repository";
import { createAuthoritativePublicThemeService } from "@/server/services/public-theme-service";
import { postgresRowsAdapter } from "../support/postgres-rows-adapter";
import {
  applySourceAvailabilityResult,
  normalizePlaylistAvailability,
} from "@/domain/music/source-availability";
import { importPlaylistTracks } from "@/server/repositories/theme-content-repository";
import {
  findThemeSummary,
  listThemeProviderContentIds,
} from "@/server/repositories/theme-content-repository";
import { createPlaylistImportService } from "@/server/services/playlist-import-service";
import { createCatalogInvalidationConsumer } from "@/server/services/catalog-invalidation-service";
import { assertCatalogHealthWriteAllowed } from "@/server/repositories/catalog-health-mode";

const unusedPlaylistMethods = {
  search: async () => {
    throw new Error("Unexpected provider search");
  },
  resolve: async () => {
    throw new Error("Unexpected provider resolve");
  },
  getEmbedData: async () => {
    throw new Error("Unexpected provider embed");
  },
  observe: async () => {
    throw new Error("Unexpected provider observe");
  },
};
const boundary = vi.hoisted(() => ({ database: vi.fn() }));
vi.mock("@/db", () => ({ getDatabase: boundary.database }));
const client = new PGlite();
const database = drizzle(client, { schema });
const themeIds = [
  "10000000-0000-4000-8000-000000000081",
  "10000000-0000-4000-8000-000000000082",
];
const songId = (index: number) =>
  `20000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
const now = new Date("2026-10-11T12:00:00.000Z");

beforeAll(async () => {
  await client.exec("create role anon; create role authenticated");
  const journal: { entries: { idx: number; tag: string }[] } = JSON.parse(
    readFileSync("drizzle/meta/_journal.json", "utf8"),
  );
  for (const entry of journal.entries.filter(
    ({ idx }) => idx <= 6 || idx >= 10,
  ))
    await client.exec(readFileSync(`drizzle/${entry.tag}.sql`, "utf8"));
  boundary.database.mockReturnValue(postgresRowsAdapter(database));
  vi.stubEnv("THEME_PROJECTION_WRITE_MODE", "enabled");
  vi.stubEnv("CATALOG_GLOBAL_HEALTH_WRITE_MODE", "enabled");
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("PUBLIC_CATALOG_READ_MODE", "authoritative_direct");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
});

it("recuperação restaura ambos os Temas sem publicação manual e repetição/observação atrasada não geram efeitos", async () => {
  const write = async (time: number, available: boolean) => {
    const current = await findSourceAvailabilityByProviderContentId(
      "global-0",
      "BR",
    );
    const track = current?.track ?? null;
    if (available && !track) throw new Error("Fixture track missing");
    const result =
      available && track
        ? { type: "available" as const, reason: "available" as const, track }
        : {
            type: "unavailable" as const,
            reason: "not_found" as const,
            track: null,
          };
    const observation = applySourceAvailabilityResult({
      current: current?.observation ?? null,
      observedAt: new Date(now.getTime() + time),
      result,
    });
    return {
      input: {
        providerContentId: "global-0",
        track: result.track,
        observation,
      },
      result: await persistSourceAvailabilityObservation({
        providerContentId: "global-0",
        track: result.track,
        observation,
      }),
    };
  };
  await write(1, false);
  const restored = await write(2, true);
  expect(restored.result.applied).toBe(true);
  for (const row of await database.select().from(schema.themeStateProjections))
    expect(row).toMatchObject({
      editorialState: "published",
      visibility: "visible",
      operationalState: "healthy",
      playableCount: 4,
    });
  const before = {
    source: await findSourceAvailabilityByProviderContentId("global-0", "BR"),
    projections: await database.select().from(schema.themeStateProjections),
    outbox: (
      await client.query(
        "select * from catalog_invalidation_outbox order by id",
      )
    ).rows,
  };
  expect(
    (await persistSourceAvailabilityObservation(restored.input)).applied,
  ).toBe(false);
  expect((await write(0, false)).result.applied).toBe(false);
  expect(
    await findSourceAvailabilityByProviderContentId("global-0", "BR"),
  ).toEqual(before.source);
  expect(await database.select().from(schema.themeStateProjections)).toEqual(
    before.projections,
  );
  expect(
    (
      await client.query(
        "select * from catalog_invalidation_outbox order by id",
      )
    ).rows,
  ).toEqual(before.outbox);
  const reader = createAuthoritativePublicThemeService({
    ...createAuthoritativePublicThemeRepository(database),
    clock: () => now,
  });
  expect((await reader.listThemes()).map(({ slug }) => slug)).toEqual([
    "tema-0",
    "tema-1",
  ]);
});

it("falha na segunda projeção reverte observação, todos os derivados, marcador e outbox", async () => {
  const before = await database.select().from(schema.themeStateProjections);
  await client.exec(
    `alter table theme_state_projections add constraint reject_second_health check (theme_id <> '${themeIds[1]}'::uuid or playable_count <> 3) not valid`,
  );
  try {
    await expect(
      persistSourceAvailabilityObservation({
        providerContentId: "global-0",
        track: null,
        observation: applySourceAvailabilityResult({
          current: null,
          observedAt: new Date(now.getTime() + 1),
          result: { type: "unavailable", reason: "not_found", track: null },
        }),
      }),
    ).rejects.toThrow();
    expect(await database.select().from(schema.themeStateProjections)).toEqual(
      before,
    );
    expect(
      (await findSourceAvailabilityByProviderContentId("global-0", "BR"))
        ?.observation,
    ).toMatchObject({ confirmedState: "available", revision: 1 });
    expect(
      (await client.query("select * from catalog_invalidation_outbox")).rows,
    ).toEqual([]);
    expect(
      (await client.query("select * from catalog_global_health_activation"))
        .rows,
    ).toEqual([]);
  } finally {
    await client.exec(
      "alter table theme_state_projections drop constraint reject_second_health",
    );
  }
});

it("writer disabled bloqueia revalidação antes do provedor e não altera o catálogo", async () => {
  vi.stubEnv("CATALOG_GLOBAL_HEALTH_WRITE_MODE", "disabled");
  const observe = vi.fn(async () => ({
    type: "unavailable" as const,
    reason: "not_found" as const,
    track: null,
  }));
  const service = createSourceAvailabilityService({
    clock: () => new Date(now.getTime() + 1),
    findSource: findSourceAvailabilityByProviderContentId,
    persistObservation: persistSourceAvailabilityObservation,
    metrics: { record: vi.fn() },
    provider: { observe },
  });
  try {
    await expect(
      service.observeSource("global-0", { themeId: themeIds[0] }),
    ).rejects.toMatchObject({ code: "CATALOG_BUSY", status: 409 });
    expect(observe).not.toHaveBeenCalled();
    expect(
      (await findSourceAvailabilityByProviderContentId("global-0", "BR"))
        ?.observation,
    ).toMatchObject({ confirmedState: "available", revision: 1 });
  } finally {
    vi.stubEnv("CATALOG_GLOBAL_HEALTH_WRITE_MODE", "enabled");
  }
});

it("a terceira observação mais recente vence mesmo preparada antes das duas anteriores", async () => {
  const initial = await findSourceAvailabilityByProviderContentId(
    "global-0",
    "BR",
  );
  if (!initial?.track || !initial.observation)
    throw new Error("Fixture missing");
  for (const [time, available] of [
    [1, false],
    [2, true],
    [3, false],
  ] as const) {
    const result = available
      ? {
          type: "available" as const,
          reason: "available" as const,
          track: initial.track,
        }
      : {
          type: "unavailable" as const,
          reason: "not_found" as const,
          track: null,
        };
    const persisted = await persistSourceAvailabilityObservation({
      providerContentId: "global-0",
      track: result.track,
      observation: applySourceAvailabilityResult({
        current: initial.observation,
        observedAt: new Date(now.getTime() + time),
        result,
      }),
    });
    expect(persisted.applied).toBe(true);
  }
  expect(
    (await findSourceAvailabilityByProviderContentId("global-0", "BR"))
      ?.observation,
  ).toMatchObject({
    confirmedState: "unavailable",
    revision: 4,
    observedAt: new Date(now.getTime() + 3),
  });
  expect(
    (await client.query("select * from catalog_invalidation_outbox")).rows,
  ).toHaveLength(6);
});

it("erro transitório usa predecessor corrente sob lock e não ressuscita uma confirmação antiga", async () => {
  const observe = vi.fn(async () => {
    const current = await findSourceAvailabilityByProviderContentId(
      "global-0",
      "BR",
    );
    await persistSourceAvailabilityObservation({
      providerContentId: "global-0",
      track: null,
      observation: applySourceAvailabilityResult({
        current: current?.observation ?? null,
        observedAt: new Date(now.getTime() + 2),
        result: { type: "unavailable", reason: "not_found", track: null },
      }),
    });
    return {
      type: "transient_error" as const,
      errorCode: "transport" as const,
    };
  });
  const service = createSourceAvailabilityService({
    clock: () => new Date(now.getTime() + 3),
    findSource: findSourceAvailabilityByProviderContentId,
    persistObservation: persistSourceAvailabilityObservation,
    metrics: { record: vi.fn() },
    provider: { observe },
  });
  const result = await service.observeSource("global-0", {
    themeId: themeIds[0],
  });
  expect(observe).toHaveBeenCalledTimes(1);
  expect(result.observation).toMatchObject({
    confirmedState: "unavailable",
    confirmationReason: "not_found",
    errorCode: "transport",
    revision: 3,
  });
  expect(result.availability.playable).toBe(false);
  for (const row of await database.select().from(schema.themeStateProjections))
    expect(row).toMatchObject({
      playableCount: 3,
      visibility: "hidden",
      editorialState: "published",
    });
});

it("consumidor póscommit mantém backlog após falha e retry idempotente invalida os dois Temas", async () => {
  const invalidated: string[] = [];
  let instant = new Date(now.getTime() + 100);
  let fail = true;
  const consumer = createCatalogInvalidationConsumer({
    database: () => postgresRowsAdapter(database),
    clock: () => instant,
    invalidatePath: async (path: string) => {
      if (fail) {
        fail = false;
        throw new Error("Controlled cache failure");
      }
      invalidated.push(path);
    },
  });
  const service = createSourceAvailabilityService({
    clock: () => new Date(now.getTime() + 1),
    findSource: findSourceAvailabilityByProviderContentId,
    persistObservation: persistSourceAvailabilityObservation,
    metrics: { record: vi.fn() },
    provider: {
      observe: async () => ({
        type: "unavailable",
        reason: "not_found",
        track: null,
      }),
    },
    afterCommit: async () => {
      await consumer.drain();
    },
  });
  const result = await service.observeSource("global-0", {
    themeId: themeIds[0],
  });
  expect(result.applied).toBe(true);
  const pending = await client.query(
    "select * from catalog_invalidation_outbox where processed_at is null",
  );
  expect(pending.rows).toHaveLength(1);
  expect(
    (await findSourceAvailabilityByProviderContentId("global-0", "BR"))
      ?.observation?.confirmedState,
  ).toBe("unavailable");
  instant = new Date(now.getTime() + 5000);
  expect(await consumer.drain()).toMatchObject({ delivered: 1, retried: 0 });
  expect(invalidated).toEqual(
    expect.arrayContaining([
      "/",
      "/tema/tema-0",
      "/tema/tema-1",
      "/admin",
      "/admin/temas",
      `/admin/temas/${themeIds[0]}`,
      `/admin/temas/${themeIds[1]}`,
    ]),
  );
  const count = invalidated.length;
  expect(await consumer.drain()).toMatchObject({ delivered: 0, retried: 0 });
  expect(invalidated).toHaveLength(count);
  expect(
    (
      await client.query(
        "select * from catalog_invalidation_outbox where processed_at is null",
      )
    ).rows,
  ).toEqual([]);
});

it("schema sem RLS ou com grant público fecha antes do provedor", async () => {
  const observe = vi.fn(async () => ({
    type: "unavailable" as const,
    reason: "not_found" as const,
    track: null,
  }));
  const service = createSourceAvailabilityService({
    assertWriteAllowed: () =>
      assertCatalogHealthWriteAllowed(postgresRowsAdapter(database)),
    clock: () => new Date(now.getTime() + 1),
    findSource: findSourceAvailabilityByProviderContentId,
    persistObservation: persistSourceAvailabilityObservation,
    metrics: { record: vi.fn() },
    provider: { observe },
  });
  await client.exec(
    "alter table catalog_invalidation_outbox disable row level security",
  );
  try {
    await expect(service.observeSource("global-0")).rejects.toMatchObject({
      code: "CATALOG_BUSY",
      status: 409,
    });
  } finally {
    await client.exec(
      "alter table catalog_invalidation_outbox enable row level security",
    );
  }
  await client.exec("grant select on catalog_invalidation_outbox to anon");
  try {
    await expect(service.observeSource("global-0")).rejects.toMatchObject({
      code: "CATALOG_BUSY",
      status: 409,
    });
  } finally {
    await client.exec("revoke all on catalog_invalidation_outbox from anon");
  }
  expect(observe).not.toHaveBeenCalled();
});

it("lote de playlist propaga Fonte já associada ausente para todos os Temas e conserva curadoria", async () => {
  const entries = await database.select().from(schema.themeSongs);
  const result = await importPlaylistTracks(themeIds[0], [], {
    providerContentIdsToAssociate: [],
    providerContentIdsToCountAsExisting: [],
    normalizedAttempts: normalizePlaylistAvailability(
      ["global-0"],
      [],
      new Date(now.getTime() + 1),
    ),
  });
  expect(result).toMatchObject({ added: 0, alreadyAssociated: 0 });
  for (const row of await database.select().from(schema.themeStateProjections))
    expect(row).toMatchObject({
      playableCount: 3,
      unavailable: 1,
      visibility: "hidden",
      editorialState: "published",
    });
  expect(await database.select().from(schema.themeSongs)).toEqual(entries);
  expect(
    (await client.query("select * from catalog_invalidation_outbox")).rows,
  ).toHaveLength(2);
});

it("confirmação de playlist normaliza ausente e delega uma vez ao lote global", async () => {
  const resolveMany = vi.fn(async () => []);
  const service = createPlaylistImportService({
    findThemeSummary,
    listThemeProviderContentIds,
    importPlaylistTracks,
    now: () => now.getTime() + 1,
    randomId: () => "qa-preview",
    musicProvider: {
      ...unusedPlaylistMethods,
      resolveMany,
      previewPlaylist: async () => {
        throw new Error("Preview not requested");
      },
    },
  });
  expect(
    await service.confirm({
      adminUserId: "30000000-0000-4000-8000-000000000081",
      themeId: themeIds[0],
      previewId: "expired-preview",
      selectedProviderContentIds: ["global-0"],
    }),
  ).toEqual({ added: 0, alreadyAssociated: 0, ignored: 1 });
  expect(resolveMany).toHaveBeenCalledTimes(1);
  expect(resolveMany).toHaveBeenCalledWith(["global-0"], "BR");
  for (const row of await database.select().from(schema.themeStateProjections))
    expect(row.playableCount).toBe(3);
  expect(
    (await client.query("select * from catalog_invalidation_outbox")).rows,
  ).toHaveLength(2);
});

it("marker preservado fecha unset pósativação e mudanças de configuração sem chamadas externas", async () => {
  const observe = vi.fn(async () => ({
    type: "unavailable" as const,
    reason: "not_found" as const,
    track: null,
  }));
  const service = createSourceAvailabilityService({
    assertWriteAllowed: () =>
      assertCatalogHealthWriteAllowed(postgresRowsAdapter(database)),
    clock: () => new Date(now.getTime() + 1),
    findSource: findSourceAvailabilityByProviderContentId,
    persistObservation: persistSourceAvailabilityObservation,
    metrics: { record: vi.fn() },
    provider: { observe },
  });
  for (const mode of ["disabled", "invalid"]) {
    vi.stubEnv("CATALOG_GLOBAL_HEALTH_WRITE_MODE", mode);
    await expect(service.observeSource("global-0")).rejects.toMatchObject({
      code: "CATALOG_BUSY",
      status: 409,
    });
  }
  vi.stubEnv("CATALOG_GLOBAL_HEALTH_WRITE_MODE", "enabled");
  vi.stubEnv("VERCEL_ENV", "production");
  await expect(service.observeSource("global-0")).rejects.toMatchObject({
    code: "CATALOG_BUSY",
    status: 409,
  });
  vi.stubEnv("VERCEL_ENV", "preview");
  await client.exec(
    "alter table catalog_invalidation_outbox rename to unavailable_catalog_outbox",
  );
  try {
    await expect(service.observeSource("global-0")).rejects.toMatchObject({
      code: "CATALOG_BUSY",
      status: 409,
    });
  } finally {
    await client.exec(
      "alter table unavailable_catalog_outbox rename to catalog_invalidation_outbox",
    );
  }
  expect(observe).not.toHaveBeenCalled();
  await service.observeSource("global-0");
  expect(observe).toHaveBeenCalledTimes(1);
  const source = await findSourceAvailabilityByProviderContentId(
    "global-0",
    "BR",
  );
  const queue = (
    await client.query("select * from catalog_invalidation_outbox order by id")
  ).rows;
  vi.stubEnv("CATALOG_GLOBAL_HEALTH_WRITE_MODE", undefined);
  await expect(service.observeSource("global-0")).rejects.toMatchObject({
    code: "CATALOG_BUSY",
    status: 409,
  });
  expect(observe).toHaveBeenCalledTimes(1);
  expect(
    await findSourceAvailabilityByProviderContentId("global-0", "BR"),
  ).toEqual(source);
  expect(
    (
      await client.query(
        "select * from catalog_invalidation_outbox order by id",
      )
    ).rows,
  ).toEqual(queue);
  vi.stubEnv("CATALOG_GLOBAL_HEALTH_WRITE_MODE", "enabled");
});

it("rollback só do projetor/consumidor preserva writer, publicação, outbox e leitura direta", async () => {
  vi.stubEnv("THEME_PROJECTION_WRITE_MODE", "disabled");
  vi.stubEnv("CATALOG_INVALIDATION_CONSUMER_MODE", "disabled");
  const before = await database.select().from(schema.themeStateProjections);
  try {
    await persistSourceAvailabilityObservation({
      providerContentId: "global-0",
      track: null,
      observation: applySourceAvailabilityResult({
        current: null,
        observedAt: new Date(now.getTime() + 1),
        result: { type: "unavailable", reason: "not_found", track: null },
      }),
    });
    expect(await database.select().from(schema.themeStateProjections)).toEqual(
      before,
    );
    expect(
      (await client.query("select * from catalog_invalidation_outbox")).rows,
    ).toHaveLength(2);
    const invalidatePath = vi.fn();
    await createCatalogInvalidationConsumer({
      database: () => postgresRowsAdapter(database),
      clock: () => now,
      invalidatePath,
    }).drain();
    expect(invalidatePath).not.toHaveBeenCalled();
    const reader = createAuthoritativePublicThemeService({
      ...createAuthoritativePublicThemeRepository(database),
      clock: () => now,
    });
    expect(await reader.listThemes()).toEqual([]);
    expect(
      (await client.query("select editorial_state from themes")).rows,
    ).toEqual([
      { editorial_state: "published" },
      { editorial_state: "published" },
    ]);
  } finally {
    vi.stubEnv("THEME_PROJECTION_WRITE_MODE", "enabled");
    vi.stubEnv("CATALOG_INVALIDATION_CONSUMER_MODE", undefined);
  }
});
afterAll(async () => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  await client.close();
});

beforeEach(async () => {
  await client.exec(
    "truncate catalog_global_health_activation, catalog_invalidation_outbox, themes, songs cascade",
  );

  await database.insert(schema.themes).values(
    themeIds.map((id, index) => ({
      id,
      name: `Tema ${index}`,
      slug: `tema-${index}`,
      editorialState: "published" as const,
      isActive: true,
    })),
  );
  await database.insert(schema.songs).values(
    Array.from({ length: 7 }, (_, index) => ({
      id: songId(index),
      provider: "youtube" as const,
      providerContentId: `global-${index}`,
      sourceTitle: "QA",
      sourceChannel: "QA",
      thumbnailUrl: `/qa-${index}.jpg`,
      durationSeconds: 180,
      isEmbeddable: true,
    })),
  );
  for (const [index, themeId] of themeIds.entries()) {
    await database.insert(schema.themeSongs).values(
      [0, 1 + index * 3, 2 + index * 3, 3 + index * 3].map((index) => ({
        themeId,
        songId: songId(index),
        title: "QA",
        artist: "QA",
        previewDurationSeconds: 30,
        isActive: true,
      })),
    );
  }
  await database.insert(schema.sourceAvailabilityObservations).values(
    Array.from({ length: 7 }, (_, index) => ({
      songId: songId(index),
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
  for (const id of themeIds)
    await database.transaction((tx) =>
      recalculateThemeProjectionUsing(tx, id, captureProjectionContext(now)),
    );
});

it("revalidar a Fonte compartilhada suspende ambos os Temas published em projeção, home e slugs", async () => {
  const direct = createAuthoritativePublicThemeService({
    ...createAuthoritativePublicThemeRepository(database),
    clock: () => now,
  });
  const projected = createAuthoritativePublicThemeService({
    ...createProjectedPublicThemeRepository(database),
    clock: () => now,
    readMode: "authoritative_projected",
  });
  expect((await direct.listThemes()).map(({ slug }) => slug)).toEqual([
    "tema-0",
    "tema-1",
  ]);
  const service = createSourceAvailabilityService({
    clock: () => new Date(now.getTime() + 1),
    findSource: findSourceAvailabilityByProviderContentId,
    persistObservation: persistSourceAvailabilityObservation,
    metrics: { record: vi.fn() },
    provider: {
      observe: async () => ({
        type: "unavailable",
        reason: "not_found",
        track: null,
      }),
    },
  });
  expect(
    (await service.observeSource("global-0", { themeId: themeIds[0] })).applied,
  ).toBe(true);
  const projections = await database
    .select()
    .from(schema.themeStateProjections);
  expect(projections).toHaveLength(2);
  for (const row of projections)
    expect(row).toMatchObject({
      editorialState: "published",
      visibility: "hidden",
      operationalState: "suspended_insufficient_healthy_entries",
      playableCount: 3,
      unavailable: 1,
    });
  for (const reader of [direct, projected]) {
    expect(await reader.listThemes()).toEqual([]);
    expect(await reader.getTheme("tema-0")).toBeNull();
    expect(await reader.getTheme("tema-1")).toBeNull();
  }
  const outbox = await client.query<{ payload: SourceHealthInvalidation }>(
    "select payload from catalog_invalidation_outbox order by theme_id",
  );
  expect(outbox.rows).toHaveLength(2);
  for (const [index, row] of outbox.rows.entries()) {
    expect(row.payload).toMatchObject({
      schemaVersion: 1,
      ruleVersion: 1,
      type: "source_health_changed",
      cause: "health_change",
      source: { region: "BR", revision: 2, policyVersion: 1 },
      theme: { id: themeIds[index], slug: `tema-${index}` },
      transition: {
        fromVisibility: "visible",
        toVisibility: "hidden",
        fromOperationalState: "healthy",
        toOperationalState: "suspended_insufficient_healthy_entries",
      },
    });
  }
});

it("revalidação administrativa usa a mutação global sem emitir uma segunda transição parcial", async () => {
  const observe = vi.fn(async () => ({
    type: "unavailable" as const,
    reason: "not_found" as const,
    track: null,
  }));
  const source = createSourceAvailabilityService({
    assertWriteAllowed: () =>
      assertCatalogHealthWriteAllowed(postgresRowsAdapter(database)),
    clock: () => new Date(now.getTime() + 1),
    findSource: findSourceAvailabilityByProviderContentId,
    persistObservation: persistSourceAvailabilityObservation,
    metrics: { record: vi.fn() },
    provider: { observe },
  });
  const recordThemeStateEvent = vi.fn();
  const content = createThemeContentService({
    ...themeRepository,
    observeSourceAvailability: source.observeSource,
    clock: () => now,
    recordThemeStateEvent,
  });
  expect(
    (await content.revalidateSourceAvailability(themeIds[0], songId(0)))
      .playable,
  ).toBe(false);
  expect(observe).toHaveBeenCalledExactlyOnceWith("global-0", "BR");
  expect(
    (
      await client.query<{ payload: SourceHealthInvalidation }>(
        "select payload from catalog_invalidation_outbox",
      )
    ).rows,
  ).toHaveLength(2);
  expect(recordThemeStateEvent).not.toHaveBeenCalled();
});

it("playlist fecha quando a configuração muda durante o provedor, sem metadata parcial", async () => {
  const before = await database.select().from(schema.songs);
  const resolveMany = vi.fn(async () => {
    vi.stubEnv("CATALOG_GLOBAL_HEALTH_WRITE_MODE", undefined);
    const source = await findSourceAvailabilityByProviderContentId(
      "global-0",
      "BR",
    );
    if (!source?.track) throw new Error("Fixture track missing");
    return [{ ...source.track, sourceTitle: "Must not persist" }];
  });
  const service = createPlaylistImportService({
    findThemeSummary,
    listThemeProviderContentIds,
    importPlaylistTracks,
    assertWriteAllowed: () =>
      assertCatalogHealthWriteAllowed(postgresRowsAdapter(database)),
    now: () => now.getTime() + 1,
    randomId: () => "qa-race",
    musicProvider: {
      ...unusedPlaylistMethods,
      resolveMany,
      previewPlaylist: vi.fn(),
    },
  });
  try {
    await expect(
      service.confirm({
        adminUserId: "30000000-0000-4000-8000-000000000081",
        themeId: themeIds[0],
        previewId: "expired",
        selectedProviderContentIds: ["global-0"],
      }),
    ).rejects.toMatchObject({ code: "CATALOG_BUSY" });
    expect(resolveMany).toHaveBeenCalledTimes(1);
    expect(await database.select().from(schema.songs)).toEqual(before);
    expect(
      (await client.query("select * from catalog_global_health_activation"))
        .rows,
    ).toHaveLength(0);
    expect(
      (await client.query("select * from catalog_invalidation_outbox")).rows,
    ).toHaveLength(0);
  } finally {
    vi.stubEnv("CATALOG_GLOBAL_HEALTH_WRITE_MODE", "enabled");
  }
});

it("cadastro manual inclui o Tema de origem antes da associação e preserva curadoria e causa editorial", async () => {
  await client.query(
    "delete from theme_songs where theme_id=$1 and song_id=$2",
    [themeIds[0], songId(0)],
  );
  const source = await findSourceAvailabilityByProviderContentId(
    "global-0",
    "BR",
  );
  if (!source?.track) throw new Error("Fixture track missing");
  const observe = vi.fn(async () => ({
    type: "available" as const,
    reason: "available" as const,
    track: source.track!,
  }));
  const availability = createSourceAvailabilityService({
    assertWriteAllowed: () =>
      assertCatalogHealthWriteAllowed(postgresRowsAdapter(database)),
    clock: () => new Date(now.getTime() + 1),
    findSource: findSourceAvailabilityByProviderContentId,
    persistObservation: persistSourceAvailabilityObservation,
    metrics: { record: vi.fn() },
    provider: { observe },
  });
  const recordThemeStateEvent = vi.fn();
  const service = createThemeContentService({
    ...themeRepository,
    observeSourceAvailability: availability.observeSource,
    recordThemeStateEvent,
    clock: () => now,
  });
  await service.attachResolvedTrack(themeIds[0], {
    providerContentId: "global-0",
    title: "Título curado",
    artist: "Artista curado",
    startTimeSeconds: 17,
    previewDurationSeconds: 30,
    isActive: true,
  });
  expect(observe).toHaveBeenCalledExactlyOnceWith("global-0", "BR");
  const rows = (
    await client.query<{ payload: SourceHealthInvalidation }>(
      "select payload from catalog_invalidation_outbox order by theme_id",
    )
  ).rows;
  expect(rows.map((row) => row.payload.theme.id)).toEqual(themeIds);
  expect(rows[0].payload.transition).toMatchObject({
    fromVisibility: "hidden",
    toVisibility: "hidden",
    lostPrimaryModes: [],
    recoveredPrimaryModes: [],
  });
  expect(
    await themeRepository.findThemeSong(themeIds[0], songId(0)),
  ).toMatchObject({
    title: "Título curado",
    artist: "Artista curado",
    startTimeSeconds: 17,
    previewDurationSeconds: 30,
  });
  expect(recordThemeStateEvent.mock.calls.length).toBeGreaterThan(0);
  expect(
    recordThemeStateEvent.mock.calls.every(
      ([event]) => event.cause === "editorial",
    ),
  ).toBe(true);
  for (const row of await database.select().from(schema.themeStateProjections))
    expect(row.playableCount).toBe(4);
});

it.each([32, 64] as const)(
  "retirada editorial de %i não vira perda de saúde, mesmo com projeção antiga",
  async (size) => {
    const extras = Array.from({ length: size - 4 }, (_, n) => n + 7);
    await database.insert(schema.songs).values(
      extras.map((index) => ({
        id: songId(index),
        provider: "youtube" as const,
        providerContentId: "global-" + index,
        sourceTitle: "QA",
        sourceChannel: "QA",
        thumbnailUrl: "/qa.jpg",
        durationSeconds: 180,
        isEmbeddable: true,
      })),
    );
    const [observation] = await database
      .select()
      .from(schema.sourceAvailabilityObservations);
    await database
      .insert(schema.sourceAvailabilityObservations)
      .values(
        extras.map((index) => ({ ...observation, songId: songId(index) })),
      );
    for (const themeId of themeIds) {
      await database.insert(schema.themeSongs).values(
        extras.map((index) => ({
          themeId,
          songId: songId(index),
          title: "QA",
          artist: "QA",
          previewDurationSeconds: 30,
          isActive: true,
        })),
      );
      await database.transaction((tx) =>
        recalculateThemeProjectionUsing(
          tx,
          themeId,
          captureProjectionContext(now),
        ),
      );
    }
    const availability = createSourceAvailabilityService({
      assertWriteAllowed: () =>
        assertCatalogHealthWriteAllowed(postgresRowsAdapter(database)),
      clock: () => new Date(now.getTime() + 1),
      findSource: findSourceAvailabilityByProviderContentId,
      persistObservation: persistSourceAvailabilityObservation,
      metrics: { record: vi.fn() },
      provider: {
        observe: async () => ({
          type: "unavailable",
          reason: "not_found",
          track: null,
        }),
      },
    });
    const recordThemeStateEvent = vi.fn();
    const service = createThemeContentService({
      ...themeRepository,
      observeSourceAvailability: availability.observeSource,
      clock: () => now,
      recordThemeStateEvent,
    });
    await service.removeThemeSong(themeIds[0], songId(extras.at(-1)!));
    const modeEvent = recordThemeStateEvent.mock.calls
      .map(([event]) => event)
      .find((event) => event.type === "primary_modes_changed");
    expect(modeEvent).toMatchObject({
      cause: "editorial",
      lostPrimaryModes: [size],
    });
    expect(
      (await client.query("select * from catalog_invalidation_outbox")).rows,
    ).toHaveLength(0);
    // Simulate a late projection: health's predecessor must come from base data.
    await client.query(
      "update theme_state_projections set available_fresh=$1,potential_count=$1,playable_count=$1,active_entry_count=$1,supported_modes=$2 where theme_id=$3",
      [size, size === 64 ? [4, 8, 16, 32, 64] : [4, 8, 16, 32], themeIds[0]],
    );
    recordThemeStateEvent.mockClear();
    await service.revalidateSourceAvailability(themeIds[0], songId(0));
    const rows = (
      await client.query<{ payload: SourceHealthInvalidation }>(
        "select payload from catalog_invalidation_outbox order by theme_id",
      )
    ).rows;
    expect(rows).toHaveLength(2);
    expect(rows[0].payload).toMatchObject({
      cause: "health_change",
      transition: { lostPrimaryModes: [] },
    });
    expect(rows[1].payload).toMatchObject({
      cause: "health_change",
      transition: { lostPrimaryModes: [size] },
    });
    expect(recordThemeStateEvent).not.toHaveBeenCalled();
    expect(
      (
        await client.query(
          "select editorial_state,playable_count from theme_state_projections order by theme_id",
        )
      ).rows,
    ).toEqual([
      { editorial_state: "published", playable_count: size - 2 },
      { editorial_state: "published", playable_count: size - 1 },
    ]);
  },
);

it("saúde confirmada não vira erro quando a telemetria falha após o commit", async () => {
  const service = createSourceAvailabilityService({
    assertWriteAllowed: () =>
      assertCatalogHealthWriteAllowed(postgresRowsAdapter(database)),
    clock: () => new Date(now.getTime() + 1),
    findSource: findSourceAvailabilityByProviderContentId,
    persistObservation: persistSourceAvailabilityObservation,
    metrics: {
      record: () => {
        throw new Error("Telemetry unavailable");
      },
    },
    provider: {
      observe: async () => ({
        type: "unavailable",
        reason: "not_found",
        track: null,
      }),
    },
  });
  expect((await service.observeSource("global-0")).availability.playable).toBe(
    false,
  );
  expect(
    (
      await client.query<{ payload: SourceHealthInvalidation }>(
        "select payload from catalog_invalidation_outbox",
      )
    ).rows,
  ).toHaveLength(2);
  for (const row of await database.select().from(schema.themeStateProjections))
    expect(row.playableCount).toBe(3);
});

it.each(["source", "playlist"] as const)(
  "%s fecha quando o modo muda de legacy para enabled durante o provedor",
  async (entry) => {
    vi.stubEnv("CATALOG_GLOBAL_HEALTH_WRITE_MODE", undefined);
    const before = await database.select().from(schema.songs);
    const source = await findSourceAvailabilityByProviderContentId(
      "global-0",
      "BR",
    );
    if (!source?.track) throw new Error("Fixture track missing");
    const external = vi.fn(async () => {
      vi.stubEnv("CATALOG_GLOBAL_HEALTH_WRITE_MODE", "enabled");
      return source.track!;
    });
    const assertWriteAllowed = () =>
      assertCatalogHealthWriteAllowed(postgresRowsAdapter(database));
    try {
      const call =
        entry === "source"
          ? createSourceAvailabilityService({
              assertWriteAllowed,
              clock: () => new Date(now.getTime() + 1),
              findSource: findSourceAvailabilityByProviderContentId,
              persistObservation: persistSourceAvailabilityObservation,
              metrics: { record: vi.fn() },
              provider: {
                observe: async () => ({
                  type: "available",
                  reason: "available",
                  track: await external(),
                }),
              },
            }).observeSource("global-0")
          : createPlaylistImportService({
              assertWriteAllowed,
              findThemeSummary,
              listThemeProviderContentIds,
              importPlaylistTracks,
              now: () => now.getTime() + 1,
              randomId: () => "qa-reverse",
              musicProvider: {
                ...unusedPlaylistMethods,
                previewPlaylist: async () => {
                  throw new Error("Unexpected preview");
                },
                resolveMany: async () => [await external()],
              },
            }).confirm({
              adminUserId: "30000000-0000-4000-8000-000000000081",
              themeId: themeIds[0],
              previewId: "expired",
              selectedProviderContentIds: ["global-0"],
            });
      await expect(call).rejects.toMatchObject({ code: "CATALOG_BUSY" });
      expect(external).toHaveBeenCalledTimes(1);
      expect(await database.select().from(schema.songs)).toEqual(before);
      expect(
        (await client.query("select * from catalog_global_health_activation"))
          .rows,
      ).toHaveLength(0);
      expect(
        (await client.query("select * from catalog_invalidation_outbox")).rows,
      ).toHaveLength(0);
    } finally {
      vi.stubEnv("CATALOG_GLOBAL_HEALTH_WRITE_MODE", "enabled");
    }
  },
);

it("SQL rejeita payload não controlado, tipos coercíveis e transições inválidas", async () => {
  await persistSourceAvailabilityObservation({
    providerContentId: "global-0",
    track: null,
    observation: applySourceAvailabilityResult({
      current: null,
      observedAt: new Date(now.getTime() + 1),
      result: { type: "unavailable", reason: "not_found", track: null },
    }),
  });
  const [row] = (
    await client.query<{ id: string; payload: SourceHealthInvalidation }>(
      "select id,payload from catalog_invalidation_outbox order by theme_id",
    )
  ).rows;
  const invalid = [
    { ...row.payload, providerUrl: "https://provider.invalid/private" },
    { ...row.payload, schemaVersion: "1" },
    { ...row.payload, source: { ...row.payload.source, revision: "2" } },
    { ...row.payload, theme: { ...row.payload.theme, slug: null } },
    {
      ...row.payload,
      transition: { ...row.payload.transition, fromVisibility: "private" },
    },
    {
      ...row.payload,
      transition: { ...row.payload.transition, lostPrimaryModes: [32, 32] },
    },
    {
      ...row.payload,
      transition: {
        ...row.payload.transition,
        lostPrimaryModes: [32],
        recoveredPrimaryModes: [32],
      },
    },
    {
      ...row.payload,
      transition: { ...row.payload.transition, recoveredPrimaryModes: [128] },
    },
  ];
  for (const payload of invalid)
    await expect(
      client.query(
        "update catalog_invalidation_outbox set payload=$1::jsonb where id=$2",
        [JSON.stringify(payload), row.id],
      ),
    ).rejects.toThrow();
  expect(
    (
      await client.query<{ payload: SourceHealthInvalidation }>(
        "select payload from catalog_invalidation_outbox where id=$1",
        [row.id],
      )
    ).rows[0].payload,
  ).toEqual(row.payload);
});

it("métricas globais agregam Temas e transições sem identificadores em observação e playlist", async () => {
  const original = await findSourceAvailabilityByProviderContentId(
    "global-0",
    "BR",
  );
  if (!original?.track) throw new Error("Fixture track missing");
  const logger = vi.spyOn(console, "info").mockImplementation(() => {});
  const input = {
    providerContentId: "global-0",
    track: null,
    observation: applySourceAvailabilityResult({
      current: null,
      observedAt: new Date(now.getTime() + 1),
      result: { type: "unavailable", reason: "not_found", track: null },
    }),
  };
  try {
    await persistSourceAvailabilityObservation(input);
    await persistSourceAvailabilityObservation(input);
    const tracks = [original.track];
    await importPlaylistTracks(themeIds[0], tracks, {
      expectedWriteMode: "enabled",
      normalizedAttempts: normalizePlaylistAvailability(
        ["global-0"],
        tracks,
        new Date(now.getTime() + 2),
      ),
      providerContentIdsToAssociate: ["global-0"],
      providerContentIdsToCountAsExisting: [],
    });
    const events = logger.mock.calls
      .filter(([name]) => name === "[catalog-global-health]")
      .map(([, event]) => event);
    expect(events).toEqual([
      {
        metric: "catalog_global_health_mutation",
        cause: "health_change",
        result: "applied",
        affectedThemeCount: 2,
        transitionCount: 2,
        outboxCount: 2,
        retryCount: 0,
        policyVersion: 1,
        ruleVersion: 1,
      },
      {
        metric: "catalog_global_health_mutation",
        cause: "health_change",
        result: "ignored",
        affectedThemeCount: 0,
        transitionCount: 0,
        outboxCount: 0,
        retryCount: 0,
        policyVersion: 1,
        ruleVersion: 1,
      },
      {
        metric: "catalog_global_health_mutation",
        cause: "health_change",
        result: "applied",
        affectedThemeCount: 2,
        transitionCount: 2,
        outboxCount: 2,
        retryCount: 0,
        policyVersion: 1,
        ruleVersion: 1,
      },
    ]);
  } finally {
    logger.mockRestore();
  }
});

it.each([
  "disabled",
  "unknown",
  "unset_after_activation",
  "production",
  "schema_missing",
  "wrong_reader",
  "projected_without_projector",
] as const)(
  "três entradas fecham em %s antes do provedor e preservam todos os dados",
  async (mode) => {
    const source = await findSourceAvailabilityByProviderContentId(
      "global-0",
      "BR",
    );
    if (!source?.track) throw new Error("Fixture track missing");
    if (mode === "unset_after_activation")
      await persistSourceAvailabilityObservation({
        providerContentId: "global-0",
        track: source.track,
        observation: applySourceAvailabilityResult({
          current: source.observation,
          observedAt: new Date(now.getTime() + 1),
          result: {
            type: "available",
            reason: "available",
            track: source.track,
          },
        }),
      });
    const external = vi.fn(async () => source.track!);
    const assertWriteAllowed = () =>
      assertCatalogHealthWriteAllowed(postgresRowsAdapter(database));
    const availability = createSourceAvailabilityService({
      assertWriteAllowed,
      clock: () => new Date(now.getTime() + 2),
      findSource: findSourceAvailabilityByProviderContentId,
      persistObservation: persistSourceAvailabilityObservation,
      metrics: { record: vi.fn() },
      provider: {
        observe: async () => ({
          type: "available",
          reason: "available",
          track: await external(),
        }),
      },
    });
    const content = createThemeContentService({
      ...themeRepository,
      observeSourceAvailability: availability.observeSource,
      clock: () => now,
    });
    const playlist = createPlaylistImportService({
      assertWriteAllowed,
      findThemeSummary,
      listThemeProviderContentIds,
      importPlaylistTracks,
      now: () => now.getTime() + 2,
      randomId: () => "qa-disabled",
      musicProvider: {
        ...unusedPlaylistMethods,
        resolveMany: async () => [await external()],
        previewPlaylist: async () => {
          throw new Error("Unexpected preview");
        },
      },
    });
    const snapshot = async () => ({
      songs: await database.select().from(schema.songs),
      entries: await database.select().from(schema.themeSongs),
      observations: await database
        .select()
        .from(schema.sourceAvailabilityObservations),
      projections: await database.select().from(schema.themeStateProjections),
      outbox: (
        await client.query(
          "select * from catalog_invalidation_outbox order by id",
        )
      ).rows,
      activation: (
        await client.query("select * from catalog_global_health_activation")
      ).rows,
    });
    const before = await snapshot();
    if (mode === "disabled" || mode === "unknown")
      vi.stubEnv("CATALOG_GLOBAL_HEALTH_WRITE_MODE", mode);
    if (mode === "unset_after_activation")
      vi.stubEnv("CATALOG_GLOBAL_HEALTH_WRITE_MODE", undefined);
    if (mode === "production") {
      vi.stubEnv("VERCEL_ENV", "production");
      vi.stubEnv("NODE_ENV", "production");
    }
    if (mode === "wrong_reader")
      vi.stubEnv("PUBLIC_CATALOG_READ_MODE", "legacy_guardrail");
    if (mode === "projected_without_projector") {
      vi.stubEnv("PUBLIC_CATALOG_READ_MODE", "authoritative_projected");
      vi.stubEnv("THEME_PROJECTION_WRITE_MODE", "disabled");
    }
    if (mode === "schema_missing")
      await client.exec(
        "alter table catalog_invalidation_outbox rename to cat08_hidden_outbox",
      );
    try {
      await expect(
        content.attachResolvedTrack(themeIds[0], {
          providerContentId: "global-0",
          title: "QA",
          artist: "QA",
          startTimeSeconds: 0,
          previewDurationSeconds: 30,
          isActive: true,
        }),
      ).rejects.toMatchObject({ code: "CATALOG_BUSY", status: 409 });
      await expect(
        content.revalidateSourceAvailability(themeIds[0], songId(0)),
      ).rejects.toMatchObject({ code: "CATALOG_BUSY", status: 409 });
      await expect(
        playlist.confirm({
          adminUserId: "30000000-0000-4000-8000-000000000081",
          themeId: themeIds[0],
          previewId: "expired",
          selectedProviderContentIds: ["global-0"],
        }),
      ).rejects.toMatchObject({ code: "CATALOG_BUSY", status: 409 });
      expect(external).not.toHaveBeenCalled();
    } finally {
      if (mode === "schema_missing")
        await client.exec(
          "alter table cat08_hidden_outbox rename to catalog_invalidation_outbox",
        );
      vi.stubEnv("CATALOG_GLOBAL_HEALTH_WRITE_MODE", "enabled");
      vi.stubEnv("VERCEL_ENV", "preview");
      vi.stubEnv("NODE_ENV", "test");
      vi.stubEnv("THEME_PROJECTION_WRITE_MODE", "enabled");
      vi.stubEnv("PUBLIC_CATALOG_READ_MODE", "authoritative_direct");
    }
    expect(await snapshot()).toEqual(before);
  },
);

it("dataset nunca ativado conserva compatibilidade sem alterar o default público", async () => {
  vi.stubEnv("CATALOG_GLOBAL_HEALTH_WRITE_MODE", undefined);
  vi.stubEnv("PUBLIC_CATALOG_READ_MODE", undefined);
  try {
    expect(
      await assertCatalogHealthWriteAllowed(postgresRowsAdapter(database)),
    ).toBe("legacy");
    const original = await findSourceAvailabilityByProviderContentId(
      "global-0",
      "BR",
    );
    if (!original?.track) throw new Error("Fixture missing");
    const service = createPlaylistImportService({
      assertWriteAllowed: () =>
        assertCatalogHealthWriteAllowed(postgresRowsAdapter(database)),
      findThemeSummary,
      listThemeProviderContentIds,
      importPlaylistTracks,
      now: () => now.getTime() + 1,
      randomId: () => "qa-default",
      musicProvider: {
        ...unusedPlaylistMethods,
        resolveMany: async () => [
          { ...original.track!, sourceTitle: "Compatível" },
        ],
        previewPlaylist: async () => {
          throw new Error("Unexpected preview");
        },
      },
    });
    expect(
      await service.confirm({
        adminUserId: "30000000-0000-4000-8000-000000000081",
        themeId: themeIds[0],
        previewId: "expired",
        selectedProviderContentIds: ["global-0"],
      }),
    ).toEqual({ added: 0, alreadyAssociated: 1, ignored: 0 });
    expect(process.env.PUBLIC_CATALOG_READ_MODE).toBeUndefined();
    expect(
      (await client.query("select * from catalog_global_health_activation"))
        .rows,
    ).toHaveLength(0);
    expect(
      (await client.query("select * from catalog_invalidation_outbox")).rows,
    ).toHaveLength(0);
    expect(
      (await findSourceAvailabilityByProviderContentId("global-0", "BR"))
        ?.observation?.revision,
    ).toBe(1);
  } finally {
    vi.stubEnv("CATALOG_GLOBAL_HEALTH_WRITE_MODE", "enabled");
    vi.stubEnv("PUBLIC_CATALOG_READ_MODE", "authoritative_direct");
  }
});

it("enabled projected e reativação preservam revisão, marcador e transições existentes", async () => {
  vi.stubEnv("PUBLIC_CATALOG_READ_MODE", "authoritative_projected");
  try {
    const source = await findSourceAvailabilityByProviderContentId(
      "global-0",
      "BR",
    );
    if (!source?.track) throw new Error("Fixture missing");
    const input = {
      providerContentId: "global-0",
      track: null,
      observation: applySourceAvailabilityResult({
        current: source.observation,
        observedAt: new Date(now.getTime() + 1),
        result: { type: "unavailable", reason: "not_found", track: null },
      }),
    };
    await persistSourceAvailabilityObservation(input);
    const previous = (
      await client.query(
        "select id,payload from catalog_invalidation_outbox order by id",
      )
    ).rows;
    const activation = (
      await client.query("select * from catalog_global_health_activation")
    ).rows;
    vi.stubEnv("CATALOG_GLOBAL_HEALTH_WRITE_MODE", "disabled");
    await expect(
      assertCatalogHealthWriteAllowed(postgresRowsAdapter(database)),
    ).rejects.toMatchObject({ code: "CATALOG_BUSY" });
    vi.stubEnv("CATALOG_GLOBAL_HEALTH_WRITE_MODE", "enabled");
    const current = await findSourceAvailabilityByProviderContentId(
      "global-0",
      "BR",
    );
    const revived = await persistSourceAvailabilityObservation({
      providerContentId: "global-0",
      track: source.track,
      observation: applySourceAvailabilityResult({
        current: current?.observation ?? null,
        observedAt: new Date(now.getTime() + 2),
        result: { type: "available", reason: "available", track: source.track },
      }),
    });
    expect(revived.observation.revision).toBe(3);
    expect(
      (await client.query("select * from catalog_global_health_activation"))
        .rows,
    ).toEqual(activation);
    const events = (
      await client.query(
        "select id,payload from catalog_invalidation_outbox order by id",
      )
    ).rows;
    expect(events).toHaveLength(4);
    expect(events).toEqual(expect.arrayContaining(previous));
    const direct = createAuthoritativePublicThemeService({
      ...createAuthoritativePublicThemeRepository(database),
      clock: () => now,
    });
    const projected = createAuthoritativePublicThemeService({
      ...createProjectedPublicThemeRepository(database),
      clock: () => now,
      readMode: "authoritative_projected",
    });
    expect(await projected.listThemes()).toEqual(await direct.listThemes());
  } finally {
    vi.stubEnv("CATALOG_GLOBAL_HEALTH_WRITE_MODE", "enabled");
    vi.stubEnv("PUBLIC_CATALOG_READ_MODE", "authoritative_direct");
  }
});
