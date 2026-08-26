import "server-only";

import { and, asc, count, desc, eq, sql } from "drizzle-orm";

import { getDatabase } from "@/db";
import {
  gameSessions,
  songs,
  themes,
  themeSongs,
  type NewTheme,
} from "@/db/schema";
import type { ResolvedPlaylistTrack } from "@/domain/music/provider";
import { AppError } from "@/lib/errors";
import { withThemeCoverCleanupSlot } from "@/server/services/theme-cover-operation-lock";

type ThemeContentDatabase = Pick<
  ReturnType<typeof getDatabase>,
  "delete" | "insert" | "select" | "update"
>;

type ThemeCreationDatabase = Pick<
  ReturnType<typeof getDatabase>,
  "execute" | "insert" | "select"
>;

export type LockedThemeCreationRepository = {
  findBySlug(slug: string): Promise<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    coverUrl: string | null;
    isActive: boolean;
  } | null>;
  insert(values: NewTheme): Promise<string | null>;
  isCoverUrlReferenced(coverUrl: string): Promise<boolean>;
};

export type LockedThemeCoverCleanupRepository = Pick<
  LockedThemeCreationRepository,
  "isCoverUrlReferenced"
>;

export type ThemeSummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  coverUrl: string | null;
  isActive: boolean;
  activeSongCount: number;
  totalSongCount: number;
  updatedAt: Date;
};

export type ThemeSongEditorItem = {
  songId: string;
  providerContentId: string;
  title: string;
  artist: string;
  sourceTitle: string;
  sourceChannel: string;
  thumbnailUrl: string;
  durationSeconds: number;
  isEmbeddable: boolean;
  startTimeSeconds: number;
  previewDurationSeconds: number;
  isActive: boolean;
  displayOrder: number | null;
};

export type SongAssociationUpsertInput = {
  themeId: string;
  providerContentId: string;
  title: string;
  artist: string;
  sourceTitle: string;
  sourceChannel: string;
  thumbnailUrl: string;
  durationSeconds: number;
  isEmbeddable: boolean;
  startTimeSeconds: number;
  previewDurationSeconds: number;
  isActive: boolean;
};

export type ThemeSongUpdateInput = {
  themeId: string;
  songId: string;
  title: string;
  artist: string;
  startTimeSeconds: number;
  previewDurationSeconds: number;
  displayOrder: number | null;
  isActive: boolean;
};

const themeSummarySelection = {
  id: themes.id,
  name: themes.name,
  slug: themes.slug,
  description: themes.description,
  coverUrl: themes.coverUrl,
  isActive: themes.isActive,
  activeSongCount:
    sql<number>`count(${themeSongs.songId}) filter (where ${themeSongs.isActive} = true and ${songs.isEmbeddable} = true)`.mapWith(
      Number,
    ),
  totalSongCount: count(themeSongs.songId).mapWith(Number),
  updatedAt: themes.updatedAt,
};

const themeSongEditorSelection = {
  songId: songs.id,
  providerContentId: songs.providerContentId,
  title: themeSongs.title,
  artist: themeSongs.artist,
  sourceTitle: songs.sourceTitle,
  sourceChannel: songs.sourceChannel,
  thumbnailUrl: songs.thumbnailUrl,
  durationSeconds: songs.durationSeconds,
  isEmbeddable: songs.isEmbeddable,
  startTimeSeconds: themeSongs.startTimeSeconds,
  previewDurationSeconds: themeSongs.previewDurationSeconds,
  isActive: themeSongs.isActive,
  displayOrder: themeSongs.displayOrder,
};

async function findThemeSummaryUsing(
  database: ThemeContentDatabase,
  themeId: string,
): Promise<ThemeSummary | null> {
  const [theme] = await database
    .select(themeSummarySelection)
    .from(themes)
    .leftJoin(themeSongs, eq(themeSongs.themeId, themes.id))
    .leftJoin(songs, eq(songs.id, themeSongs.songId))
    .where(eq(themes.id, themeId))
    .groupBy(themes.id)
    .limit(1);

  return theme ?? null;
}

async function findThemeSongUsing(
  database: ThemeContentDatabase,
  themeId: string,
  songId: string,
): Promise<ThemeSongEditorItem | null> {
  const [item] = await database
    .select(themeSongEditorSelection)
    .from(themeSongs)
    .innerJoin(songs, eq(songs.id, themeSongs.songId))
    .where(and(eq(themeSongs.themeId, themeId), eq(themeSongs.songId, songId)))
    .limit(1);

  return item ?? null;
}

async function findThemeSongByProviderContentIdUsing(
  database: ThemeContentDatabase,
  themeId: string,
  providerContentId: string,
): Promise<ThemeSongEditorItem | null> {
  const [item] = await database
    .select(themeSongEditorSelection)
    .from(themeSongs)
    .innerJoin(songs, eq(songs.id, themeSongs.songId))
    .where(
      and(
        eq(themeSongs.themeId, themeId),
        eq(songs.provider, "youtube"),
        eq(songs.providerContentId, providerContentId),
      ),
    )
    .limit(1);

  return item ?? null;
}

async function updateThemeRecordUsing(
  database: ThemeContentDatabase,
  themeId: string,
  values: Partial<NewTheme>,
) {
  const [theme] = await database
    .update(themes)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(themes.id, themeId))
    .returning({ id: themes.id });

  return theme?.id ?? null;
}

async function upsertSongAndAssociationUsing(
  database: ThemeContentDatabase,
  input: SongAssociationUpsertInput,
) {
  const [song] = await database
    .insert(songs)
    .values({
      provider: "youtube",
      providerContentId: input.providerContentId,
      sourceTitle: input.sourceTitle,
      sourceChannel: input.sourceChannel,
      thumbnailUrl: input.thumbnailUrl,
      durationSeconds: input.durationSeconds,
      isEmbeddable: input.isEmbeddable,
    })
    .onConflictDoUpdate({
      target: [songs.provider, songs.providerContentId],
      set: {
        sourceTitle: input.sourceTitle,
        sourceChannel: input.sourceChannel,
        thumbnailUrl: input.thumbnailUrl,
        durationSeconds: input.durationSeconds,
        isEmbeddable: input.isEmbeddable,
        updatedAt: new Date(),
      },
    })
    .returning({ id: songs.id });

  await database
    .insert(themeSongs)
    .values({
      themeId: input.themeId,
      songId: song.id,
      title: input.title,
      artist: input.artist,
      startTimeSeconds: input.startTimeSeconds,
      previewDurationSeconds: input.previewDurationSeconds,
      isActive: input.isActive,
    })
    .onConflictDoUpdate({
      target: [themeSongs.themeId, themeSongs.songId],
      set: {
        title: input.title,
        artist: input.artist,
        startTimeSeconds: input.startTimeSeconds,
        previewDurationSeconds: input.previewDurationSeconds,
        isActive: input.isActive,
        updatedAt: new Date(),
      },
    });
}

async function updateThemeSongAssociationUsing(
  database: ThemeContentDatabase,
  input: ThemeSongUpdateInput,
) {
  await database
    .update(themeSongs)
    .set({
      title: input.title,
      artist: input.artist,
      startTimeSeconds: input.startTimeSeconds,
      previewDurationSeconds: input.previewDurationSeconds,
      displayOrder: input.displayOrder,
      isActive: input.isActive,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(themeSongs.themeId, input.themeId),
        eq(themeSongs.songId, input.songId),
      ),
    );
}

async function removeThemeSongRecordUsing(
  database: ThemeContentDatabase,
  themeId: string,
  songId: string,
) {
  const [deleted] = await database
    .delete(themeSongs)
    .where(and(eq(themeSongs.themeId, themeId), eq(themeSongs.songId, songId)))
    .returning({ songId: themeSongs.songId });

  return deleted?.songId ?? null;
}

export async function listThemeSummaries(): Promise<ThemeSummary[]> {
  const rows = await getDatabase()
    .select(themeSummarySelection)
    .from(themes)
    .leftJoin(themeSongs, eq(themeSongs.themeId, themes.id))
    .leftJoin(songs, eq(songs.id, themeSongs.songId))
    .groupBy(themes.id)
    .orderBy(desc(themes.updatedAt));

  return rows;
}

export async function findThemeSummary(
  themeId: string,
): Promise<ThemeSummary | null> {
  return findThemeSummaryUsing(getDatabase(), themeId);
}

export async function listThemeSongs(
  themeId: string,
): Promise<ThemeSongEditorItem[]> {
  return getDatabase()
    .select(themeSongEditorSelection)
    .from(themeSongs)
    .innerJoin(songs, eq(songs.id, themeSongs.songId))
    .where(eq(themeSongs.themeId, themeId))
    .orderBy(
      sql`${themeSongs.displayOrder} asc nulls last`,
      asc(themeSongs.title),
    );
}

async function insertThemeUsing(
  database: ThemeCreationDatabase,
  values: NewTheme,
): Promise<string> {
  const [theme] = await database
    .insert(themes)
    .values(values)
    .returning({ id: themes.id });

  return theme.id;
}

async function insertThemeIfSlugAvailableUsing(
  database: ThemeCreationDatabase,
  values: NewTheme,
): Promise<string | null> {
  const [theme] = await database
    .insert(themes)
    .values(values)
    .onConflictDoNothing({ target: themes.slug })
    .returning({ id: themes.id });

  return theme?.id ?? null;
}

async function findThemeBySlugUsing(
  database: ThemeCreationDatabase,
  slug: string,
) {
  const [theme] = await database
    .select({
      id: themes.id,
      name: themes.name,
      slug: themes.slug,
      description: themes.description,
      coverUrl: themes.coverUrl,
      isActive: themes.isActive,
    })
    .from(themes)
    .where(eq(themes.slug, slug))
    .limit(1);

  return theme ?? null;
}

async function isThemeCoverUrlReferencedUsing(
  database: ThemeCreationDatabase,
  coverUrl: string,
) {
  const [theme] = await database
    .select({ id: themes.id })
    .from(themes)
    .where(eq(themes.coverUrl, coverUrl))
    .limit(1);

  return Boolean(theme);
}

export async function insertTheme(values: NewTheme): Promise<string> {
  return insertThemeUsing(getDatabase(), values);
}

export async function findThemeBySlug(slug: string) {
  return findThemeBySlugUsing(getDatabase(), slug);
}

export async function isThemeCoverUrlReferenced(coverUrl: string) {
  return isThemeCoverUrlReferencedUsing(getDatabase(), coverUrl);
}

export async function withThemeCoverUrlLock<T>(
  coverUrl: string,
  operation: (repository: LockedThemeCreationRepository) => Promise<T>,
): Promise<T> {
  return getDatabase().transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${coverUrl}, 0::bigint))`,
    );

    return operation({
      findBySlug: (slug) => findThemeBySlugUsing(transaction, slug),
      insert: (values) =>
        transaction.transaction((savepoint) =>
          insertThemeIfSlugAvailableUsing(savepoint, values),
        ),
      isCoverUrlReferenced: (url) =>
        isThemeCoverUrlReferencedUsing(transaction, url),
    });
  });
}

export async function withThemeCoverCleanupLock<T>(
  coverUrl: string,
  operation: (repository: LockedThemeCoverCleanupRepository) => Promise<T>,
): Promise<T> {
  return withThemeCoverCleanupSlot(() =>
    getDatabase().transaction(async (transaction) => {
      const [lock] = await transaction.execute(
        sql<{
          acquired: boolean;
        }>`select pg_try_advisory_xact_lock(hashtextextended(${coverUrl}, 0::bigint)) as acquired`,
      );
      if (!lock?.acquired) {
        throw new AppError(
          "THEME_COVER_CLEANUP_BUSY",
          "Outra operação está usando esta capa. Tente novamente.",
          409,
        );
      }

      return operation({
        isCoverUrlReferenced: (url) =>
          isThemeCoverUrlReferencedUsing(transaction, url),
      });
    }),
  );
}

export async function updateThemeRecord(
  themeId: string,
  values: Partial<NewTheme>,
) {
  return updateThemeRecordUsing(getDatabase(), themeId, values);
}

export async function setThemeActiveRecord(themeId: string, isActive: boolean) {
  return updateThemeRecord(themeId, { isActive });
}

export async function themeHasSessions(themeId: string) {
  const [result] = await getDatabase()
    .select({ value: count() })
    .from(gameSessions)
    .where(eq(gameSessions.themeId, themeId));

  return Number(result.value) > 0;
}

export async function deleteThemeRecord(themeId: string) {
  const [deleted] = await getDatabase()
    .delete(themes)
    .where(eq(themes.id, themeId))
    .returning({ id: themes.id });

  return deleted?.id ?? null;
}

export async function upsertSongAndAssociation(
  input: SongAssociationUpsertInput,
) {
  await getDatabase().transaction(async (transaction) => {
    await upsertSongAndAssociationUsing(transaction, input);
  });
}

export async function updateThemeSongAssociation(input: ThemeSongUpdateInput) {
  await getDatabase().transaction(async (transaction) => {
    await updateThemeSongAssociationUsing(transaction, input);
  });
}

export async function findThemeSong(
  themeId: string,
  songId: string,
): Promise<ThemeSongEditorItem | null> {
  return findThemeSongUsing(getDatabase(), themeId, songId);
}

export async function findThemeSongByProviderContentId(
  themeId: string,
  providerContentId: string,
): Promise<ThemeSongEditorItem | null> {
  return findThemeSongByProviderContentIdUsing(
    getDatabase(),
    themeId,
    providerContentId,
  );
}

export async function listThemeProviderContentIds(
  themeId: string,
): Promise<string[]> {
  const rows = await getDatabase()
    .select({ providerContentId: songs.providerContentId })
    .from(themeSongs)
    .innerJoin(songs, eq(songs.id, themeSongs.songId))
    .where(and(eq(themeSongs.themeId, themeId), eq(songs.provider, "youtube")));

  return rows.map(({ providerContentId }) => providerContentId);
}

export async function importPlaylistTracks(
  themeId: string,
  tracks: ResolvedPlaylistTrack[],
  options: {
    providerContentIdsToAssociate: string[];
    providerContentIdsToCountAsExisting: string[];
  },
): Promise<{ added: number; alreadyAssociated: number }> {
  return getDatabase().transaction(async (transaction) => {
    const locked = await transaction.execute(
      sql`select ${themes.id} from ${themes} where ${themes.id} = ${themeId} for update`,
    );
    if (locked.length === 0) {
      throw new AppError("THEME_NOT_FOUND", "Tema não encontrado.", 404);
    }

    let added = 0;
    let alreadyAssociated = 0;
    const idsToAssociate = new Set(options.providerContentIdsToAssociate);
    const idsToCountAsExisting = new Set(
      options.providerContentIdsToCountAsExisting,
    );

    for (const track of tracks) {
      const [song] = await transaction
        .insert(songs)
        .values({
          provider: "youtube",
          providerContentId: track.providerContentId,
          sourceTitle: track.sourceTitle,
          sourceChannel: track.sourceChannel,
          thumbnailUrl: track.thumbnailUrl,
          durationSeconds: track.durationSeconds,
          isEmbeddable: track.isEmbeddable,
        })
        .onConflictDoUpdate({
          target: [songs.provider, songs.providerContentId],
          set: {
            sourceTitle: track.sourceTitle,
            sourceChannel: track.sourceChannel,
            thumbnailUrl: track.thumbnailUrl,
            durationSeconds: track.durationSeconds,
            isEmbeddable: track.isEmbeddable,
            updatedAt: new Date(),
          },
        })
        .returning({ id: songs.id });

      if (!idsToAssociate.has(track.providerContentId)) {
        if (!idsToCountAsExisting.has(track.providerContentId)) continue;
        const existingAssociation = await transaction
          .select({ songId: themeSongs.songId })
          .from(themeSongs)
          .where(
            and(
              eq(themeSongs.themeId, themeId),
              eq(themeSongs.songId, song.id),
            ),
          )
          .limit(1);
        if (existingAssociation.length > 0) alreadyAssociated += 1;
        continue;
      }

      const inserted = await transaction
        .insert(themeSongs)
        .values({
          themeId,
          songId: song.id,
          title: track.sourceTitle,
          artist: track.sourceChannel,
          startTimeSeconds: 0,
          previewDurationSeconds: track.durationSeconds,
          isActive: true,
          displayOrder: null,
        })
        .onConflictDoNothing({
          target: [themeSongs.themeId, themeSongs.songId],
        })
        .returning({ songId: themeSongs.songId });

      if (inserted.length > 0) added += 1;
      else alreadyAssociated += 1;
    }

    return { added, alreadyAssociated };
  });
}

export type LockedThemeContentRepository = {
  findThemeSong(songId: string): Promise<ThemeSongEditorItem | null>;
  findThemeSongByProviderContentId(
    providerContentId: string,
  ): Promise<ThemeSongEditorItem | null>;
  findThemeSummary(): Promise<ThemeSummary | null>;
  removeThemeSongRecord(songId: string): Promise<string | null>;
  setThemeActiveRecord(isActive: boolean): Promise<string | null>;
  updateThemeSongAssociation(
    input: Omit<ThemeSongUpdateInput, "themeId">,
  ): Promise<void>;
  updateThemeRecord(values: Partial<NewTheme>): Promise<string | null>;
  upsertSongAndAssociation(
    input: Omit<SongAssociationUpsertInput, "themeId">,
  ): Promise<void>;
};

export async function withThemeContentLock<T>(
  themeId: string,
  operation: (repository: LockedThemeContentRepository) => Promise<T>,
): Promise<T> {
  return getDatabase().transaction(async (transaction) => {
    await transaction.execute(
      sql`select ${themes.id} from ${themes} where ${themes.id} = ${themeId} for update`,
    );

    return operation({
      findThemeSong: (songId) =>
        findThemeSongUsing(transaction, themeId, songId),
      findThemeSongByProviderContentId: (providerContentId) =>
        findThemeSongByProviderContentIdUsing(
          transaction,
          themeId,
          providerContentId,
        ),
      findThemeSummary: () => findThemeSummaryUsing(transaction, themeId),
      removeThemeSongRecord: (songId) =>
        removeThemeSongRecordUsing(transaction, themeId, songId),
      setThemeActiveRecord: (isActive) =>
        updateThemeRecordUsing(transaction, themeId, { isActive }),
      updateThemeSongAssociation: (input) =>
        updateThemeSongAssociationUsing(transaction, { themeId, ...input }),
      updateThemeRecord: (values) =>
        updateThemeRecordUsing(transaction, themeId, values),
      upsertSongAndAssociation: (input) =>
        upsertSongAndAssociationUsing(transaction, { themeId, ...input }),
    });
  });
}

export async function removeThemeSongRecord(themeId: string, songId: string) {
  return removeThemeSongRecordUsing(getDatabase(), themeId, songId);
}
