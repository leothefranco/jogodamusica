import { createRequire } from "node:module";

import { drizzle } from "drizzle-orm/postgres-js";
import { describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import {
  buildPlayableThemeQuery,
  createPublicThemeRepository,
  type PlayableThemeRecord,
} from "@/server/repositories/public-theme-repository";

type SQLiteValue = bigint | number | string | null | Uint8Array;
type SQLiteDatabase = {
  aggregate(
    name: string,
    options: {
      start: () => string[];
      step(values: string[], value: string): string[];
      result(values: string[]): string;
    },
  ): void;
  close(): void;
  exec(sql: string): void;
  prepare(sql: string): {
    all(...values: SQLiteValue[]): Record<string, unknown>[];
    run(...values: SQLiteValue[]): unknown;
  };
};

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (location: string) => SQLiteDatabase;
};

function sqliteValue(value: unknown): SQLiteValue {
  if (typeof value === "boolean") return Number(value);
  if (
    value === null ||
    typeof value === "bigint" ||
    typeof value === "number" ||
    typeof value === "string" ||
    value instanceof Uint8Array
  ) {
    return value;
  }
  throw new TypeError(`Parâmetro SQLite não suportado: ${typeof value}`);
}

function executeQuery(
  database: SQLiteDatabase,
  query: ReturnType<typeof buildPlayableThemeQuery>,
): PlayableThemeRecord[] {
  const compiled = query.toSQL();
  const sql = compiled.sql
    .replace(
      /coalesce\(\s*\(array_agg\(([\s\S]*?)\)\)\[1:4\],\s*array\[\]::text\[\]\s*\)/,
      "thumbnail_array_agg($1)",
    )
    .replace(/\$\d+/g, "?");
  const rows = database.prepare(sql).all(...compiled.params.map(sqliteValue));

  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    description: row.description === null ? null : String(row.description),
    coverUrl: row.cover_url === null ? null : String(row.cover_url),
    thumbnailUrls: JSON.parse(String(row.thumbnail_urls)) as string[],
    activeSongCount: Number(row.active_song_count),
  }));
}

function createCatalogDatabase() {
  const database = new DatabaseSync(":memory:");
  database.aggregate("thumbnail_array_agg", {
    start: () => [],
    step(values, value) {
      if (values.length < 4) values.push(value);
      return values;
    },
    result: JSON.stringify,
  });
  database.exec(`
    create table themes (
      id text primary key,
      name text not null,
      slug text not null,
      description text,
      cover_url text,
      is_active integer not null
    );
    create table songs (
      id text primary key,
      thumbnail_url text not null,
      is_embeddable integer not null
    );
    create table theme_songs (
      theme_id text not null,
      song_id text not null,
      is_active integer not null,
      display_order integer,
      created_at text not null
    );
  `);

  const insertTheme = database.prepare(
    "insert into themes (id, name, slug, description, cover_url, is_active) values (?, ?, ?, null, null, ?)",
  );
  const insertSong = database.prepare(
    "insert into songs (id, thumbnail_url, is_embeddable) values (?, ?, ?)",
  );
  const insertThemeSong = database.prepare(
    "insert into theme_songs (theme_id, song_id, is_active, display_order, created_at) values (?, ?, ?, ?, ?)",
  );

  function addTheme(id: string, name: string, isActive = true) {
    insertTheme.run(id, name, id, Number(isActive));
  }

  function addCandidate(
    themeId: string,
    position: number,
    options: { associationActive?: boolean; embeddable?: boolean } = {},
  ) {
    const songId = `${themeId}-song-${position}`;
    insertSong.run(
      songId,
      `https://example.com/${songId}.jpg`,
      Number(options.embeddable ?? true),
    );
    insertThemeSong.run(
      themeId,
      songId,
      Number(options.associationActive ?? true),
      position,
      `2026-08-27T12:00:${String(position).padStart(2, "0")}Z`,
    );
  }

  addTheme("tema-tres", "Apenas três");
  for (let position = 1; position <= 3; position += 1) {
    addCandidate("tema-tres", position);
  }
  addCandidate("tema-tres", 4, { associationActive: false });
  addCandidate("tema-tres", 5, { embeddable: false });

  addTheme("tema-quatro", "Quatro válidas");
  for (let position = 1; position <= 4; position += 1) {
    addCandidate("tema-quatro", position);
  }
  addCandidate("tema-quatro", 5, { associationActive: false });
  addCandidate("tema-quatro", 6, { embeddable: false });

  addTheme("tema-cinco", "Cinco válidas");
  for (let position = 1; position <= 5; position += 1) {
    addCandidate("tema-cinco", position);
  }

  addTheme("tema-inativo", "Editorialmente inativo", false);
  for (let position = 1; position <= 4; position += 1) {
    addCandidate("tema-inativo", position);
  }

  return database;
}

describe("consulta pública agregada de temas", () => {
  it("publica a partir de quatro candidatas válidas e oculta o mesmo slug com três", async () => {
    const sqlite = createCatalogDatabase();
    const queryDatabase = drizzle.mock({ schema });
    const repository = createPublicThemeRepository({
      async executeQuery(query) {
        return executeQuery(sqlite, query);
      },
      getDatabase: () => queryDatabase,
      waitForRequest: async () => undefined,
    });

    try {
      await expect(repository.listPlayableThemes()).resolves.toEqual([
        {
          id: "tema-cinco",
          name: "Cinco válidas",
          slug: "tema-cinco",
          description: null,
          coverUrl: null,
          thumbnailUrls: [
            "https://example.com/tema-cinco-song-1.jpg",
            "https://example.com/tema-cinco-song-2.jpg",
            "https://example.com/tema-cinco-song-3.jpg",
            "https://example.com/tema-cinco-song-4.jpg",
          ],
          activeSongCount: 5,
        },
        {
          id: "tema-quatro",
          name: "Quatro válidas",
          slug: "tema-quatro",
          description: null,
          coverUrl: null,
          thumbnailUrls: [
            "https://example.com/tema-quatro-song-1.jpg",
            "https://example.com/tema-quatro-song-2.jpg",
            "https://example.com/tema-quatro-song-3.jpg",
            "https://example.com/tema-quatro-song-4.jpg",
          ],
          activeSongCount: 4,
        },
      ]);
      await expect(
        repository.findPlayableThemeBySlug("tema-tres"),
      ).resolves.toBeNull();
      await expect(repository.findPlayableThemeBySlug("")).resolves.toBeNull();
      await expect(
        repository.findPlayableThemeBySlug("tema-quatro"),
      ).resolves.toMatchObject({
        activeSongCount: 4,
        thumbnailUrls: [
          "https://example.com/tema-quatro-song-1.jpg",
          "https://example.com/tema-quatro-song-2.jpg",
          "https://example.com/tema-quatro-song-3.jpg",
          "https://example.com/tema-quatro-song-4.jpg",
        ],
      });
    } finally {
      sqlite.close();
    }
  });
});
