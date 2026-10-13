import { normalizePlaylistAvailability } from "@/domain/music/source-availability";
import type { SourceAvailabilityProvider } from "@/domain/music/provider";
import * as themeRepository from "@/server/repositories/theme-content-repository";
import { createThemeContentService } from "@/server/services/theme-content-service";
import { applySourceAvailabilityResult } from "@/domain/music/source-availability";
import { createCatalogInvalidationConsumer } from "@/server/services/catalog-invalidation-service";
import {
  createGameSession,
  createGameService,
} from "@/server/services/game-service";
import {
  withGameCreationTransaction,
  getGameStateRecord,
} from "@/server/repositories/game-repository";
import type { SourceHealthInvalidation } from "@/domain/music/catalog-invalidation";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { createSourceAvailabilityService } from "@/server/services/source-availability-service";
import { assertCatalogHealthWriteAllowed } from "@/server/repositories/catalog-health-mode";
import {
  findSourceAvailabilityByProviderContentId,
  persistSourceAvailabilityObservation,
} from "@/server/repositories/source-availability-repository";
import {
  captureProjectionContext,
  recalculateThemeProjectionUsing,
} from "@/server/repositories/theme-projection-repository";

const boundary = vi.hoisted(() => ({ database: vi.fn() }));
vi.mock("@/db", () => ({ getDatabase: boundary.database }));
const databaseName = `cat08_qa_${randomUUID().replaceAll("-", "")}`;
const themeIds = [
  "10000000-0000-4000-8000-000000000081",
  "10000000-0000-4000-8000-000000000082",
];
const songId = (index: number) =>
  `20000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
const now = new Date();
let admin: ReturnType<typeof postgres> | undefined;
let setup: ReturnType<typeof postgres>;
let writer: ReturnType<typeof postgres>;
let peer: ReturnType<typeof postgres>;
let observer: ReturnType<typeof postgres>;
let database: ReturnType<typeof drizzle<typeof schema>>;
let ownedInstanceVerified = false;
let createdDatabase = false;
const ownedRoles: string[] = [];
let setupCompleted = false;

function gate() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function waitForLock() {
  const deadline = Date.now() + 1500;
  while (Date.now() < deadline) {
    const waiting = await observer`
      select pid from pg_stat_activity
      where datname = ${databaseName} and application_name = 'cat08_writer'
        and wait_event_type = 'Lock'
    `;
    if (waiting.length > 0) return;
    await new Promise((done) => setTimeout(done, 10));
  }
  throw new Error("No owned PostgreSQL writer lock waiter observed");
}

beforeAll(async () => {
  const configured = process.env.CAT08_POSTGRES_ADMIN_URL;
  if (!configured)
    throw new Error(
      "CAT08 requires its real disposable PostgreSQL URL; no skip",
    );
  const url = new URL(configured);
  if (
    process.env.CAT08_QA_DISPOSABLE !== "1" ||
    url.protocol !== "postgresql:" ||
    url.hostname !== "127.0.0.1" ||
    url.port !== "55459" ||
    url.username !== "cat08qa" ||
    url.password !== "" ||
    url.pathname !== "/postgres" ||
    url.search !== ""
  )
    throw new Error("Refusing a non-owned PostgreSQL instance");
  admin = postgres(url.toString(), { max: 1, onnotice: () => {} });
  const [identity] = await admin`
    select current_setting('data_directory') as data,
           current_setting('listen_addresses') as listen, version() as version,
           current_setting('max_connections')::int as connections,
           current_setting('shared_buffers') as buffers
  `;
  expect(identity.data).toBe(
    "C:/Users/LEOFR/AppData/Local/Temp/cat08-pg-alias-20261011/data",
  );
  expect(identity.listen).toBe("127.0.0.1");
  expect(identity.version).toContain("PostgreSQL 17.11");
  expect(identity.connections).toBe(20);
  expect(identity.buffers).toBe("32MB");
  ownedInstanceVerified = true;
  await admin.unsafe(`create database "${databaseName}"`);
  createdDatabase = true;
  url.pathname = "/" + databaseName;
  setup = postgres(url.toString(), {
    max: 1,
    onnotice: () => {},
    connection: { application_name: "cat08_setup" },
  });
  expect(
    await setup`select rolname from pg_roles where rolname in ('anon','authenticated','cat08_reader','cat08_backend')`,
  ).toEqual([]);
  for (const [name, options] of [
    ["anon", "nologin nosuperuser nobypassrls"],
    ["authenticated", "nologin nosuperuser nobypassrls"],
    ["cat08_reader", "nologin nosuperuser nobypassrls"],
    ["cat08_backend", "login nosuperuser nocreatedb nocreaterole bypassrls"],
  ]) {
    await setup.unsafe(`create role "${name}" ${options}`);
    ownedRoles.push(name);
  }
  const journal: { entries: { idx: number; tag: string }[] } = JSON.parse(
    readFileSync("drizzle/meta/_journal.json", "utf8"),
  );
  for (const entry of journal.entries.filter(
    ({ idx }) => idx <= 6 || idx >= 10,
  ))
    await setup.unsafe(readFileSync(`drizzle/${entry.tag}.sql`, "utf8"));
  await setup.unsafe(
    "grant select,insert,update,delete on all tables in schema public to cat08_backend",
  );
  url.username = "cat08_backend";
  writer = postgres(url.toString(), {
    max: 3,
    onnotice: () => {},
    connection: { application_name: "cat08_writer" },
  });
  peer = postgres(url.toString(), {
    max: 1,
    onnotice: () => {},
    connection: { application_name: "cat08_peer" },
  });
  observer = postgres(url.toString(), {
    max: 1,
    onnotice: () => {},
    connection: { application_name: "cat08_observer" },
  });
  database = drizzle(writer, { schema });
  setupCompleted = true;
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await writer?.end();
  await peer?.end();
  await observer?.end();
  await setup?.end();
  if (!admin) return;
  if (!ownedInstanceVerified) {
    await admin.end();
    return;
  }
  if (!setupCompleted) {
    console.info("[cat08-qa-partial-setup]", {
      databaseName,
      createdDatabase,
      ownedRoles,
    });
    await admin.end();
    return;
  }
  if (!/^cat08_qa_[a-f0-9]{32}$/.test(databaseName))
    throw new Error("Cleanup namespace mismatch");
  if (createdDatabase)
    await admin.unsafe(`drop database if exists "${databaseName}"`);
  for (const role of ownedRoles) {
    if (
      !["anon", "authenticated", "cat08_reader", "cat08_backend"].includes(role)
    )
      throw new Error("Owned role cleanup guard");
    await admin.unsafe(`drop role if exists "${role}"`);
  }
  expect(
    await admin`select datname from pg_database where datname = ${databaseName}`,
  ).toEqual([]);
  await admin.end();
});

beforeEach(async () => {
  boundary.database.mockReset().mockReturnValue(database);
  vi.stubEnv("CATALOG_GLOBAL_HEALTH_WRITE_MODE", "enabled");
  vi.stubEnv("THEME_PROJECTION_WRITE_MODE", "enabled");
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("PUBLIC_CATALOG_READ_MODE", "authoritative_direct");
  const fixtures = drizzle(setup, { schema });
  expect(
    await writer`select rolsuper as super,rolbypassrls as bypass from pg_roles where rolname=current_user`,
  ).toEqual([{ super: false, bypass: true }]);
  await setup.unsafe(
    "truncate catalog_global_health_activation,catalog_invalidation_outbox,themes,songs,admin_profiles cascade",
  );
  await fixtures.insert(schema.themes).values(
    themeIds.map((id, index) => ({
      id,
      name: `QA ${index}`,
      slug: `cat08-${index}`,
      editorialState: "published" as const,
      isActive: true,
    })),
  );
  await fixtures.insert(schema.songs).values(
    Array.from({ length: 7 }, (_, index) => ({
      id: songId(index),
      provider: "youtube" as const,
      providerContentId: `cat08-${index}`,
      sourceTitle: "QA",
      sourceChannel: "QA",
      thumbnailUrl: "/qa.jpg",
      durationSeconds: 180,
      isEmbeddable: true,
    })),
  );
  for (const [index, themeId] of themeIds.entries())
    await fixtures.insert(schema.themeSongs).values(
      [0, 1 + index * 3, 2 + index * 3, 3 + index * 3].map((index) => ({
        themeId,
        songId: songId(index),
        title: "QA",
        artist: "QA",
        previewDurationSeconds: 30,
        isActive: true,
      })),
    );
  await fixtures.insert(schema.sourceAvailabilityObservations).values(
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

it("expansão entre leitura e locks reinicia com todos os Temas sem repetir o provedor", async () => {
  await writer`delete from theme_songs where theme_id=${themeIds[1]}::uuid`;
  const reached = gate(),
    release = gate();
  const holder = peer.begin(async (transaction) => {
    await transaction`select id from themes where id=${themeIds[0]}::uuid for update`;
    reached.resolve();
    await release.promise;
  });
  await reached.promise;
  let attempts = 0;
  boundary.database.mockReturnValue(
    new Proxy(database, {
      get(target, property, receiver) {
        if (property === "transaction")
          return (operation: Parameters<typeof database.transaction>[0]) => {
            attempts += 1;
            return database.transaction(operation);
          };
        return Reflect.get(target, property, receiver);
      },
    }),
  );
  const observe = vi.fn(async () => ({
    type: "unavailable" as const,
    reason: "not_found" as const,
    track: null,
  }));
  const service = createSourceAvailabilityService({
    assertWriteAllowed: () => assertCatalogHealthWriteAllowed(database),
    clock: () => new Date(now.getTime() + 1),
    findSource: findSourceAvailabilityByProviderContentId,
    persistObservation: persistSourceAvailabilityObservation,
    metrics: { record: vi.fn() },
    provider: { observe },
  });
  const health = service.observeSource("cat08-0", { themeId: themeIds[0] });
  void health.catch(() => {});
  try {
    await waitForLock();
    await observer`insert into theme_songs(theme_id,song_id,title,artist,preview_duration_seconds) values(${themeIds[1]}::uuid,${songId(0)}::uuid,'Curadoria','QA',30)`;
  } finally {
    release.resolve();
  }
  await holder;
  expect((await health).applied).toBe(true);
  expect(attempts).toBe(2);
  expect(observe).toHaveBeenCalledExactlyOnceWith("cat08-0", "BR");
  expect(
    await observer`select theme_id,playable_count,editorial_state from theme_state_projections order by theme_id`,
  ).toEqual([
    { theme_id: themeIds[0], playable_count: 3, editorial_state: "published" },
    { theme_id: themeIds[1], playable_count: 0, editorial_state: "published" },
  ]);
  expect(
    await observer`select revision,confirmed_state from source_availability_observations where song_id=${songId(0)}::uuid`,
  ).toEqual([{ revision: 2, confirmed_state: "unavailable" }]);
  expect(
    await observer`select theme_id,revision from catalog_invalidation_outbox order by theme_id`,
  ).toEqual(themeIds.map((theme_id) => ({ theme_id, revision: 2 })));
});

function unavailableService(observe: SourceAvailabilityProvider["observe"]) {
  return createSourceAvailabilityService({
    assertWriteAllowed: () => assertCatalogHealthWriteAllowed(database),
    clock: () => new Date(now.getTime() + 1),
    findSource: findSourceAvailabilityByProviderContentId,
    persistObservation: persistSourceAvailabilityObservation,
    metrics: { record: vi.fn() },
    provider: { observe },
  });
}

it("barreira liberada depois do timeout permite retry físico sem repetir provedor", async () => {
  const ready = gate(),
    release = gate();
  const holder = peer.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock_shared(hashtextextended('catalog-global-health-activation',0))`;
    ready.resolve();
    await release.promise;
  });
  await ready.promise;
  const logger = vi.spyOn(console, "info").mockImplementation(() => {});
  logger.mockClear();
  const aborted = gate();
  let firstAbortCode: string | undefined;
  let attempts = 0;
  const code = (error: unknown, depth = 0): string | undefined => {
    if (!error || typeof error !== "object" || depth > 3) return undefined;
    if ("code" in error && typeof error.code === "string") return error.code;
    return "cause" in error ? code(error.cause, depth + 1) : undefined;
  };
  boundary.database.mockReturnValue(
    new Proxy(database, {
      get(target, property, receiver) {
        if (property === "transaction")
          return async (
            operation: Parameters<typeof database.transaction>[0],
          ) => {
            attempts += 1;
            try {
              return await database.transaction(operation);
            } catch (error) {
              firstAbortCode ??= code(error);
              aborted.resolve();
              throw error;
            }
          };
        return Reflect.get(target, property, receiver);
      },
    }),
  );

  const observe = vi.fn(async () => ({
    type: "unavailable" as const,
    reason: "not_found" as const,
    track: null,
  }));
  const health = unavailableService(observe).observeSource("cat08-0", {
    themeId: themeIds[0],
  });
  void health.catch(() => {});
  try {
    await waitForLock();
    await aborted.promise;
    expect(firstAbortCode).toBe("55P03");
  } finally {
    release.resolve();
    await holder;
  }
  try {
    expect((await health).applied).toBe(true);
    expect(attempts).toBe(2);
    expect(observe).toHaveBeenCalledExactlyOnceWith("cat08-0", "BR");
    const metrics = logger.mock.calls
      .filter(([name]) => name === "[catalog-global-health]")
      .map(([, event]) => event);
    expect(metrics.filter((event) => event.result === "retry")).toHaveLength(1);
    expect(metrics.find((event) => event.result === "applied")).toMatchObject({
      retryCount: 1,
      affectedThemeCount: 2,
      outboxCount: 2,
    });
    expect(
      await observer`select count(*)::int as rows from catalog_invalidation_outbox`,
    ).toEqual([{ rows: 2 }]);
  } finally {
    logger.mockRestore();
  }
});
it("barreira persistente recusa após três tentativas com rollback integral e provider único", async () => {
  const ready = gate(),
    release = gate();
  const holder = peer.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock_shared(hashtextextended('catalog-global-health-activation',0))`;
    ready.resolve();
    await release.promise;
  });
  await ready.promise;
  const logger = vi.spyOn(console, "info").mockImplementation(() => {});
  logger.mockClear();
  const observe = vi.fn(async () => ({
    type: "unavailable" as const,
    reason: "not_found" as const,
    track: null,
  }));
  const before =
    await observer`select * from theme_state_projections order by theme_id`;
  try {
    await expect(
      unavailableService(observe).observeSource("cat08-0", {
        themeId: themeIds[0],
      }),
    ).rejects.toMatchObject({ code: "CATALOG_BUSY", status: 409 });
    expect(observe).toHaveBeenCalledExactlyOnceWith("cat08-0", "BR");
    expect(
      logger.mock.calls.filter(
        ([name, event]) =>
          name === "[catalog-global-health]" && event.result === "retry",
      ),
    ).toHaveLength(2);
    expect(
      await observer`select revision,confirmed_state from source_availability_observations where song_id=${songId(0)}::uuid`,
    ).toEqual([{ revision: 1, confirmed_state: "available" }]);
    expect(
      await observer`select * from theme_state_projections order by theme_id`,
    ).toEqual(before);
    expect(
      await observer`select (select count(*)::int from catalog_global_health_activation) marker,(select count(*)::int from catalog_invalidation_outbox) events`,
    ).toEqual([{ marker: 0, events: 0 }]);
  } finally {
    release.resolve();
    await holder;
    logger.mockRestore();
  }
});

const missingProvider = () =>
  vi.fn(async () => ({
    type: "unavailable" as const,
    reason: "not_found" as const,
    track: null,
  }));
it("papéis públicos não leem/escrevem; FORCE RLS bloqueia reader com grants e backend funciona sem superuser", async () => {
  await unavailableService(missingProvider()).observeSource("cat08-0");
  for (const table of [
    "catalog_global_health_activation",
    "catalog_invalidation_outbox",
  ]) {
    expect(
      await observer`select relrowsecurity as rls,relforcerowsecurity as forced from pg_class where oid=${"public." + table}::regclass`,
    ).toEqual([{ rls: true, forced: true }]);
    expect(
      await observer`select policyname from pg_policies where schemaname='public' and tablename=${table}`,
    ).toEqual([]);
    for (const role of ["anon", "authenticated"]) {
      expect(
        await observer`select has_table_privilege(${role},${table},'SELECT') as read,has_table_privilege(${role},${table},'INSERT,UPDATE,DELETE') as write`,
      ).toEqual([{ read: false, write: false }]);
      await expect(
        setup.begin(async (tx) => {
          await tx.unsafe(`set local role "${role}"`);
          await tx.unsafe(`select * from public."${table}"`);
        }),
      ).rejects.toMatchObject({ code: "42501" });
    }
  }
  await setup.unsafe(
    "grant select,insert on catalog_invalidation_outbox,catalog_global_health_activation to cat08_reader",
  );
  try {
    await setup.begin(async (tx) => {
      await tx.unsafe("set local role cat08_reader");
      expect(
        await tx`select rolsuper as super,rolbypassrls as bypass from pg_roles where rolname=current_user`,
      ).toEqual([{ super: false, bypass: false }]);
      expect(await tx`select * from catalog_invalidation_outbox`).toEqual([]);
      expect(await tx`select * from catalog_global_health_activation`).toEqual(
        [],
      );
    });
    const [record] =
      await setup`select * from catalog_invalidation_outbox limit 1`;
    const newRecord = {
      ...record,
      id: randomUUID(),
      revision: record.revision + 1,
      payload: JSON.stringify({
        ...record.payload,
        source: { ...record.payload.source, revision: record.revision + 1 },
      }),
    };
    await expect(
      setup.begin(async (tx) => {
        await tx.unsafe("set local role cat08_reader");
        await tx`insert into catalog_invalidation_outbox ${tx(newRecord)}`;
      }),
    ).rejects.toMatchObject({ code: "42501" });
  } finally {
    await setup.unsafe(
      "revoke all on catalog_invalidation_outbox,catalog_global_health_activation from cat08_reader",
    );
  }
  expect(
    await observer`select count(*)::int as rows from catalog_invalidation_outbox`,
  ).toEqual([{ rows: 2 }]);
});

it("type/cause JSON null são recusados na gravação PostgreSQL e preservam a linha", async () => {
  await unavailableService(missingProvider()).observeSource("cat08-0");
  const [row] = await writer<
    { id: string; payload: SourceHealthInvalidation }[]
  >`select id,payload from catalog_invalidation_outbox order by theme_id`;
  for (const payload of [
    { ...row.payload, type: null },
    { ...row.payload, cause: null },
  ]) {
    await expect(
      writer`update catalog_invalidation_outbox set payload=${JSON.stringify(payload)}::jsonb where id=${row.id}::uuid`,
    ).rejects.toMatchObject({ code: "23514" });
    expect(
      (
        await writer<
          { payload: SourceHealthInvalidation }[]
        >`select payload from catalog_invalidation_outbox where id=${row.id}::uuid`
      )[0].payload,
    ).toEqual(row.payload);
  }
});

it("falha na segunda projeção faz rollback da saúde, todas as projeções, marcador e outbox entre peers", async () => {
  const snapshot = async () => ({
    source:
      await observer`select * from source_availability_observations order by song_id`,
    projections:
      await observer`select * from theme_state_projections order by theme_id`,
    outbox: await observer`select * from catalog_invalidation_outbox`,
    marker: await observer`select * from catalog_global_health_activation`,
  });
  const before = await snapshot();
  await setup.unsafe(
    `alter table theme_state_projections add constraint cat08_reject_second check (theme_id <> '${themeIds[1]}'::uuid or playable_count <> 3) not valid`,
  );
  const observe = missingProvider();
  try {
    await expect(
      unavailableService(observe).observeSource("cat08-0"),
    ).rejects.toThrow();
    expect(observe).toHaveBeenCalledExactlyOnceWith("cat08-0", "BR");
    expect(await snapshot()).toEqual(before);
  } finally {
    await setup.unsafe(
      "alter table theme_state_projections drop constraint cat08_reject_second",
    );
  }
});

it("saúde confirma antes da partida concorrente: recusa integral sem sessão/snapshot/matches", async () => {
  const reached = gate(),
    release = gate();
  let held = false;
  boundary.database.mockReturnValue(
    new Proxy(database, {
      get(target, property, receiver) {
        if (property === "transaction")
          return (operation: Parameters<typeof database.transaction>[0]) => {
            if (held) return database.transaction(operation);
            held = true;
            return database.transaction(async (tx) => {
              const result = await operation(tx);
              reached.resolve();
              await release.promise;
              return result;
            });
          };
        return Reflect.get(target, property, receiver);
      },
    }),
  );
  const health = unavailableService(missingProvider()).observeSource("cat08-0");
  void health.catch(() => {});
  await reached.promise;
  const game = createGameSession({ themeId: themeIds[0], bracketSize: 4 });
  void game.catch(() => {});
  try {
    await waitForLock();
    expect(
      await observer`select confirmed_state from source_availability_observations where song_id=${songId(0)}::uuid`,
    ).toEqual([{ confirmed_state: "available" }]);
  } finally {
    release.resolve();
  }
  await health;
  await expect(game).rejects.toMatchObject({
    code: "INSUFFICIENT_ACTIVE_SONGS",
    status: 409,
  });
  expect(
    await observer`select (select count(*)::int from game_sessions) sessions,(select count(*)::int from session_songs) snapshots,(select count(*)::int from game_matches) matches`,
  ).toEqual([{ sessions: 0, snapshots: 0, matches: 0 }]);
});

it("partida confirma antes da saúde concorrente: snapshot completo permanece íntegro", async () => {
  const reached = gate(),
    release = gate();
  const games = createGameService({
    getGameState: (id) => getGameStateRecord(id, database),
    now: () => now,
    random: () => 0.25,
    withGameCreationTransaction: (id, operation, options) =>
      withGameCreationTransaction(
        id,
        async (repo) => {
          const result = await operation(repo);
          reached.resolve();
          await release.promise;
          return result;
        },
        { ...options, authoritative: true, clock: () => now },
        database,
      ),
    withGameDecisionTransaction: async () => {
      throw new Error("No decision requested");
    },
  });
  const game = games.createSession({ themeId: themeIds[0], bracketSize: 4 });
  void game.catch(() => {});
  await reached.promise;
  const health = unavailableService(missingProvider()).observeSource("cat08-0");
  void health.catch(() => {});
  try {
    await waitForLock();
  } finally {
    release.resolve();
  }
  const { sessionId } = await game;
  await health;
  const state = await games.getState(sessionId);
  expect(state.songs.map((song) => song.providerContentId).sort()).toEqual([
    "cat08-0",
    "cat08-1",
    "cat08-2",
    "cat08-3",
  ]);
  expect(new Set(state.songs.map((song) => song.songId)).size).toBe(4);
  expect(
    await observer`select count(*)::int as rows from game_sessions`,
  ).toEqual([{ rows: 1 }]);
  expect(
    await observer`select count(*)::int as rows from session_songs where session_id=${sessionId}::uuid`,
  ).toEqual([{ rows: 4 }]);
  expect(
    await observer`select playable_count from theme_state_projections where theme_id=${themeIds[0]}::uuid`,
  ).toEqual([{ playable_count: 3 }]);
});

it("outbox real fica invisível a peers e consumidor até commit; entrega/ack é idempotente", async () => {
  const reached = gate(),
    release = gate();
  let held = false;
  boundary.database.mockReturnValue(
    new Proxy(database, {
      get(target, property, receiver) {
        if (property === "transaction")
          return (operation: Parameters<typeof database.transaction>[0]) => {
            if (held) return database.transaction(operation);
            held = true;
            return database.transaction(async (tx) => {
              const result = await operation(tx);
              reached.resolve();
              await release.promise;
              return result;
            });
          };
        return Reflect.get(target, property, receiver);
      },
    }),
  );
  const invalidatePath = vi.fn();
  const consumer = createCatalogInvalidationConsumer({
    database: () => drizzle(peer, { schema }),
    clock: () => new Date(),
    invalidatePath,
  });
  const service = createSourceAvailabilityService({
    afterCommit: () => consumer.drain(),
    assertWriteAllowed: () => assertCatalogHealthWriteAllowed(database),
    clock: () => new Date(now.getTime() + 1),
    findSource: findSourceAvailabilityByProviderContentId,
    persistObservation: persistSourceAvailabilityObservation,
    metrics: { record: vi.fn() },
    provider: { observe: missingProvider() },
  });
  const health = service.observeSource("cat08-0");
  void health.catch(() => {});
  await reached.promise;
  try {
    expect(
      await observer`select count(*)::int as rows from catalog_invalidation_outbox`,
    ).toEqual([{ rows: 0 }]);
    expect((await consumer.drain()).delivered).toBe(0);
    expect(invalidatePath).not.toHaveBeenCalled();
  } finally {
    release.resolve();
  }
  expect((await health).applied).toBe(true);
  expect(invalidatePath).toHaveBeenCalledTimes(10);
  for (const slug of ["cat08-0", "cat08-1"])
    expect(invalidatePath).toHaveBeenCalledWith("/tema/" + slug);
  expect(
    await observer`select count(*) filter(where processed_at is null)::int pending,count(*) filter(where processed_at is not null)::int delivered from catalog_invalidation_outbox`,
  ).toEqual([{ pending: 0, delivered: 2 }]);
  expect((await consumer.drain()).delivered).toBe(0);
  expect(invalidatePath).toHaveBeenCalledTimes(10);
});

it("outbox real distribui leases entre dois consumidores sem duplicar o evento ativo", async () => {
  await unavailableService(missingProvider()).observeSource("cat08-0");
  const entered = gate(),
    release = gate();
  let firstPath = true;
  const a = createCatalogInvalidationConsumer({
    database: () => database,
    clock: () => new Date(),
    invalidatePath: async () => {
      if (firstPath) {
        firstPath = false;
        entered.resolve();
        await release.promise;
      }
    },
  });
  const bPaths = vi.fn();
  const b = createCatalogInvalidationConsumer({
    database: () => drizzle(peer, { schema }),
    clock: () => new Date(),
    invalidatePath: bPaths,
  });
  const first = a.drain(1);
  void first.catch(() => {});
  await entered.promise;
  try {
    expect((await b.drain(1)).delivered).toBe(1);
    expect(bPaths).toHaveBeenCalledTimes(5);
    expect(
      await observer`select count(*) filter(where processed_at is null)::int pending,count(*) filter(where processed_at is not null)::int delivered from catalog_invalidation_outbox`,
    ).toEqual([{ pending: 1, delivered: 1 }]);
  } finally {
    release.resolve();
  }
  expect((await first).delivered).toBe(1);
  expect(
    await observer`select attempts,processed_at is not null as delivered from catalog_invalidation_outbox order by theme_id`,
  ).toEqual([
    { attempts: 1, delivered: true },
    { attempts: 1, delivered: true },
  ]);
});

it("outbox real cerca ack de consumidor antigo após lease expirada e reentrega", async () => {
  await unavailableService(missingProvider()).observeSource("cat08-0");
  const entered = gate(),
    release = gate(),
    start = new Date();
  let firstPath = true;
  const a = createCatalogInvalidationConsumer({
    database: () => database,
    clock: () => start,
    invalidatePath: async () => {
      if (firstPath) {
        firstPath = false;
        entered.resolve();
        await release.promise;
      }
    },
  });
  const b = createCatalogInvalidationConsumer({
    database: () => drizzle(peer, { schema }),
    clock: () => new Date(start.getTime() + 31000),
    invalidatePath: vi.fn(),
  });
  const stale = a.drain(1);
  void stale.catch(() => {});
  await entered.promise;
  let before =
    await observer`select id,attempts,processed_at,lease_token,leased_until from catalog_invalidation_outbox where false`;
  try {
    expect((await b.drain()).delivered).toBe(2);
    before =
      await observer`select id,attempts,processed_at,lease_token,leased_until from catalog_invalidation_outbox order by id`;
    expect(before.map((row) => row.attempts).sort()).toEqual([1, 2]);
  } finally {
    release.resolve();
  }
  expect((await stale).delivered).toBe(0);
  expect(
    await observer`select id,attempts,processed_at,lease_token,leased_until from catalog_invalidation_outbox order by id`,
  ).toEqual(before);
});

it("outbox real conserva backlog após falha de cache e entrega no retry sem refazer saúde", async () => {
  const start = new Date();
  let fail = true;
  const paths = vi.fn((path: string) => {
    if (path === "/tema/cat08-0" && fail) {
      fail = false;
      throw new Error("Controlled cache failure");
    }
  });
  let clock = new Date(start.getTime() + 1000);
  const consumer = createCatalogInvalidationConsumer({
    database: () => database,
    clock: () => clock,
    invalidatePath: paths,
  });
  const service = createSourceAvailabilityService({
    afterCommit: () => consumer.drain(),
    assertWriteAllowed: () => assertCatalogHealthWriteAllowed(database),
    clock: () => new Date(now.getTime() + 1),
    findSource: findSourceAvailabilityByProviderContentId,
    persistObservation: persistSourceAvailabilityObservation,
    metrics: { record: vi.fn() },
    provider: { observe: missingProvider() },
  });
  expect((await service.observeSource("cat08-0")).availability.playable).toBe(
    false,
  );
  expect(
    await observer`select count(*) filter(where processed_at is null)::int pending,count(*) filter(where processed_at is not null)::int delivered from catalog_invalidation_outbox`,
  ).toEqual([{ pending: 1, delivered: 1 }]);
  clock = new Date(start.getTime() + 5000);
  expect((await consumer.drain()).delivered).toBe(1);
  const calls = paths.mock.calls.length;
  expect((await consumer.drain()).delivered).toBe(0);
  expect(paths).toHaveBeenCalledTimes(calls);
  expect(
    await observer`select revision,confirmed_state from source_availability_observations where song_id=${songId(0)}::uuid`,
  ).toEqual([{ revision: 2, confirmed_state: "unavailable" }]);
});

it("reconciliação real atualiza dois Temas/revisão persistida e duplicata sem mudança não gera efeito", async () => {
  await observer`delete from theme_songs where song_id=${songId(0)}::uuid`;
  const reference = "cat08new000",
    track = {
      providerContentId: reference,
      sourceTitle: "Old",
      sourceChannel: "QA",
      thumbnailUrl: "/qa.jpg",
      durationSeconds: 180,
      isEmbeddable: true,
      isRegionAllowed: true,
    };
  const entered = gate(),
    release = gate();
  const observe = vi.fn(async () => {
    entered.resolve();
    await release.promise;
    return { type: "available" as const, reason: "available" as const, track };
  });
  const consumer = createCatalogInvalidationConsumer({
    database: () => database,
    clock: () => new Date(),
    invalidatePath: vi.fn(),
  });
  const afterCommit = vi.fn(() => consumer.drain());
  const source = createSourceAvailabilityService({
    afterCommit,
    assertWriteAllowed: () => assertCatalogHealthWriteAllowed(database),
    clock: () => new Date(now.getTime() + 1),
    findSource: findSourceAvailabilityByProviderContentId,
    persistObservation: persistSourceAvailabilityObservation,
    metrics: { record: vi.fn() },
    provider: { observe },
  });
  const global = source.observeSource(reference, { themeId: themeIds[0] });
  void global.catch(() => {});
  await entered.promise;
  try {
    vi.stubEnv("CATALOG_GLOBAL_HEALTH_WRITE_MODE", undefined);
    await persistSourceAvailabilityObservation({
      providerContentId: reference,
      track: null,
      observation: applySourceAvailabilityResult({
        current: null,
        observedAt: new Date(now.getTime() + 2),
        result: { type: "unavailable", reason: "not_found", track: null },
      }),
    });
    for (const themeId of themeIds)
      await themeRepository.importPlaylistTracks(
        themeId,
        [{ ...track, sourceTitle: "Legacy current" }],
        {
          providerContentIdsToAssociate: [reference],
          providerContentIdsToCountAsExisting: [],
        },
      );
  } finally {
    vi.stubEnv("CATALOG_GLOBAL_HEALTH_WRITE_MODE", "enabled");
    release.resolve();
  }
  const result = await global;
  expect(result.applied).toBe(false);
  expect(result.observation.revision).toBe(1);
  expect(result.track?.sourceTitle).toBe("Legacy current");
  expect(observe).toHaveBeenCalledExactlyOnceWith(reference, "BR");
  expect(afterCommit).toHaveBeenCalledTimes(1);
  expect(
    await observer`select unknown,unavailable,playable_count,operational_state from theme_state_projections order by theme_id`,
  ).toEqual(
    themeIds.map(() => ({
      unknown: 0,
      unavailable: 1,
      playable_count: 3,
      operational_state: "suspended_insufficient_healthy_entries",
    })),
  );
  const events =
    await observer`select * from catalog_invalidation_outbox order by theme_id`;
  expect(events).toHaveLength(2);
  expect(
    events.every(
      (event) => event.revision === 1 && event.processed_at !== null,
    ),
  ).toBe(true);
  const current = await findSourceAvailabilityByProviderContentId(
    reference,
    "BR",
  );
  if (!current?.observation) throw new Error("Bound reconciliation missing");
  await database.insert(schema.unboundSourceAvailabilityObservations).values({
    ...current.observation,
    sourceKeyHash: events[0].source_key_hash,
  });
  const before =
    await observer`select * from theme_state_projections order by theme_id`;
  await persistSourceAvailabilityObservation({
    providerContentId: reference,
    track,
    normalizedResult: { type: "available", reason: "available", track },
    observation: applySourceAvailabilityResult({
      current: null,
      observedAt: new Date(now.getTime() + 1),
      result: { type: "available", reason: "available", track },
    }),
  });
  expect(
    await observer`select * from catalog_invalidation_outbox order by theme_id`,
  ).toEqual(events);
  expect(
    await observer`select * from theme_state_projections order by theme_id`,
  ).toEqual(before);
  expect(
    await observer`select * from unbound_source_availability_observations`,
  ).toEqual([]);
});

it("observações concorrentes reais usam predecessor sob lock; resposta antiga não regride saúde nem metadata", async () => {
  const original = await findSourceAvailabilityByProviderContentId(
    "cat08-0",
    "BR",
  );
  if (!original?.track) throw new Error("Source fixture missing");
  const held = gate(),
    release = gate();
  let first = true;
  boundary.database.mockReturnValue(
    new Proxy(database, {
      get(target, property, receiver) {
        if (property === "transaction")
          return (operation: Parameters<typeof database.transaction>[0]) => {
            if (!first) return database.transaction(operation);
            first = false;
            return database.transaction(async (tx) => {
              const result = await operation(tx);
              held.resolve();
              await release.promise;
              return result;
            });
          };
        return Reflect.get(target, property, receiver);
      },
    }),
  );
  const delayed = gate(),
    finishDelayed = gate();
  const oldProvider = missingProvider(),
    newProvider = missingProvider();
  const delayedProvider = vi.fn(async () => {
    delayed.resolve();
    await finishDelayed.promise;
    return {
      type: "available" as const,
      reason: "available" as const,
      track: { ...original.track!, sourceTitle: "Must not replace metadata" },
    };
  });
  const make = (
    offset: number,
    observe: SourceAvailabilityProvider["observe"],
  ) =>
    createSourceAvailabilityService({
      assertWriteAllowed: () => assertCatalogHealthWriteAllowed(database),
      clock: () => new Date(now.getTime() + offset),
      findSource: findSourceAvailabilityByProviderContentId,
      persistObservation: persistSourceAvailabilityObservation,
      metrics: { record: vi.fn() },
      provider: { observe },
    });
  const old = make(10, oldProvider).observeSource("cat08-0");
  void old.catch(() => {});
  await held.promise;
  const newest = make(30, newProvider).observeSource("cat08-0");
  void newest.catch(() => {});
  const middle = make(20, delayedProvider).observeSource("cat08-0");
  void middle.catch(() => {});
  await delayed.promise;
  release.resolve();
  await old;
  expect((await newest).applied).toBe(true);
  finishDelayed.resolve();
  expect((await middle).applied).toBe(false);
  const source = await findSourceAvailabilityByProviderContentId(
    "cat08-0",
    "BR",
  );
  expect(source?.observation).toMatchObject({
    revision: 3,
    confirmedState: "unavailable",
    observedAt: new Date(now.getTime() + 30),
  });
  expect(source?.track?.sourceTitle).toBe("QA");
  for (const provider of [oldProvider, newProvider, delayedProvider])
    expect(provider).toHaveBeenCalledExactlyOnceWith("cat08-0", "BR");
  expect(
    await observer`select count(*)::int as rows from catalog_invalidation_outbox`,
  ).toEqual([{ rows: 4 }]);
});

it.each([32, 64] as const)(
  "editorial concorrente real de %i mantém causa distinta da saúde global",
  async (size) => {
    const fixtures = drizzle(setup, { schema }),
      extras = Array.from({ length: size - 4 }, (_, i) => i + 7);
    await fixtures.insert(schema.songs).values(
      extras.map((index) => ({
        id: songId(index),
        provider: "youtube" as const,
        providerContentId: "cat08-extra-" + index,
        sourceTitle: "QA",
        sourceChannel: "QA",
        thumbnailUrl: "/qa.jpg",
        durationSeconds: 180,
        isEmbeddable: true,
      })),
    );
    const [observation] = await fixtures
      .select()
      .from(schema.sourceAvailabilityObservations);
    await fixtures
      .insert(schema.sourceAvailabilityObservations)
      .values(
        extras.map((index) => ({ ...observation, songId: songId(index) })),
      );
    for (const themeId of themeIds) {
      await fixtures.insert(schema.themeSongs).values(
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
    const reached = gate(),
      release = gate();
    let first = true;
    boundary.database.mockReturnValue(
      new Proxy(database, {
        get(target, property, receiver) {
          if (property === "transaction")
            return (operation: Parameters<typeof database.transaction>[0]) => {
              if (!first) return database.transaction(operation);
              first = false;
              return database.transaction(async (tx) => {
                const result = await operation(tx);
                reached.resolve();
                await release.promise;
                return result;
              });
            };
          return Reflect.get(target, property, receiver);
        },
      }),
    );
    const record = vi.fn(),
      content = createThemeContentService({
        ...themeRepository,
        observeSourceAvailability:
          unavailableService(missingProvider()).observeSource,
        clock: () => now,
        recordThemeStateEvent: record,
      });
    const edit = content.removeThemeSong(themeIds[0], songId(extras.at(-1)!));
    void edit.catch(() => {});
    await reached.promise;
    const health =
      unavailableService(missingProvider()).observeSource("cat08-0");
    void health.catch(() => {});
    try {
      await waitForLock();
    } finally {
      release.resolve();
    }
    await edit;
    await health;
    expect(
      record.mock.calls
        .map(([event]) => event)
        .find((event) => event.type === "primary_modes_changed"),
    ).toMatchObject({ cause: "editorial", lostPrimaryModes: [size] });
    const events = await observer<
      { payload: SourceHealthInvalidation }[]
    >`select payload from catalog_invalidation_outbox order by theme_id`;
    expect(events[0].payload).toMatchObject({
      cause: "health_change",
      transition: { lostPrimaryModes: [] },
    });
    expect(events[1].payload).toMatchObject({
      cause: "health_change",
      transition: { lostPrimaryModes: [size] },
    });
    expect(
      await observer`select editorial_state,playable_count from theme_state_projections order by theme_id`,
    ).toEqual([
      { editorial_state: "published", playable_count: size - 2 },
      { editorial_state: "published", playable_count: size - 1 },
    ]);
  },
);

it("playlist real reverte observações/fontes/associação/outbox quando a projeção final falha", async () => {
  const reference = "cat08new001",
    track = {
      providerContentId: reference,
      sourceTitle: "QA",
      sourceChannel: "QA",
      thumbnailUrl: "/qa.jpg",
      durationSeconds: 180,
      isEmbeddable: true,
      isRegionAllowed: true,
    };
  const snapshot = async () => ({
    songs: await observer`select * from songs order by id`,
    entries:
      await observer`select * from theme_songs order by theme_id,song_id`,
    observations:
      await observer`select * from source_availability_observations order by song_id`,
    unbound:
      await observer`select * from unbound_source_availability_observations`,
    projections:
      await observer`select * from theme_state_projections order by theme_id`,
    outbox: await observer`select * from catalog_invalidation_outbox`,
    marker: await observer`select * from catalog_global_health_activation`,
  });
  const before = await snapshot();
  await setup.unsafe(
    `alter table theme_state_projections add constraint cat08_reject_playlist_final check (theme_id <> '${themeIds[0]}'::uuid or playable_count <> 4 or unavailable <> 1) not valid`,
  );
  try {
    await expect(
      themeRepository.importPlaylistTracks(themeIds[0], [track], {
        expectedWriteMode: "enabled",
        normalizedAttempts: normalizePlaylistAvailability(
          ["cat08-0", reference],
          [track],
          new Date(now.getTime() + 1),
        ),
        providerContentIdsToAssociate: [reference],
        providerContentIdsToCountAsExisting: [],
      }),
    ).rejects.toThrow();
    expect(await snapshot()).toEqual(before);
  } finally {
    await setup.unsafe(
      "alter table theme_state_projections drop constraint cat08_reject_playlist_final",
    );
  }
});

it("índices reais cobrem Fonte/Entradas, Tema/Entradas, revisão e pending outbox", async () => {
  const names = [
    "theme_songs_source_theme_idx",
    "theme_songs_theme_active_idx",
    "source_availability_revision_idx",
    "catalog_invalidation_pending_idx",
  ];
  const rows =
    await observer`select c.relname as name,i.indisvalid as valid,i.indisready as ready,pg_get_indexdef(i.indexrelid) as definition from pg_index i join pg_class c on c.oid=i.indexrelid where c.relname in ${observer(names)} order by c.relname`;
  expect(rows).toHaveLength(4);
  expect(rows.every((row) => row.valid && row.ready)).toBe(true);
  expect(rows.find((row) => row.name === names[0])?.definition).toContain(
    "(song_id, theme_id)",
  );
  expect(rows.find((row) => row.name === names[1])?.definition).toContain(
    "(theme_id, is_active)",
  );
  expect(rows.find((row) => row.name === names[2])?.definition).toContain(
    "(song_id, region, revision)",
  );
  expect(rows.find((row) => row.name === names[3])?.definition).toContain(
    "(available_at, created_at, id) WHERE (processed_at IS NULL)",
  );
});
