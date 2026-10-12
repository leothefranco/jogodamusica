import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { GET } from "@/app/api/resultados/[sessionId]/imagem/route";

const boundary = vi.hoisted(() => ({ database: vi.fn() }));
vi.mock("@/db", () => ({ getDatabase: boundary.database }));
const client = new PGlite();
const database = drizzle(client, { schema });
const sessionId = "10000000-0000-4000-8000-000000000058";
const themeId = "20000000-0000-4000-8000-000000000058";
const songId = "30000000-0000-4000-8000-000000000058";

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
    await client.exec(readFileSync("drizzle/" + entry.tag + ".sql", "utf8"));
  }
  boundary.database.mockReturnValue(database);
  await database.insert(schema.themes).values({
    id: themeId,
    name: "Noites de música",
    slug: "noites-de-musica",
    editorialState: "draft",
  });
  await database.insert(schema.songs).values({
    id: songId,
    provider: "youtube",
    providerContentId: "lts03-song1",
    sourceTitle: "Luzes da cidade",
    sourceChannel: "Aurora",
    thumbnailUrl: "/local-cover.png",
    durationSeconds: 180,
    isEmbeddable: true,
  });
  await database.insert(schema.gameSessions).values({
    id: sessionId,
    themeId,
    bracketSize: 4,
    status: "completed",
    currentRound: 2,
    championSongId: songId,
    completedAt: new Date("2026-10-11T20:00:00Z"),
  });
  await database.insert(schema.sessionSongs).values({
    sessionId,
    songId,
    seed: 1,
    title: "Luzes da cidade",
    artist: "Aurora",
    thumbnailUrl: "/local-cover.png",
    provider: "youtube",
    providerContentId: "lts03-song1",
    startTimeSeconds: 0,
    previewDurationSeconds: 30,
  });
}, 30_000);
afterAll(async () => {
  await client.close();
});

describe("endpoint real da imagem de resultado", () => {
  it("mantém a URL histórica e baixa PNG 1080x1920 com o prefixo Last Track Standing", async () => {
    const response = await GET(
      new Request(
        "https://lasttrack.example/api/resultados/" +
          sessionId +
          "/imagem?download=1",
      ),
      { params: Promise.resolve({ sessionId }) },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="last-track-standing-' + sessionId + '.png"',
    );
    expect(response.headers.get("Content-Type")).toBe("image/png");
    const png = Buffer.from(await response.arrayBuffer());
    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
    expect(png.readUInt32BE(16)).toBe(1080);
    expect(png.readUInt32BE(20)).toBe(1920);
    if (process.env.LTS03_ARTIFACT_DIR) {
      mkdirSync(process.env.LTS03_ARTIFACT_DIR, { recursive: true });
      writeFileSync(
        join(process.env.LTS03_ARTIFACT_DIR, "result-normal.png"),
        png,
      );
    }
  }, 30_000);
  it("renderiza identificação completa com título/artista/tema longos sem mudar o endereço canônico", async () => {
    const title =
      "Canção do último encontro entre as luzes da cidade e os caminhos do amanhecer "
        .repeat(3)
        .slice(0, 200);
    const artist = "Orquestra das lembranças e do horizonte que nunca termina "
      .repeat(4)
      .slice(0, 200);
    const theme =
      "Canções que atravessam gerações e acompanham nossas noites de música, encontros e memórias compartilhadas";
    await database
      .update(schema.sessionSongs)
      .set({ title, artist })
      .where(eq(schema.sessionSongs.sessionId, sessionId));
    await database
      .update(schema.themes)
      .set({ name: theme })
      .where(eq(schema.themes.id, themeId));
    const response = await GET(
      new Request(
        "https://lasttrack.example/api/resultados/" + sessionId + "/imagem",
      ),
      { params: Promise.resolve({ sessionId }) },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toBeNull();
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=3600, stale-while-revalidate=86400",
    );
    const png = Buffer.from(await response.arrayBuffer());
    expect(png.readUInt32BE(16)).toBe(1080);
    expect(png.readUInt32BE(20)).toBe(1920);
    if (process.env.LTS03_ARTIFACT_DIR) {
      writeFileSync(
        join(process.env.LTS03_ARTIFACT_DIR, "result-long.png"),
        png,
      );
      writeFileSync(
        join(process.env.LTS03_ARTIFACT_DIR, "result-long-content.json"),
        JSON.stringify(
          {
            title,
            artist,
            theme,
            resultUrl: "https://lasttrack.example/resultado/" + sessionId,
          },
          null,
          2,
        ),
      );
    }
  }, 30_000);

  it("recusa gerar imagem para partida ainda ativa", async () => {
    await database
      .update(schema.gameSessions)
      .set({ status: "active", championSongId: null })
      .where(eq(schema.gameSessions.id, sessionId));
    const response = await GET(
      new Request(
        "https://lasttrack.example/api/resultados/" +
          sessionId +
          "/imagem?download=1",
      ),
      { params: Promise.resolve({ sessionId }) },
    );
    expect(response.status).toBe(404);
    expect(await response.text()).toBe(
      "O resultado ainda não está disponível.",
    );
    expect(response.headers.get("Content-Disposition")).toBeNull();
  });
});
