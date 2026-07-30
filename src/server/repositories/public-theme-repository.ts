import "server-only";

import { and, asc, count, eq } from "drizzle-orm";
import { connection } from "next/server";

import { getDatabase } from "@/db";
import { songs, themes, themeSongs } from "@/db/schema";
import {
  bracketSizeSchema,
  type BracketSize,
} from "@/domain/music/content-validation";

export type PlayableThemeRecord = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  coverUrl: string | null;
  defaultBracketSize: BracketSize;
  activeSongCount: number;
};

const selection = {
  id: themes.id,
  name: themes.name,
  slug: themes.slug,
  description: themes.description,
  coverUrl: themes.coverUrl,
  defaultBracketSize: themes.defaultBracketSize,
  activeSongCount: count(themeSongs.songId).mapWith(Number),
};

function toPlayableTheme(
  row: Omit<PlayableThemeRecord, "defaultBracketSize"> & {
    defaultBracketSize: number;
  },
): PlayableThemeRecord {
  return {
    ...row,
    defaultBracketSize: bracketSizeSchema.parse(row.defaultBracketSize),
  };
}

function playableThemeQuery() {
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
    .where(eq(themes.isActive, true))
    .groupBy(themes.id);
}

export async function listPlayableThemes(): Promise<PlayableThemeRecord[]> {
  await connection();
  const rows = await playableThemeQuery().orderBy(asc(themes.name));
  return rows.map(toPlayableTheme);
}

export async function findPlayableThemeBySlug(
  slug: string,
): Promise<PlayableThemeRecord | null> {
  await connection();
  const [row] = await playableThemeQuery()
    .having(eq(themes.slug, slug))
    .limit(1);

  return row ? toPlayableTheme(row) : null;
}
