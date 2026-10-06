import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, beforeEach, afterAll, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { createGameService } from "@/server/services/game-service";
import {
  getGameStateRecord,
  withGameCreationTransaction,
} from "@/server/repositories/game-repository";
vi.mock("@/db", () => ({ getDatabase: vi.fn() }));
const themeId = "10000000-0000-4000-8000-000000000001";
const client = new PGlite();
const database = drizzle(client, { schema });
const journal = JSON.parse(
  readFileSync("drizzle/meta/_journal.json", "utf8"),
) as { entries: { idx: number; tag: string }[] };
beforeAll(async () => {
  await client.exec("create role anon; create role authenticated;");
  for (const entry of journal.entries.filter(({ idx }) => idx <= 6))
    await client.exec(readFileSync(`drizzle/${entry.tag}.sql`, "utf8"));
});
afterAll(() => client.close());
beforeEach(async () => {
  await client.exec(
    "truncate game_matches, session_songs, game_sessions, theme_songs, songs, themes cascade",
  );
  await client.query(
    "insert into themes(id,name,slug,is_active) values ($1,'Legado','legado',true)",
    [themeId],
  );
  for (let i = 0; i < 4; i++) {
    const id = `20000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
    await client.query(
      "insert into songs(id,provider,provider_content_id,source_title,source_channel,thumbnail_url,duration_seconds,is_embeddable) values ($1,'youtube',$2,'Fonte','Canal','/icon.svg',180,true)",
      [id, `legacy-${i}`],
    );
    await client.query(
      "insert into theme_songs(theme_id,song_id,title,artist,start_time_seconds,preview_duration_seconds,is_active) values ($1,$2,'Título','Artista',0,30,true)",
      [themeId, id],
    );
  }
});
it.each([false, true])(
  "cria partida legada com migrations 0–6 e editorial isolada=%s",
  async (editorial) => {
    if (editorial) {
      const migration = journal.entries.find(({ idx }) => idx === 11)!;
      await client.exec(readFileSync(`drizzle/${migration.tag}.sql`, "utf8"));
    }
    const service = createGameService({
      getGameState: (id) => getGameStateRecord(id, database),
      now: () => new Date("2026-10-05T00:00:00Z"),
      random: () => 0,
      withGameCreationTransaction: (id, operation, options) =>
        withGameCreationTransaction(
          id,
          operation,
          { ...options, authoritative: false, metrics: { record() {} } },
          database,
        ),
      withGameDecisionTransaction: async () => {
        throw new Error("unused");
      },
    });
    const { sessionId } = await service.createSession({
      themeId,
      bracketSize: 4,
    });
    const state = await service.getState(sessionId);
    expect(state.songs).toHaveLength(4);
    expect(new Set(state.songs.map(({ songId }) => songId)).size).toBe(4);
    expect(state.matches).toHaveLength(3);
    expect(
      (await client.query("select count(*)::int as count from game_sessions"))
        .rows,
    ).toEqual([{ count: 1 }]);
  },
);
