import "server-only";

import { and, asc, count, eq, gte, sql } from "drizzle-orm";
import { connection } from "next/server";

import { getDatabase } from "@/db";
import { songs, themes, themeSongs } from "@/db/schema";
import { minimumPlayableSongCount } from "@/domain/music/content-validation";

export type PlayableThemeRecord = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  coverUrl: string | null;
  thumbnailUrls: string[];
  activeSongCount: number;
};

const selection = {
  id: themes.id,
  name: themes.name,
  slug: themes.slug,
  description: themes.description,
  coverUrl: themes.coverUrl,
  thumbnailUrls: sql<string[]>`
      coalesce(
        (array_agg(
          ${songs.thumbnailUrl}
          order by ${themeSongs.displayOrder} asc nulls last, ${themeSongs.createdAt} asc
        ))[1:4],
        array[]::text[]
      )
    `.as("thumbnail_urls"),
  activeSongCount: count(themeSongs.songId)
    .mapWith(Number)
    .as("active_song_count"),
};

function playableThemeQuery(slug?: string) {
  return getDatabase()
    .select(selection)
    .from(themes)
    .innerJoin(
      themeSongs,
      and(eq(themeSongs.themeId, themes.id), eq(themeSongs.isActive, true)),
    )
    .innerJoin(
      songs,
      and(eq(songs.id, themeSongs.songId), eq(songs.isEmbeddable, true)),
    )
    .where(
      and(
        eq(themes.isActive, true),
        slug === undefined ? undefined : eq(themes.slug, slug),
      ),
    )
    .groupBy(themes.id)
    .having(gte(count(themeSongs.songId), minimumPlayableSongCount))
    .orderBy(asc(themes.name));
}

export async function listPlayableThemes(): Promise<PlayableThemeRecord[]> {
  await connection();
  return playableThemeQuery();
}

export async function findPlayableThemeBySlug(
  slug: string,
): Promise<PlayableThemeRecord | null> {
  await connection();
  const [row] = await playableThemeQuery(slug);
  return row ?? null;
}
