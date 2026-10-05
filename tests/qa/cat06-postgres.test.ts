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
        const held = holdBeforeCommit();
        const creation = createGameSession({
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
