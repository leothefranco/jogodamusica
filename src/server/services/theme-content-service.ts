import "server-only";

import type { z } from "zod";

import { deriveEffectiveSourceAvailability } from "@/domain/music/source-availability";
import {
  classifyThemeState,
  deriveThemeStateEvents,
  type ThemeEditorialState,
  type ThemeStateEvent,
} from "@/domain/music/theme-state";
import { getYouTubeEmbedData } from "@/domain/music/youtube";
import {
  getThemePublishability,
  trackAssociationInputSchema,
  themeInputSchema,
  themeSongInputSchema,
  validatePreviewWindow,
} from "@/domain/music/content-validation";
import { AppError } from "@/lib/errors";
import { countLabel } from "@/lib/language";
import { observeSourceAvailability } from "@/server/services/source-availability-service";
import {
  deleteThemeRecord,
  findThemeSong,
  findThemeSongByProviderContentId,
  findThemeSummary,
  listThemeSongs,
  listThemeSummaries,
  removeThemeSongRecord,
  setThemeActiveRecord,
  themeHasSessions,
  updateThemeSongAssociation,
  updateThemeRecord,
  upsertSongAndAssociation,
  withThemeContentLock,
  type ThemeSongEditorItem,
  type ThemeSummary,
  type LockedThemeContentRepository,
} from "@/server/repositories/theme-content-repository";

type ThemeInput = z.infer<typeof themeInputSchema>;
type TrackAssociationInput = z.infer<typeof trackAssociationInputSchema>;
type ThemeSongInput = z.infer<typeof themeSongInputSchema>;

function classifyThemeEntries(
  editorialState: ThemeEditorialState,
  songs: ThemeSongEditorItem[],
  now: Date,
) {
  const counts = {
    availableFresh: 0,
    availableGrace: 0,
    unavailable: 0,
    unknown: 0,
  };
  const countKeys = {
    available_fresh: "availableFresh",
    available_grace: "availableGrace",
    unavailable: "unavailable",
    unknown: "unknown",
  } as const;
  for (const song of songs) {
    if (!song.isActive) continue;
    const { state } = deriveEffectiveSourceAvailability(
      song.sourceAvailability,
      now,
    );
    counts[countKeys[state]] += 1;
  }
  return classifyThemeState({ editorialState, counts });
}

type ThemeContentServiceDependencies = {
  clock?: () => Date;
  recordThemeStateEvent?: (event: ThemeStateEvent) => void;
  deleteThemeRecord: typeof deleteThemeRecord;
  findThemeSong: typeof findThemeSong;
  findThemeSummary: typeof findThemeSummary;
  findThemeSongByProviderContentId: typeof findThemeSongByProviderContentId;
  observeSourceAvailability: typeof observeSourceAvailability;
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

async function captureEditorialChange(
  repository: LockedThemeContentRepository,
  theme: ThemeSummary,
  now: Date,
  mutate: () => Promise<unknown>,
) {
  const previousEntries = await repository.listThemeSongs();
  const previousBySong = new Map(
    previousEntries.map((entry) => [entry.songId, entry]),
  );
  const before = classifyThemeEntries(
    theme.editorialState,
    previousEntries,
    now,
  );
  await mutate();
  // Vary editorial membership only; a concurrent health write is not editorial.
  const entries = (await repository.listThemeSongs()).map((entry) => {
    const previous = previousBySong.get(entry.songId);
    return previous
      ? { ...entry, sourceAvailability: previous.sourceAvailability }
      : entry;
  });
  const after = classifyThemeEntries(theme.editorialState, entries, now);
  return deriveThemeStateEvents(before, after, "editorial");
}

export async function getAdminThemes() {
  const themes = await listThemeSummaries();
  const now = new Date();
  return Promise.all(
    themes.map(async (theme) => ({
      ...theme,
      state: classifyThemeEntries(
        theme.editorialState,
        await listThemeSongs(theme.id),
        now,
      ),
    })),
  );
}

type ThemeEditorServiceDependencies = {
  clock: () => Date;
  findThemeSummary: typeof findThemeSummary;
  listThemeSongs: typeof listThemeSongs;
};

export function createThemeEditorService(
  dependencies: ThemeEditorServiceDependencies,
) {
  return async function getThemeEditor(themeId: string) {
    const theme = await dependencies.findThemeSummary(themeId);
    if (!theme) {
      throw new AppError("THEME_NOT_FOUND", "Tema não encontrado.", 404);
    }

    const themeSongItems = await dependencies.listThemeSongs(themeId);
    const now = dependencies.clock();
    const songs = themeSongItems.map((song) => ({
      ...song,
      ...getYouTubeEmbedData(song.providerContentId),
      availability: deriveEffectiveSourceAvailability(
        song.sourceAvailability,
        now,
      ),
    }));
    const state = classifyThemeEntries(
      theme.editorialState,
      themeSongItems,
      now,
    );
    const publishability = getThemePublishability(state.counts.playableCount);

    return { theme, songs, publishability, state };
  };
}

export const getThemeEditor = createThemeEditorService({
  clock: () => new Date(),
  findThemeSummary,
  listThemeSongs,
});

function unavailableSourceError(
  result: Awaited<ReturnType<typeof observeSourceAvailability>>["result"],
) {
  if (result.type === "transient_error") {
    return new AppError(
      "SOURCE_AVAILABILITY_UNKNOWN",
      "Não foi possível confirmar a disponibilidade da Fonte agora. Tente revalidar mais tarde.",
      503,
    );
  }

  if (result.type === "available") {
    return new AppError(
      "SOURCE_AVAILABILITY_UNKNOWN",
      "A confirmação recebida perdeu uma disputa concorrente. Revalide a Fonte.",
      409,
    );
  }

  const errors = {
    region_blocked: new AppError(
      "VIDEO_REGION_BLOCKED",
      "Este vídeo não está disponível no Brasil e não pode ser usado no jogo.",
      400,
    ),
    not_embeddable: new AppError(
      "VIDEO_NOT_EMBEDDABLE",
      "Este vídeo não permite incorporação e não pode ser usado no jogo.",
      400,
    ),
    not_found: new AppError(
      "YOUTUBE_VIDEO_NOT_FOUND",
      "O vídeo não foi encontrado ou não está disponível.",
      404,
    ),
  } as const;

  return errors[result.reason];
}

export function createThemeContentService(
  dependencies: ThemeContentServiceDependencies,
) {
  const clock = dependencies.clock ?? (() => new Date());
  const emitEvents = (events: ThemeStateEvent[]) => {
    for (const event of events) dependencies.recordThemeStateEvent?.(event);
  };
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
      actorId: string,
    ): Promise<void> {
      const events = await dependencies.withThemeContentLock(
        themeId,
        async (repository) => {
          await repository.assertActiveAdmin(actorId);
          const theme = await repository.findThemeSummary();
          if (!theme) {
            throw new AppError("THEME_NOT_FOUND", "Tema não encontrado.", 404);
          }

          const entries = await repository.listThemeSongs();
          const state = classifyThemeEntries(
            theme.editorialState,
            entries,
            clock(),
          );
          if (isActive && theme.editorialState === "draft") {
            const publishability = getThemePublishability(
              state.counts.playableCount,
            );
            if (!publishability.canPublish) {
              throw new AppError(
                "THEME_NOT_PLAYABLE",
                `Confirme mais ${countLabel(publishability.missingSongCount, "Entrada jogável", "Entradas jogáveis")} antes de publicar.`,
                409,
              );
            }
          }

          await repository.setThemeActiveRecord(isActive);
          const after = classifyThemeState({
            editorialState: isActive ? "published" : "draft",
            counts: state.counts,
          });
          return deriveThemeStateEvents(state, after, "editorial");
        },
      );
      emitEvents(events);
    },
    async attachResolvedTrack(
      themeId: string,
      input: TrackAssociationInput,
    ): Promise<void> {
      const observed = await dependencies.observeSourceAvailability(
        input.providerContentId,
      );
      if (
        !observed.availability.playable ||
        !observed.track ||
        !observed.songId
      ) {
        throw unavailableSourceError(observed.result);
      }
      const resolvedTrack = observed.track;
      const observedSongId = observed.songId;

      validatePreviewWindow({
        durationSeconds: resolvedTrack.durationSeconds,
        startTimeSeconds: input.startTimeSeconds,
        previewDurationSeconds: input.previewDurationSeconds,
      });
      const events = await dependencies.withThemeContentLock(
        themeId,
        async (repository) => {
          const theme = await repository.findThemeSummary();
          if (!theme) {
            throw new AppError("THEME_NOT_FOUND", "Tema não encontrado.", 404);
          }

          return captureEditorialChange(repository, theme, clock(), () =>
            repository.upsertThemeSongAssociation({
              songId: observedSongId,
              title: input.title,
              artist: input.artist,
              startTimeSeconds: input.startTimeSeconds,
              previewDurationSeconds: input.previewDurationSeconds,
              isActive: input.isActive,
            }),
          );
        },
      );
      emitEvents(events);
    },
    async revalidateSourceAvailability(themeId: string, songId: string) {
      const source = await dependencies.findThemeSong(themeId, songId);
      if (!source) {
        throw new AppError(
          "THEME_SONG_NOT_FOUND",
          "Música associada não encontrada.",
          404,
        );
      }

      const observed = await dependencies.observeSourceAvailability(
        source.providerContentId,
      );
      if (observed.applied) {
        const events = await dependencies.withThemeContentLock(
          themeId,
          async (repository) => {
            const theme = await repository.findThemeSummary();
            if (!theme) return [];
            const entries = await repository.listThemeSongs();
            const decisionAt = clock();
            // Hold editorial membership fixed: a concurrent withdrawal is not a provider incident.
            const before = classifyThemeEntries(
              theme.editorialState,
              entries.map((entry) =>
                entry.songId === songId
                  ? {
                      ...entry,
                      sourceAvailability: observed.previousObservation,
                    }
                  : entry,
              ),
              decisionAt,
            );
            const after = classifyThemeEntries(
              theme.editorialState,
              entries.map((entry) =>
                entry.songId === songId
                  ? { ...entry, sourceAvailability: observed.observation }
                  : entry,
              ),
              decisionAt,
            );
            return deriveThemeStateEvents(before, after, "health");
          },
        );
        emitEvents(events);
      }
      return observed.availability;
    },
    async updateThemeSong(
      themeId: string,
      songId: string,
      input: ThemeSongInput,
    ): Promise<void> {
      const events = await dependencies.withThemeContentLock(
        themeId,
        async (repository) => {
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

          return captureEditorialChange(repository, theme, clock(), () =>
            repository.updateThemeSongAssociation({ songId, ...input }),
          );
        },
      );
      emitEvents(events);
    },
    async removeThemeSong(themeId: string, songId: string): Promise<void> {
      const events = await dependencies.withThemeContentLock(
        themeId,
        async (repository) => {
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

          return captureEditorialChange(repository, theme, clock(), () =>
            repository.removeThemeSongRecord(songId),
          );
        },
      );
      emitEvents(events);
    },
  };
}

const themeContentService = createThemeContentService({
  deleteThemeRecord,
  findThemeSong,
  findThemeSummary,
  findThemeSongByProviderContentId,
  observeSourceAvailability,
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
export const revalidateSourceAvailability =
  themeContentService.revalidateSourceAvailability;
