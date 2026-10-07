import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, afterAll, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { importPlaylistTracks } from "@/server/repositories/theme-content-repository";
import { createGameService } from "@/server/services/game-service";
import {
  getGameStateRecord,
  withGameCreationTransaction,
} from "@/server/repositories/game-repository";
import { postgresRowsAdapter } from "../support/postgres-rows-adapter";
const boundary = vi.hoisted(() => ({ database: vi.fn() }));
vi.mock("@/db", () => ({ getDatabase: boundary.database }));
const client = new PGlite();
const database = drizzle(client, { schema });
beforeAll(async () => {
  await client.exec("create role anon; create role authenticated;");
  const journal = JSON.parse(
    readFileSync("drizzle/meta/_journal.json", "utf8"),
  ) as { entries: { idx: number; tag: string }[] };
  for (const entry of journal.entries.filter(({ idx }) => idx <= 6))
    await client.exec(readFileSync(`drizzle/${entry.tag}.sql`, "utf8"));
});
afterAll(() => client.close());
it("importação legada preserva metadados editoriais, contagens e entradas apesar da ordem inversa das Fontes", async () => {
  const themeId = "10000000-0000-4000-8000-000000000001";
  const track = (id: string, title: string) => ({
    providerContentId: id,
    sourceTitle: title,
    sourceChannel: "Canal",
    thumbnailUrl: "/icon.svg",
    durationSeconds: 180,
    isEmbeddable: true,
    isRegionAllowed: true,
  });
  await client.query(
    "insert into themes(id,name,slug,is_active) values ($1,'Tema','tema',true)",
    [themeId],
  );
  boundary.database.mockReturnValue(postgresRowsAdapter(database));
  const options = {
    providerContentIdsToAssociate: ["s1", "s2", "s3", "s4"],
    providerContentIdsToCountAsExisting: [],
  };
  expect(
    await importPlaylistTracks(
      themeId,
      [track("s4", "D"), track("s3", "C"), track("s2", "B"), track("s1", "A")],
      options,
    ),
  ).toEqual({ added: 4, alreadyAssociated: 0 });
  await client.exec(
    "update theme_songs set title = 'Editorial', artist = 'Curadoria', display_order = 0, start_time_seconds = 10 where song_id in (select id from songs where provider_content_id = 's1')",
  );
  expect(
    await importPlaylistTracks(
      themeId,
      [
        track("s2", "B atualizado"),
        track("s1", "A atualizado"),
        track("s2", "B final"),
      ],
      {
        providerContentIdsToAssociate: ["s2"],
        providerContentIdsToCountAsExisting: ["s1"],
      },
    ),
  ).toEqual({ added: 0, alreadyAssociated: 3 });
  const service = createGameService({
    getGameState: (id) => getGameStateRecord(id, database),
    now: () => new Date(),
    random: () => 0,
    withGameCreationTransaction: (id, op, options) =>
      withGameCreationTransaction(
        id,
        op,
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
  expect(state.songs.find((s) => s.providerContentId === "s1")).toMatchObject({
    title: "Editorial",
    artist: "Curadoria",
    startTimeSeconds: 10,
  });
  expect(state.songs.find((s) => s.providerContentId === "s2")).toMatchObject({
    title: "B",
  });
  expect(
    (
      await client.query(
        "select source_title from songs where provider_content_id='s2'",
      )
    ).rows,
  ).toEqual([{ source_title: "B final" }]);
  expect(
    (
      await client.query<{ provider_content_id: string }>(
        "select s.provider_content_id from theme_songs e join songs s on s.id=e.song_id order by e.display_order asc nulls last, e.title",
      )
    ).rows.map((r) => r.provider_content_id),
  ).toEqual(["s1", "s2", "s3", "s4"]);
  expect(state.songs).toHaveLength(4);
  expect(state.matches).toHaveLength(3);
});
