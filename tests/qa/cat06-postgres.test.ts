import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import * as schema from "@/db/schema";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { importPlaylistTracks } from "@/server/repositories/theme-content-repository";
import {
  createGameSession,
  getGameState,
  createGameService,
} from "@/server/services/game-service";
import {
  withGameCreationTransaction,
  getGameStateRecord,
} from "@/server/repositories/game-repository";
import { persistSourceAvailabilityObservation } from "@/server/repositories/source-availability-repository";
import { applySourceAvailabilityResult } from "@/domain/music/source-availability";
const boundary = vi.hoisted(() => ({ database: vi.fn() }));
vi.mock("@/db", () => ({ getDatabase: boundary.database }));
const enabled = Boolean(process.env.CAT06_POSTGRES_ADMIN_URL);
const now = new Date();
const themeId = "10000000-0000-4000-8000-000000000001";
const secondThemeId = "10000000-0000-4000-8000-000000000002";
const songId = (i: number) =>
  `20000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
function gate() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
const databaseName = `cat06_qa_${randomUUID().replaceAll("-", "")}`;
let admin: ReturnType<typeof postgres>;
let connection: ReturnType<typeof postgres>;
let observer: ReturnType<typeof postgres>;
let database: ReturnType<typeof drizzle<typeof schema>>;
async function waitForLock() {
  const deadline = Date.now() + 1500;
  while (Date.now() < deadline) {
    const rows =
      await observer`select pid from pg_stat_activity where datname = ${databaseName} and wait_event_type = 'Lock'`;
    if (rows.length) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("No PostgreSQL lock waiter observed");
}
function holdBeforeCommit() {
  const reached = gate(),
    release = gate();
  boundary.database.mockReturnValueOnce({
    transaction: (operation: Parameters<typeof database.transaction>[0]) =>
      database.transaction(async (tx) => {
        const result = await operation(tx);
        reached.resolve();
        await release.promise;
        return result;
      }),
  });
  return { reached, release };
}
const unavailable = () =>
  persistSourceAvailabilityObservation({
    providerContentId: "qa-0",
    track: null,
    observation: applySourceAvailabilityResult({
      current: null,
      observedAt: new Date(),
      result: { type: "unavailable", reason: "not_found", track: null },
    }),
  });
async function noGames() {
  const [counts] =
    await connection`select (select count(*)::int from game_sessions) sessions, (select count(*)::int from session_songs) snapshots, (select count(*)::int from game_matches) matches`;
  expect(counts).toEqual({ sessions: 0, snapshots: 0, matches: 0 });
}
describe.skipIf(!enabled)(
  "CAT-06 PostgreSQL descartável: concorrência real",
  () => {
    beforeAll(async () => {
      const url = new URL(process.env.CAT06_POSTGRES_ADMIN_URL!);
      if (
        process.env.CAT06_QA_DISPOSABLE !== "1" ||
        !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
        !["postgres:", "postgresql:"].includes(url.protocol)
      )
        throw new Error(
          "QA requires explicit disposable loopback PostgreSQL; remote databases are refused",
        );
      admin = postgres(url.toString(), { max: 1, onnotice: () => {} });
      await admin.unsafe(`create database "${databaseName}"`);
      url.pathname = `/${databaseName}`;
      connection = postgres(url.toString(), { max: 5, onnotice: () => {} });
      observer = postgres(url.toString(), { max: 1, onnotice: () => {} });
      database = drizzle(connection, { schema });
      await connection.unsafe(
        "do $$ begin if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if; if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if; end $$;",
      );
      const journal = JSON.parse(
        readFileSync("drizzle/meta/_journal.json", "utf8"),
      ) as { entries: { idx: number; tag: string }[] };
      for (const entry of journal.entries.filter(
        ({ idx }) => idx <= 6 || idx >= 10,
      ))
        await connection.unsafe(
          readFileSync(`drizzle/${entry.tag}.sql`, "utf8"),
        );
    });
    afterAll(async () => {
      vi.unstubAllEnvs();
      await connection?.end();
      await observer?.end();
      if (admin) {
        await admin.unsafe(`drop database if exists "${databaseName}"`);
        await admin.end();
      }
    });
    beforeEach(async () => {
      boundary.database.mockReset().mockReturnValue(database);
      vi.stubEnv("VERCEL_ENV", "preview");
      vi.stubEnv("PUBLIC_CATALOG_READ_MODE", "authoritative_direct");
      await connection.unsafe(
        "truncate game_matches, session_songs, game_sessions, theme_songs, source_availability_observations, songs, themes cascade",
      );
      await database.insert(schema.themes).values(
        [themeId, secondThemeId].map((id, i) => ({
          id,
          name: `QA ${i}`,
          slug: `qa-${i}`,
          editorialState: "published" as const,
          isActive: true,
        })),
      );
      await database.insert(schema.songs).values(
        Array.from({ length: 64 }, (_, i) => ({
          id: songId(i),
          provider: "youtube" as const,
          providerContentId: `qa-${i}`,
          sourceTitle: "QA",
          sourceChannel: "QA",
          thumbnailUrl: "/icon.svg",
          durationSeconds: 180,
          isEmbeddable: false,
        })),
      );
      await database.insert(schema.themeSongs).values(
        [themeId, secondThemeId].flatMap((id) =>
          Array.from({ length: 64 }, (_, i) => ({
            themeId: id,
            songId: songId(i),
            title: "QA",
            artist: "QA",
            previewDurationSeconds: 30,
          })),
        ),
      );
      await database.insert(schema.sourceAvailabilityObservations).values(
        Array.from({ length: 64 }, (_, i) => ({
          songId: songId(i),
          ...applySourceAvailabilityResult({
            current: null,
            observedAt: now,
            result: {
              type: "available",
              reason: "available",
              track: {
                providerContentId: `qa-${i}`,
                sourceTitle: "QA",
                sourceChannel: "QA",
                thumbnailUrl: "/icon.svg",
                durationSeconds: 180,
                isEmbeddable: true,
                isRegionAllowed: true,
              },
            },
          }),
        })),
      );
    });
    for (const size of [32, 64] as const) {
      it(`criação ${size} vence a corrida: snapshot completo anterior à indisponibilidade`, async () => {
        await connection`delete from theme_songs where song_id in (select id from songs order by id offset ${size})`;
        const held = holdBeforeCommit();
        const service = createGameService({
          getGameState: (id) => getGameStateRecord(id, database),
          now: () => new Date(),
          random: () => 0,
          withGameCreationTransaction: (id, operation, options) =>
            withGameCreationTransaction(id, operation, options),
          withGameDecisionTransaction: async () => {
            throw new Error("unused");
          },
        });
        const creation = service.createSession({
          themeId: secondThemeId,
          bracketSize: size,
        });
        await held.reached.promise;
        const health = unavailable();
        try {
          await waitForLock();
        } finally {
          held.release.resolve();
        }
        const [{ sessionId }] = await Promise.all([creation, health]);
        const state = await getGameState(sessionId);
        expect(state.songs).toHaveLength(size);
        expect(state.songs.some((song) => song.songId === songId(0))).toBe(
          true,
        );
        expect(state.matches).toHaveLength(size - 1);
        const [count] =
          await connection`select count(*)::int as count from game_sessions`;
        expect(count.count).toBe(1);
      });
      it(`saúde vence a corrida ${size}: recusa integral após releitura`, async () => {
        await connection`delete from theme_songs where song_id in (select id from songs order by id offset ${size})`;
        const held = holdBeforeCommit();
        const health = unavailable();
        await held.reached.promise;
        const creation = createGameSession({
          themeId: secondThemeId,
          bracketSize: size,
        }).catch((error) => error);
        try {
          await waitForLock();
        } finally {
          held.release.resolve();
        }
        await health;
        expect(await creation).toMatchObject({
          code: "INSUFFICIENT_ACTIVE_SONGS",
          status: 409,
        });
        await noGames();
      });
    }
    for (const first of ["creation", "import"] as const) {
      it(`criação A e importação B [s2,s1], primeiro=${first}: sem deadlock ou estado parcial`, async () => {
        await connection`delete from theme_songs where song_id in (select id from songs order by id offset 4)`;
        const tracks = [1, 0].map((i) => ({
          providerContentId: `qa-${i}`,
          sourceTitle: "Atualizado",
          sourceChannel: "Novo canal",
          thumbnailUrl: "/updated.svg",
          durationSeconds: 180,
          isEmbeddable: true,
          isRegionAllowed: true,
        }));
        const importing = () =>
          importPlaylistTracks(secondThemeId, tracks, {
            providerContentIdsToAssociate: ["qa-1", "qa-0"],
            providerContentIdsToCountAsExisting: [],
          });
        const events: string[] = [];
        const service = createGameService({
          getGameState: (id) => getGameStateRecord(id, database),
          now: () => new Date(),
          random: () => 0,
          withGameCreationTransaction: (id, operation, options) =>
            withGameCreationTransaction(id, operation, {
              ...options,
              metrics: {
                record(event) {
                  events.push(event.result);
                },
              },
            }),
          withGameDecisionTransaction: async () => {
            throw new Error("unused");
          },
        });
        let creation: ReturnType<typeof service.createSession>;
        let imported: ReturnType<typeof importing>;
        if (first === "creation") {
          const reached = gate(),
            release = gate();
          const dialect = new PgDialect();
          let paused = false;
          // The real transaction is paused at the SQL boundary after locking s1.
          // No SQL result or lock is simulated; B runs on an independent connection.
          boundary.database.mockReturnValueOnce({
            transaction: (
              operation: Parameters<typeof database.transaction>[0],
            ) =>
              database.transaction((tx) =>
                operation(
                  new Proxy(tx, {
                    get(target, key, receiver) {
                      if (key === "execute")
                        return async (query: SQL) => {
                          const result = await target.execute(query);
                          const statement = dialect.sqlToQuery(query);
                          if (
                            !paused &&
                            statement.sql.includes("from public.songs") &&
                            statement.sql.includes("for update") &&
                            statement.params.includes("qa-0")
                          ) {
                            paused = true;
                            reached.resolve();
                            await release.promise;
                          }
                          return result;
                        };
                      return Reflect.get(target, key, receiver);
                    },
                  }),
                ),
              ),
          });
          creation = service.createSession({ themeId, bracketSize: 4 });
          await reached.promise;
          imported = importing();
          // Attach rejection handlers immediately while both transactions run.
          const completed = Promise.allSettled([creation, imported]);
          completed.catch(() => {});
          try {
            await waitForLock();
          } finally {
            release.resolve();
          }
          const results = await completed;
          for (const result of results) {
            if (result.status === "rejected") throw result.reason;
          }
        } else {
          const held = holdBeforeCommit();
          imported = importing();
          await held.reached.promise;
          creation = service.createSession({ themeId, bracketSize: 4 });
          const completed = Promise.allSettled([creation, imported]);
          completed.catch(() => {});
          try {
            await waitForLock();
          } finally {
            held.release.resolve();
          }
          const results = await completed;
          for (const result of results) {
            if (result.status === "rejected") throw result.reason;
          }
        }
        expect(await imported).toEqual({ added: 0, alreadyAssociated: 2 });
        expect(events).toEqual(["created"]);
        const { sessionId } = await creation;
        const state = await getGameState(sessionId);
        expect(state.songs).toHaveLength(4);
        expect(new Set(state.songs.map((s) => s.songId)).size).toBe(4);
        expect(state.matches).toHaveLength(3);
        expect(state.songs.find((s) => s.songId === songId(0))).toMatchObject({
          title: "QA",
          thumbnailUrl: first === "creation" ? "/icon.svg" : "/updated.svg",
        });
        const [counts] =
          await connection`select (select count(*)::int from game_sessions) sessions, (select count(*)::int from session_songs) snapshots, (select count(*)::int from game_matches) matches, (select count(*)::int from theme_songs where theme_id = ${secondThemeId}) entries, (select count(*)::int from songs where provider_content_id in ('qa-0','qa-1') and source_title = 'Atualizado') updated`;
        expect(counts).toEqual({
          sessions: 1,
          snapshots: 4,
          matches: 3,
          entries: 4,
          updated: 2,
        });
        await importing();
        const after = await getGameState(sessionId);
        expect(after.songs).toEqual(state.songs);
        expect(after.matches).toEqual(state.matches);
      });
    }
    it("saúde persiste datas e reconcilia Fonte/observação inicialmente ausentes", async () => {
      const observedAt = new Date();
      const first = applySourceAvailabilityResult({
        current: null,
        observedAt,
        result: { type: "unavailable", reason: "not_found", track: null },
      });
      const unbound = await persistSourceAvailabilityObservation({
        providerContentId: "qa-new",
        track: null,
        observation: first,
      });
      expect(unbound).toMatchObject({
        songId: null,
        applied: true,
        observation: { observedAt, confirmedState: "unavailable" },
      });
      const track = {
        providerContentId: "qa-new",
        sourceTitle: "Nova",
        sourceChannel: "Canal",
        thumbnailUrl: "/icon.svg",
        durationSeconds: 180,
        isEmbeddable: true,
        isRegionAllowed: true,
      };
      const next = applySourceAvailabilityResult({
        current: unbound.observation,
        observedAt: new Date(observedAt.getTime() + 1000),
        result: { type: "available", reason: "available", track },
      });
      const bound = await persistSourceAvailabilityObservation({
        providerContentId: "qa-new",
        track,
        observation: next,
      });
      expect(bound.songId).toEqual(expect.any(String));
      expect(bound).toMatchObject({
        applied: true,
        previousObservation: { confirmedState: "unavailable" },
        observation: {
          confirmedState: "available",
          observedAt: next.observedAt,
          validUntil: next.validUntil,
          graceUntil: next.graceUntil,
        },
      });
      const [counts] =
        await connection`select (select count(*)::int from songs where provider_content_id = 'qa-new') sources, (select count(*)::int from source_availability_observations where song_id = ${bound.songId}) observations, (select count(*)::int from unbound_source_availability_observations) unbound`;
      expect(counts).toEqual({ sources: 1, observations: 1, unbound: 0 });
      await noGames();
    });
    it("falha real após sessão reverte todas as tabelas de partida", async () => {
      await connection.unsafe(
        "create function cat06_fail() returns trigger language plpgsql as $$ begin raise exception 'fixture'; end $$; create trigger cat06_fail before insert on game_matches for each row execute function cat06_fail();",
      );
      try {
        await expect(
          createGameSession({ themeId, bracketSize: 64 }),
        ).rejects.toMatchObject({ code: "GAME_CREATION_FAILED" });
        await noGames();
      } finally {
        await connection.unsafe(
          "drop trigger cat06_fail on game_matches; drop function cat06_fail();",
        );
      }
    });
    it("timeout real reinicia no máximo três vezes e não duplica commit", async () => {
      const held = holdBeforeCommit();
      const health = unavailable();
      await held.reached.promise;
      const retried = gate();
      const events: string[] = [];
      const service = createGameService({
        getGameState: (id) => getGameStateRecord(id, database),
        now: () => new Date(),
        random: Math.random,
        withGameCreationTransaction: (id, operation, options) =>
          withGameCreationTransaction(
            id,
            operation,
            {
              ...options,
              authoritative: true,
              metrics: {
                record(event) {
                  events.push(event.result);
                  if (event.result === "contention_retry") retried.resolve();
                },
              },
            },
            database,
          ),
        withGameDecisionTransaction: async () => {
          throw new Error("unused");
        },
      });
      const creation = service.createSession({ themeId, bracketSize: 32 });
      try {
        await retried.promise;
      } finally {
        held.release.resolve();
      }
      const [{ sessionId }] = await Promise.all([creation, health]);
      expect((await getGameState(sessionId)).songs).toHaveLength(32);
      expect(
        events.filter((result) => result === "contention_retry"),
      ).toHaveLength(1);
      expect(events.filter((result) => result === "created")).toHaveLength(1);
    });
    it("mudança de dependência durante aquisição reinicia sem locks fora da ordem", async () => {
      await connection`delete from theme_songs where theme_id = ${secondThemeId}`;
      const reached = gate(),
        release = gate();
      const holder = connection.begin(async (sql) => {
        await sql`select id from themes where id = ${themeId} for update`;
        reached.resolve();
        await release.promise;
      });
      await reached.promise;
      let attempts = 0;
      boundary.database.mockReturnValue({
        transaction: (
          operation: Parameters<typeof database.transaction>[0],
        ) => {
          attempts++;
          return database.transaction(operation);
        },
      });
      const health = unavailable();
      try {
        await waitForLock();
        await database.insert(schema.themeSongs).values({
          themeId: secondThemeId,
          songId: songId(0),
          title: "QA",
          artist: "QA",
          previewDurationSeconds: 30,
        });
      } finally {
        release.resolve();
      }
      await Promise.all([holder, health]);
      expect(attempts).toBe(2);
      await noGames();
      const [state] =
        await connection`select confirmed_state from source_availability_observations where song_id = ${songId(0)}`;
      expect(state.confirmed_state).toBe("unavailable");
    });
  },
);
