import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import {
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  expect,
  it,
  vi,
} from "vitest";
import * as schema from "@/db/schema";
import {
  createGameSession,
  getGameState,
} from "@/server/services/game-service";
import { POST } from "@/app/api/games/route";
import { eq } from "drizzle-orm";
import { decideMatch } from "@/server/services/game-service";
import { applySourceAvailabilityResult } from "@/domain/music/source-availability";
import { persistSourceAvailabilityObservation } from "@/server/repositories/source-availability-repository";
import { postgresRowsAdapter } from "../support/postgres-rows-adapter";
import { createGameService } from "@/server/services/game-service";
import {
  getGameStateRecord,
  withGameCreationTransaction,
} from "@/server/repositories/game-repository";
import type { GameCreationMetric } from "@/server/repositories/game-creation-metrics";

const boundary = vi.hoisted(() => ({ database: vi.fn() }));
vi.mock("@/db", () => ({ getDatabase: boundary.database }));
const client = new PGlite();
const database = drizzle(client, { schema });
const themeId = "10000000-0000-4000-8000-000000000001";
const now = new Date("2026-10-05T00:00:00Z");
const songId = (i: number) =>
  `20000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
beforeAll(async () => {
  await client.exec("create role anon; create role authenticated;");
  const journal = JSON.parse(
    readFileSync("drizzle/meta/_journal.json", "utf8"),
  ) as { entries: { idx: number; tag: string }[] };
  for (const entry of journal.entries.filter(
    ({ idx }) => idx <= 6 || idx >= 10,
  )) {
    await client.exec(readFileSync(`drizzle/${entry.tag}.sql`, "utf8"));
  }
});
afterAll(() => client.close());
beforeEach(async () => {
  boundary.database.mockReturnValue(database);
  vi.stubEnv(
    "RATE_LIMIT_KEY_SECRET",
    "cat06-local-fixture-only-0000000000000000",
  );
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("PUBLIC_CATALOG_READ_MODE", "authoritative_direct");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  await client.exec(
    "truncate rate_limit_buckets, game_matches, session_songs, game_sessions, theme_songs, source_availability_observations, songs, themes cascade",
  );
  await database.insert(schema.themes).values({
    id: themeId,
    name: "Tema",
    slug: "tema",
    isActive: true,
    editorialState: "published",
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
async function seed(count: number) {
  await database.insert(schema.songs).values(
    Array.from({ length: count }, (_, i) => ({
      id: songId(i),
      provider: "youtube" as const,
      providerContentId: `fixture-${i}`,
      sourceTitle: "Privado",
      sourceChannel: "Privado",
      thumbnailUrl: "/icon.svg",
      durationSeconds: 180,
      isEmbeddable: false,
    })),
  );
  await database.insert(schema.themeSongs).values(
    Array.from({ length: count }, (_, i) => ({
      themeId,
      songId: songId(i),
      title: `Título ${i}`,
      artist: "Artista",
      startTimeSeconds: i,
      previewDurationSeconds: 30,
      isActive: true,
    })),
  );
  await database.insert(schema.sourceAvailabilityObservations).values(
    Array.from({ length: count }, (_, i) => ({
      songId: songId(i),
      region: "BR",
      confirmedState: "available" as const,
      confirmationReason: "available" as const,
      observedAt: now,
      lastAttemptAt: now,
      lastConfirmedAt: now,
      validUntil: now,
      graceUntil: new Date("2026-10-06T00:00:00Z"),
      nextCheckAt: now,
      policyVersion: 1,
      revision: 1,
    })),
  );
}
it("autoriza pelos dados-base e persiste quatro snapshots apesar do booleano legado da Fonte", async () => {
  await seed(4);
  const { sessionId } = await createGameSession({ themeId, bracketSize: 4 });
  const state = await getGameState(sessionId);
  expect(state.songs).toHaveLength(4);
  expect(state.matches).toHaveLength(3);
  expect(state.session.startedAt).toEqual(now);
});
const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/games", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
it("rejeita campos internos na rota real sem persistir", async () => {
  await seed(4);
  const response = await post({
    themeId,
    bracketSize: 4,
    region: "US",
    policyVersion: 99,
    sourceIds: [],
  });
  expect(response.status).toBe(400);
  expect(await database.select().from(schema.gameSessions)).toHaveLength(0);
});
it("rascunho e insuficiência têm o mesmo conflito público seguro", async () => {
  await seed(3);
  const insufficient = await post({ themeId, bracketSize: 4 });
  await database
    .update(schema.themes)
    .set({ editorialState: "draft", isActive: false })
    .where(eq(schema.themes.id, themeId));
  const draft = await post({ themeId, bracketSize: 4 });
  expect(draft.status).toBe(409);
  expect(await draft.json()).toEqual(await insufficient.json());
});
it.each(["55P03", "40P01", "40001"])(
  "repete transação abortada %s e confirma uma única sessão",
  async (code) => {
    await seed(4);
    let attempts = 0;
    boundary.database.mockReturnValue({
      transaction: async (
        operation: Parameters<typeof database.transaction>[0],
      ) => {
        attempts++;
        if (attempts === 1)
          throw new Error("driver wrapper", {
            cause: Object.assign(new Error("aborted transaction"), { code }),
          });
        return database.transaction(operation);
      },
    });
    const result = await createGameSession({ themeId, bracketSize: 4 });
    expect(attempts).toBe(2);
    expect(await database.select().from(schema.gameSessions)).toHaveLength(1);
    boundary.database.mockReturnValue(database);
    expect((await getGameState(result.sessionId)).songs).toHaveLength(4);
  },
);
async function expectNoGameRows() {
  expect(await database.select().from(schema.gameSessions)).toHaveLength(0);
  expect(await database.select().from(schema.sessionSongs)).toHaveLength(0);
  expect(await database.select().from(schema.gameMatches)).toHaveLength(0);
}
it.each([4, 8, 16, 32, 64, 128] as const)(
  "modalidade %i exige N candidatas e persiste N snapshots e N-1 confrontos distintos",
  async (bracketSize) => {
    await seed(bracketSize);
    await database
      .update(schema.themeSongs)
      .set({ isActive: false })
      .where(eq(schema.themeSongs.songId, songId(0)));
    await expect(
      createGameSession({ themeId, bracketSize }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_ACTIVE_SONGS", status: 409 });
    await expectNoGameRows();
    await database
      .update(schema.themeSongs)
      .set({ isActive: true })
      .where(eq(schema.themeSongs.songId, songId(0)));
    const { sessionId } = await createGameSession({ themeId, bracketSize });
    const state = await getGameState(sessionId);
    expect(state.session.bracketSize).toBe(bracketSize);
    expect(state.songs).toHaveLength(bracketSize);
    expect(new Set(state.songs.map(({ songId }) => songId)).size).toBe(
      bracketSize,
    );
    expect(state.matches).toHaveLength(bracketSize - 1);
    expect(await database.select().from(schema.gameSessions)).toHaveLength(1);
  },
);
it("fresh e grace inclusivos entram; unavailable, unknown, região diversa e Entrada inativa ficam fora", async () => {
  await seed(9);
  await client.exec(`update source_availability_observations set last_confirmed_at = '2026-10-01Z', valid_until = '2026-10-04Z', grace_until = '2026-10-05Z' where song_id = '${songId(1)}';
    update source_availability_observations set confirmed_state = 'unavailable', confirmation_reason = 'not_found', valid_until = null, grace_until = null where song_id = '${songId(4)}';
    update source_availability_observations set confirmed_state = 'unknown', confirmation_reason = null, last_confirmed_at = null, valid_until = null, grace_until = null where song_id = '${songId(5)}';
    update source_availability_observations set last_confirmed_at = '2026-10-01Z', valid_until = '2026-10-03Z', grace_until = '2026-10-04Z' where song_id = '${songId(6)}';
    update source_availability_observations set region = 'US' where song_id = '${songId(7)}';
    update theme_songs set is_active = false where song_id = '${songId(8)}';`);
  const { sessionId } = await createGameSession({ themeId, bracketSize: 4 });
  const state = await getGameState(sessionId);
  expect(state.songs.map(({ songId }) => songId).sort()).toEqual([
    songId(0),
    songId(1),
    songId(2),
    songId(3),
  ]);
  expect(Object.keys(state.songs[0]).sort()).toEqual(
    [
      "sessionId",
      "songId",
      "seed",
      "title",
      "artist",
      "thumbnailUrl",
      "provider",
      "providerContentId",
      "startTimeSeconds",
      "previewDurationSeconds",
    ].sort(),
  );
});
it("projeção adulterada não autoriza N-1 candidatas nem rascunho", async () => {
  await seed(3);
  await client.exec(
    `create table if not exists theme_projection (theme_id uuid, playable_count integer, visibility text); truncate theme_projection; insert into theme_projection values ('${themeId}', 100000, 'visible');`,
  );
  await expect(
    createGameSession({ themeId, bracketSize: 4 }),
  ).rejects.toMatchObject({ code: "INSUFFICIENT_ACTIVE_SONGS" });
  await expectNoGameRows();
});
it.each(["session_songs", "game_matches"])(
  "falha ao inserir %s reverte sessão, snapshots e confrontos",
  async (table) => {
    await seed(4);
    await client.exec(`create function cat06_fail() returns trigger language plpgsql as $$ begin raise exception 'fixture failure'; end $$;
    create trigger cat06_fail before insert on ${table} for each row execute function cat06_fail();`);
    try {
      await expect(
        createGameSession({ themeId, bracketSize: 4 }),
      ).rejects.toThrow();
      await expectNoGameRows();
    } finally {
      await client.exec(
        `drop trigger cat06_fail on ${table}; drop function cat06_fail();`,
      );
    }
  },
);
it("degradação posterior preserva títulos, trechos, pares e decisão já persistida", async () => {
  await seed(4);
  const { sessionId } = await createGameSession({ themeId, bracketSize: 4 });
  const initial = await getGameState(sessionId);
  const decided = await decideMatch({
    sessionId,
    matchId: initial.currentMatch!.id,
    decision: { type: "vote", winnerSongId: initial.currentMatch!.songAId! },
  });
  boundary.database.mockReturnValue(postgresRowsAdapter(database));
  await persistSourceAvailabilityObservation({
    providerContentId: "fixture-0",
    track: null,
    observation: applySourceAvailabilityResult({
      current: null,
      observedAt: now,
      result: { type: "unavailable", reason: "not_found", track: null },
    }),
  });
  await database.update(schema.themeSongs).set({
    title: "Editado",
    startTimeSeconds: 90,
    previewDurationSeconds: 15,
    isActive: false,
  });
  await database
    .update(schema.songs)
    .set({ thumbnailUrl: "/changed.jpg", sourceTitle: "Alterado" });
  await database
    .update(schema.themes)
    .set({ editorialState: "draft", isActive: false });
  const after = await getGameState(sessionId);
  expect(after.songs).toEqual(decided.songs);
  expect(after.matches).toEqual(decided.matches);
  expect(after.session).toEqual(decided.session);
  await expect(
    createGameSession({ themeId, bracketSize: 4 }),
  ).rejects.toMatchObject({ code: "INSUFFICIENT_ACTIVE_SONGS" });
});
it("limita contenção a três tentativas e não repete erro ambíguo de conexão", async () => {
  const failure = vi.fn(async () => {
    throw Object.assign(new Error("timeout"), { code: "55P03" });
  });
  boundary.database.mockReturnValue({ transaction: failure });
  await expect(
    createGameSession({ themeId, bracketSize: 4 }),
  ).rejects.toMatchObject({ code: "CATALOG_BUSY", status: 409 });
  expect(failure).toHaveBeenCalledTimes(3);
  const ambiguous = vi.fn(async () => {
    throw new Error("connection lost after commit");
  });
  boundary.database.mockReturnValue({ transaction: ambiguous });
  await expect(
    createGameSession({ themeId, bracketSize: 4 }),
  ).rejects.toThrow();
  expect(ambiguous).toHaveBeenCalledTimes(1);
});
it("POST anônimo real persiste, exige modalidade explícita e aplica rate limit", async () => {
  await seed(4);
  expect((await post({ themeId })).status).toBe(400);
  const created = await post({ themeId, bracketSize: 4 });
  expect(created.status).toBe(201);
  const body = await created.json();
  expect(Object.keys(body).sort()).toEqual(["sessionId", "url"]);
  expect((await getGameState(body.sessionId)).songs).toHaveLength(4);
  for (let i = 0; i < 18; i++) await post({ themeId });
  const limited = await post({ themeId, bracketSize: 4 });
  expect(limited.status).toBe(429);
  expect(limited.headers.get("retry-after")).toBe("3600");
  expect(await database.select().from(schema.gameSessions)).toHaveLength(1);
});
it.each(["production", "self-hosted"])(
  "mantém produção %s no legado CAT-02",
  async (mode) => {
    await seed(4);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", mode === "production" ? "production" : "");
    await expect(
      createGameSession({ themeId, bracketSize: 4 }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_ACTIVE_SONGS" });
    await expectNoGameRows();
  },
);
it("captura um instante/política BR, não chama provider e não repete commit se a métrica falha", async () => {
  await seed(4);
  const events: GameCreationMetric[] = [];
  const clock = vi.fn(() => now);
  const provider = vi.fn(() => {
    throw new Error("Provider proibido no POST");
  });
  vi.stubGlobal("fetch", provider);
  const service = createGameService({
    getGameState: (id) => getGameStateRecord(id, database),
    now: () => {
      throw new Error("A criação deve reutilizar o instante da transação");
    },
    random: () => 0,
    withGameCreationTransaction: (id, operation, options) =>
      withGameCreationTransaction(
        id,
        operation,
        {
          ...options,
          authoritative: true,
          clock,
          metrics: {
            record(event) {
              events.push(event);
              throw new Error("Exporter fora do ar");
            },
          },
        },
        database,
      ),
    withGameDecisionTransaction: async () => {
      throw new Error("unused");
    },
  });
  try {
    const { sessionId } = await service.createSession({
      themeId,
      bracketSize: 4,
    });
    expect((await service.getState(sessionId)).session.startedAt).toEqual(now);
    expect(clock).toHaveBeenCalledOnce();
    expect(provider).not.toHaveBeenCalled();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      metric: "game_creation",
      result: "created",
      bracketSize: 4,
      policyVersion: 1,
      mode: "authoritative_direct",
    });
    expect(Object.keys(events[0]).sort()).toEqual(
      [
        "metric",
        "result",
        "bracketSize",
        "mode",
        "policyVersion",
        "durationMs",
        "lockMs",
        "readMs",
        "persistMs",
      ].sort(),
    );
    expect(await database.select().from(schema.gameSessions)).toHaveLength(1);
  } finally {
    vi.unstubAllGlobals();
  }
});
it("falha SQL retorna erro seguro sem diagnóstico que exponha IDs", async () => {
  await seed(4);
  const diagnostic = vi.spyOn(console, "error");
  await client.exec(
    `create function cat06_fail() returns trigger language plpgsql as $$ begin raise exception 'source ${songId(0)} unavailable'; end $$; create trigger cat06_fail before insert on session_songs for each row execute function cat06_fail();`,
  );
  try {
    const response = await post({ themeId, bracketSize: 4 });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: {
        code: "GAME_CREATION_FAILED",
        message: "Não foi possível iniciar a partida. Tente novamente.",
        fieldErrors: null,
      },
    });
    expect(diagnostic).not.toHaveBeenCalled();
    await expectNoGameRows();
  } finally {
    diagnostic.mockRestore();
    await client.exec(
      "drop trigger cat06_fail on session_songs; drop function cat06_fail();",
    );
  }
});
