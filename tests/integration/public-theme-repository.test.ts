import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
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
import type { PlayableThemeRecord } from "@/server/repositories/public-theme-repository";

const systemBoundaries = vi.hoisted(() => ({
  getDatabase: vi.fn(),
  waitForRequest: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/db", () => ({ getDatabase: systemBoundaries.getDatabase }));
vi.mock("next/server", () => ({
  connection: systemBoundaries.waitForRequest,
}));

import {
  findPlayableThemeBySlug,
  listPlayableThemes,
} from "@/server/repositories/public-theme-repository";

const themeIds = {
  three: "10000000-0000-4000-8000-000000000003",
  four: "10000000-0000-4000-8000-000000000004",
  five: "10000000-0000-4000-8000-000000000005",
  inactive: "10000000-0000-4000-8000-000000000006",
};

function songId(index: number) {
  return `20000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

function thumbnailUrl(index: number) {
  return `https://example.com/song-${index}.jpg`;
}

let client: PGlite;
let database: PgliteDatabase<typeof schema>;

async function seedCatalog() {
  await database.insert(schema.themes).values([
    {
      id: themeIds.three,
      name: "Apenas três",
      slug: "tema-tres",
      isActive: true,
    },
    {
      id: themeIds.four,
      name: "Quatro válidas",
      slug: "tema-quatro",
      isActive: true,
    },
    {
      id: themeIds.five,
      name: "Cinco válidas",
      slug: "tema-cinco",
      isActive: true,
    },
    {
      id: themeIds.inactive,
      name: "Tema inativo",
      slug: "tema-inativo",
      isActive: false,
    },
  ]);

  const nonEmbeddableSongs = new Set([5, 11]);
  await database.insert(schema.songs).values(
    Array.from({ length: 20 }, (_, offset) => {
      const index = offset + 1;
      return {
        id: songId(index),
        provider: "youtube" as const,
        providerContentId: `video-${index}`,
        sourceTitle: `Fonte ${index}`,
        sourceChannel: "Canal do teste",
        thumbnailUrl: thumbnailUrl(index),
        durationSeconds: 180,
        isEmbeddable: !nonEmbeddableSongs.has(index),
      };
    }),
  );

  const links: (typeof schema.themeSongs.$inferInsert)[] = [];
  function addLink(
    themeId: string,
    index: number,
    options: { active?: boolean; displayOrder?: number } = {},
  ) {
    links.push({
      themeId,
      songId: songId(index),
      title: `Faixa ${index}`,
      artist: "Artista do teste",
      previewDurationSeconds: 30,
      isActive: options.active ?? true,
      displayOrder: options.displayOrder ?? index,
    });
  }

  [1, 2, 3].forEach((index) => addLink(themeIds.three, index));
  addLink(themeIds.three, 4, { active: false });
  addLink(themeIds.three, 5);

  addLink(themeIds.four, 6, { displayOrder: 40 });
  addLink(themeIds.four, 7, { displayOrder: 10 });
  addLink(themeIds.four, 8, { displayOrder: 30 });
  addLink(themeIds.four, 9, { displayOrder: 20 });
  addLink(themeIds.four, 10, { active: false, displayOrder: 0 });
  addLink(themeIds.four, 11, { displayOrder: 0 });

  [12, 13, 14, 15, 16].forEach((index) => addLink(themeIds.five, index));
  [17, 18, 19, 20].forEach((index) => addLink(themeIds.inactive, index));

  await database.insert(schema.themeSongs).values(links);
}

beforeAll(async () => {
  client = new PGlite();
  database = drizzle(client, { schema });
  await client.exec(`
    create type music_provider as enum ('youtube');
    create table themes (
      id uuid primary key,
      name varchar(120) not null,
      slug varchar(140) not null unique,
      description text,
      cover_url text,
      is_active boolean default false not null,
      created_at timestamptz default now() not null,
      updated_at timestamptz default now() not null
    );
    create table songs (
      id uuid primary key,
      provider music_provider not null,
      provider_content_id varchar(64) not null,
      source_title text not null,
      source_channel text not null,
      thumbnail_url text not null,
      duration_seconds integer not null,
      is_embeddable boolean not null,
      created_at timestamptz default now() not null,
      updated_at timestamptz default now() not null
    );
    create table theme_songs (
      theme_id uuid not null references themes(id),
      song_id uuid not null references songs(id),
      title varchar(200) not null,
      artist varchar(200) not null,
      start_time_seconds integer default 0 not null,
      preview_duration_seconds integer not null,
      is_active boolean default true not null,
      display_order integer,
      created_at timestamptz default now() not null,
      updated_at timestamptz default now() not null,
      primary key (theme_id, song_id)
    );
  `);
  await seedCatalog();
});

afterAll(async () => {
  await client.close();
});

beforeEach(() => {
  vi.clearAllMocks();
  systemBoundaries.getDatabase.mockReturnValue(database);
});

describe("repositório público de temas", () => {
  it("agrega somente candidatas válidas e publica a partir de quatro", async () => {
    await expect(listPlayableThemes()).resolves.toEqual([
      {
        id: "10000000-0000-4000-8000-000000000005",
        name: "Cinco válidas",
        slug: "tema-cinco",
        description: null,
        coverUrl: null,
        thumbnailUrls: [
          "https://example.com/song-12.jpg",
          "https://example.com/song-13.jpg",
          "https://example.com/song-14.jpg",
          "https://example.com/song-15.jpg",
        ],
        activeSongCount: 5,
      },
      {
        id: "10000000-0000-4000-8000-000000000004",
        name: "Quatro válidas",
        slug: "tema-quatro",
        description: null,
        coverUrl: null,
        thumbnailUrls: [
          "https://example.com/song-7.jpg",
          "https://example.com/song-9.jpg",
          "https://example.com/song-8.jpg",
          "https://example.com/song-6.jpg",
        ],
        activeSongCount: 4,
      },
    ] satisfies PlayableThemeRecord[]);
  });

  it("mantém listagem e slug sob a mesma definição publicável", async () => {
    const listedThemes = await listPlayableThemes();
    const listedTheme = listedThemes.find(({ slug }) => slug === "tema-quatro");

    await expect(findPlayableThemeBySlug("tema-quatro")).resolves.toEqual(
      listedTheme,
    );
    await expect(findPlayableThemeBySlug("tema-tres")).resolves.toBeNull();
    await expect(findPlayableThemeBySlug("tema-inativo")).resolves.toBeNull();
  });
});
