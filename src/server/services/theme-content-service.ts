import "server-only";

import type { z } from "zod";

import type { MusicProvider } from "@/domain/music/provider";
import {
  getThemePublishability,
  trackAssociationInputSchema,
  themeInputSchema,
  themeSongInputSchema,
  validatePreviewWindow,
} from "@/domain/music/content-validation";
import { AppError } from "@/lib/errors";
import { createYouTubeProvider } from "@/server/providers/youtube/youtube-provider";
import {
  deleteThemeRecord,
  findThemeSong,
  findThemeSongByProviderContentId,
  findThemeSummary,
  insertTheme,
  listThemeSongs,
  listThemeSummaries,
  removeThemeSongRecord,
  setThemeActiveRecord,
  themeHasSessions,
  updateThemeSongAssociation,
  updateThemeRecord,
  upsertSongAndAssociation,
  withThemeContentLock,
  type ThemeSummary,
} from "@/server/repositories/theme-content-repository";

type ThemeInput = z.infer<typeof themeInputSchema>;
type TrackAssociationInput = z.infer<typeof trackAssociationInputSchema>;
type ThemeSongInput = z.infer<typeof themeSongInputSchema>;

const musicProvider = createYouTubeProvider();

type ThemeContentServiceDependencies = {
  deleteThemeRecord: typeof deleteThemeRecord;
  findThemeSong: typeof findThemeSong;
  findThemeSummary: typeof findThemeSummary;
  findThemeSongByProviderContentId: typeof findThemeSongByProviderContentId;
  insertTheme: typeof insertTheme;
  musicProvider: MusicProvider;
  removeThemeSongRecord: typeof removeThemeSongRecord;
  setThemeActiveRecord: typeof setThemeActiveRecord;
  themeHasSessions: typeof themeHasSessions;
  updateThemeSongAssociation: typeof updateThemeSongAssociation;
  updateThemeRecord: typeof updateThemeRecord;
  upsertSongAndAssociation: typeof upsertSongAndAssociation;
  withThemeContentLock: typeof withThemeContentLock;
};

function postgresCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }

  return null;
}

function assertPublishedThemeCanLoseActiveSong(
  theme: ThemeSummary,
  message: string,
) {
  if (!theme.isActive) return;

  const publishability = getThemePublishability(theme.activeSongCount - 1);
  if (!publishability.canPublish) {
    throw new AppError("THEME_NOT_PLAYABLE", message, 409);
  }
}

export async function getAdminThemes() {
  return listThemeSummaries();
}

export async function getThemeEditor(themeId: string) {
  const theme = await findThemeSummary(themeId);
  if (!theme) {
    throw new AppError("THEME_NOT_FOUND", "Tema não encontrado.", 404);
  }

  const themeSongItems = await listThemeSongs(themeId);
  const songs = await Promise.all(
    themeSongItems.map(async (song) => ({
      ...song,
      ...(await musicProvider.getEmbedData(song.providerContentId)),
    })),
  );
  const publishability = getThemePublishability(theme.activeSongCount);

  return { theme, songs, publishability };
}

export async function createTheme(input: ThemeInput) {
  try {
    return await insertTheme({ ...input, isActive: false });
  } catch (error) {
    if (postgresCode(error) === "23505") {
      throw new AppError(
        "THEME_SLUG_CONFLICT",
        "Já existe um tema com este slug.",
        409,
        { slug: ["Escolha outro slug."] },
      );
    }
    throw error;
  }
}

export function createThemeContentService(
  dependencies: ThemeContentServiceDependencies,
) {
  return {
    async deleteTheme(themeId: string): Promise<void> {
      if (await dependencies.themeHasSessions(themeId)) {
        throw new AppError(
          "THEME_HAS_HISTORY",
          "Este tema possui partidas relacionadas e não pode ser excluído. Desative-o.",
          409,
        );
      }

      const deletedId = await dependencies.deleteThemeRecord(themeId);
      if (!deletedId) {
        throw new AppError("THEME_NOT_FOUND", "Tema não encontrado.", 404);
      }
    },
    async updateTheme(themeId: string, input: ThemeInput): Promise<void> {
      await dependencies.withThemeContentLock(themeId, async (repository) => {
        const current = await repository.findThemeSummary();
        if (!current) {
          throw new AppError("THEME_NOT_FOUND", "Tema não encontrado.", 404);
        }

        try {
          await repository.updateThemeRecord(input);
        } catch (error) {
          if (postgresCode(error) === "23505") {
            throw new AppError(
              "THEME_SLUG_CONFLICT",
              "Já existe um tema com este slug.",
              409,
              { slug: ["Escolha outro slug."] },
            );
          }
          throw error;
        }
      });
    },
    async setThemePublication(
      themeId: string,
      isActive: boolean,
    ): Promise<void> {
      await dependencies.withThemeContentLock(themeId, async (repository) => {
        const theme = await repository.findThemeSummary();
        if (!theme) {
          throw new AppError("THEME_NOT_FOUND", "Tema não encontrado.", 404);
        }

        if (isActive) {
          const publishability = getThemePublishability(theme.activeSongCount);
          if (!publishability.canPublish) {
            throw new AppError(
              "THEME_NOT_PLAYABLE",
              `Adicione mais ${publishability.missingSongCount} música(s) ativa(s) antes de publicar.`,
              409,
            );
          }
        }

        await repository.setThemeActiveRecord(isActive);
      });
    },
    async attachResolvedTrack(
      themeId: string,
      input: TrackAssociationInput,
    ): Promise<void> {
      const resolvedTrack = await dependencies.musicProvider.resolve(
        input.providerContentId,
      );
      if (!resolvedTrack.isEmbeddable) {
        throw new AppError(
          "VIDEO_NOT_EMBEDDABLE",
          "Este vídeo não permite incorporação e não pode ser usado no jogo.",
          400,
        );
      }

      validatePreviewWindow({
        durationSeconds: resolvedTrack.durationSeconds,
        startTimeSeconds: input.startTimeSeconds,
        previewDurationSeconds: input.previewDurationSeconds,
      });
      await dependencies.withThemeContentLock(themeId, async (repository) => {
        const [theme, currentAssociation] = await Promise.all([
          repository.findThemeSummary(),
          repository.findThemeSongByProviderContentId(input.providerContentId),
        ]);
        if (!theme) {
          throw new AppError("THEME_NOT_FOUND", "Tema não encontrado.", 404);
        }

        if (
          currentAssociation?.isActive &&
          currentAssociation.isEmbeddable &&
          !input.isActive
        ) {
          assertPublishedThemeCanLoseActiveSong(
            theme,
            "Desative o tema antes de reduzir suas músicas ativas abaixo de quatro.",
          );
        }

        await repository.upsertSongAndAssociation({
          ...resolvedTrack,
          title: input.title,
          artist: input.artist,
          startTimeSeconds: input.startTimeSeconds,
          previewDurationSeconds: input.previewDurationSeconds,
          isActive: input.isActive,
        });
      });
    },
    async updateThemeSong(
      themeId: string,
      songId: string,
      input: ThemeSongInput,
    ): Promise<void> {
      await dependencies.withThemeContentLock(themeId, async (repository) => {
        const [theme, current] = await Promise.all([
          repository.findThemeSummary(),
          repository.findThemeSong(songId),
        ]);
        if (!theme || !current) {
          throw new AppError(
            "THEME_SONG_NOT_FOUND",
            "Música associada não encontrada.",
            404,
          );
        }

        validatePreviewWindow({
          durationSeconds: current.durationSeconds,
          startTimeSeconds: input.startTimeSeconds,
          previewDurationSeconds: input.previewDurationSeconds,
        });

        if (current.isActive && current.isEmbeddable && !input.isActive) {
          assertPublishedThemeCanLoseActiveSong(
            theme,
            "Desative o tema antes de reduzir suas músicas ativas abaixo de quatro.",
          );
        }

        await repository.updateThemeSongAssociation({ songId, ...input });
      });
    },
    async removeThemeSong(themeId: string, songId: string): Promise<void> {
      await dependencies.withThemeContentLock(themeId, async (repository) => {
        const [theme, current] = await Promise.all([
          repository.findThemeSummary(),
          repository.findThemeSong(songId),
        ]);
        if (!theme || !current) {
          throw new AppError(
            "THEME_SONG_NOT_FOUND",
            "Música associada não encontrada.",
            404,
          );
        }

        if (current.isActive && current.isEmbeddable) {
          assertPublishedThemeCanLoseActiveSong(
            theme,
            "Desative o tema antes de remover uma música necessária para o chaveamento.",
          );
        }

        await repository.removeThemeSongRecord(songId);
      });
    },
  };
}

const themeContentService = createThemeContentService({
  deleteThemeRecord,
  findThemeSong,
  findThemeSummary,
  findThemeSongByProviderContentId,
  insertTheme,
  musicProvider,
  removeThemeSongRecord,
  setThemeActiveRecord,
  themeHasSessions,
  updateThemeSongAssociation,
  updateThemeRecord,
  upsertSongAndAssociation,
  withThemeContentLock,
});

export const attachResolvedTrack = themeContentService.attachResolvedTrack;
export const deleteTheme = themeContentService.deleteTheme;
export const setThemePublication = themeContentService.setThemePublication;
export const updateTheme = themeContentService.updateTheme;
export const updateThemeSong = themeContentService.updateThemeSong;
export const removeThemeSong = themeContentService.removeThemeSong;
