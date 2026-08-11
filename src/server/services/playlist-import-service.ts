import "server-only";

import { randomUUID } from "node:crypto";

import type {
  PlaylistMusicProvider,
  ProviderPlaylistItem,
  ProviderPlaylistPreview,
} from "@/domain/music/provider";
import {
  parseYouTubePlaylistId,
  type PlaylistItemStatus,
} from "@/domain/music/playlist";
import { getYouTubeEnv, getYouTubePlaylistImportEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { createYouTubeProvider } from "@/server/providers/youtube/youtube-provider";
import {
  findThemeSummary,
  importPlaylistTracks,
  listThemeProviderContentIds,
} from "@/server/repositories/theme-content-repository";

const previewTtlMs = 15 * 60 * 1_000;

export type PlaylistPreviewItem = Omit<ProviderPlaylistItem, "status"> & {
  status: PlaylistItemStatus;
};

export type PlaylistPreview = Omit<ProviderPlaylistPreview, "items"> & {
  previewId: string;
  expiresAt: number;
  items: PlaylistPreviewItem[];
};

type PlaylistImportDependencies = {
  findThemeSummary: typeof findThemeSummary;
  importPlaylistTracks: typeof importPlaylistTracks;
  listThemeProviderContentIds: typeof listThemeProviderContentIds;
  musicProvider: PlaylistMusicProvider;
  now: () => number;
  randomId: () => string;
};

type CachedPreview = {
  adminUserId: string;
  themeId: string;
  cacheKey: string;
  preview: PlaylistPreview;
};

export function createPlaylistImportService(
  dependencies: PlaylistImportDependencies,
) {
  const previewsById = new Map<string, CachedPreview>();
  const previewIdByKey = new Map<string, string>();

  function deleteCached(cached: CachedPreview) {
    previewsById.delete(cached.preview.previewId);
    previewIdByKey.delete(cached.cacheKey);
  }

  function pruneCache() {
    const now = dependencies.now();
    for (const cached of previewsById.values()) {
      if (cached.preview.expiresAt <= now) deleteCached(cached);
    }

    const overflow = previewsById.size - 100;
    if (overflow > 0) {
      [...previewsById.values()]
        .sort((a, b) => a.preview.expiresAt - b.preview.expiresAt)
        .slice(0, overflow)
        .forEach(deleteCached);
    }
  }

  function getCachedById(previewId: string): CachedPreview | null {
    pruneCache();
    const cached = previewsById.get(previewId);
    if (!cached) return null;
    if (cached.preview.expiresAt <= dependencies.now()) {
      deleteCached(cached);
      return null;
    }
    return cached;
  }

  return {
    async preview(input: {
      adminUserId: string;
      themeId: string;
      playlistInput: string;
      maxItems: number;
      onCacheMiss?: () => Promise<void> | void;
    }): Promise<{ preview: PlaylistPreview; cacheHit: boolean }> {
      pruneCache();
      const playlistId = parseYouTubePlaylistId(input.playlistInput);
      const cacheKey = `${input.adminUserId}:${input.themeId}:${playlistId}`;
      const cachedId = previewIdByKey.get(cacheKey);
      const cached = cachedId ? getCachedById(cachedId) : null;
      if (cached) return { preview: cached.preview, cacheHit: true };

      await input.onCacheMiss?.();
      if (!(await dependencies.findThemeSummary(input.themeId))) {
        throw new AppError("THEME_NOT_FOUND", "Tema não encontrado.", 404);
      }

      const [providerPreview, associatedIds] = await Promise.all([
        dependencies.musicProvider.previewPlaylist(playlistId, {
          maxItems: input.maxItems,
          regionCode: "BR",
        }),
        dependencies.listThemeProviderContentIds(input.themeId),
      ]);
      const associated = new Set(associatedIds);
      const preview: PlaylistPreview = {
        ...providerPreview,
        previewId: dependencies.randomId(),
        expiresAt: dependencies.now() + previewTtlMs,
        items: providerPreview.items.map((item) => ({
          ...item,
          status:
            item.status === "ready" &&
            item.providerContentId &&
            associated.has(item.providerContentId)
              ? "already_associated"
              : item.status,
        })),
      };
      const entry = {
        adminUserId: input.adminUserId,
        themeId: input.themeId,
        cacheKey,
        preview,
      };
      previewsById.set(preview.previewId, entry);
      previewIdByKey.set(cacheKey, preview.previewId);
      return { preview, cacheHit: false };
    },

    async confirm(input: {
      adminUserId: string;
      themeId: string;
      previewId: string;
      selectedProviderContentIds: string[];
    }): Promise<{
      added: number;
      alreadyAssociated: number;
      ignored: number;
    }> {
      const selectedIds = [...new Set(input.selectedProviderContentIds)];
      const cached = getCachedById(input.previewId);
      let candidateIds: string[];
      let associationCandidateIds: string[];
      let existingCandidateIds: string[];

      if (
        cached &&
        cached.adminUserId === input.adminUserId &&
        cached.themeId === input.themeId
      ) {
        const selected = new Set(selectedIds);
        existingCandidateIds = cached.preview.items.flatMap((item) =>
          item.status === "already_associated" && item.providerContentId
            ? [item.providerContentId]
            : [],
        );
        associationCandidateIds = cached.preview.items.flatMap((item) =>
          item.status === "ready" &&
          item.providerContentId &&
          selected.has(item.providerContentId)
            ? [item.providerContentId]
            : [],
        );
        candidateIds = [
          ...new Set(
            cached.preview.items.flatMap((item) => {
              if (!item.providerContentId) return [];
              if (item.status === "already_associated") {
                return [item.providerContentId];
              }
              return item.status === "ready" &&
                selected.has(item.providerContentId)
                ? [item.providerContentId]
                : [];
            }),
          ),
        ];
      } else {
        candidateIds = selectedIds;
        associationCandidateIds = selectedIds;
        existingCandidateIds = [];
      }

      const tracks = await dependencies.musicProvider.resolveMany(
        candidateIds,
        "BR",
      );
      const eligible = tracks.filter(
        (track) => track.isEmbeddable && track.isRegionAllowed,
      );
      const eligibleIds = new Set(
        eligible.map(({ providerContentId }) => providerContentId),
      );
      const eligibleAssociationIds = associationCandidateIds.filter((id) =>
        eligibleIds.has(id),
      );
      const existingIds = new Set(existingCandidateIds);
      const tracksForPersistence = tracks.filter(
        (track) =>
          eligibleIds.has(track.providerContentId) ||
          existingIds.has(track.providerContentId),
      );
      const result = await dependencies.importPlaylistTracks(
        input.themeId,
        tracksForPersistence,
        {
          providerContentIdsToAssociate: eligibleAssociationIds,
          providerContentIdsToCountAsExisting: existingCandidateIds.filter(
            (id) => eligibleIds.has(id),
          ),
        },
      );

      return {
        added: result.added,
        alreadyAssociated: result.alreadyAssociated,
        ignored:
          candidateIds.length -
          eligible.length +
          (selectedIds.length - associationCandidateIds.length),
      };
    },
  };
}

const playlistImportService = createPlaylistImportService({
  findThemeSummary,
  importPlaylistTracks,
  listThemeProviderContentIds,
  musicProvider: createYouTubeProvider(),
  now: Date.now,
  randomId: randomUUID,
});

export async function previewPlaylistForTheme(input: {
  adminUserId: string;
  themeId: string;
  playlistInput: string;
  onCacheMiss?: () => Promise<void> | void;
}) {
  return playlistImportService.preview({
    ...input,
    maxItems: getYouTubeEnv().YOUTUBE_PLAYLIST_IMPORT_MAX_ITEMS,
  });
}

export async function confirmPlaylistImport(
  input: Parameters<typeof playlistImportService.confirm>[0],
) {
  const maxItems =
    getYouTubePlaylistImportEnv().YOUTUBE_PLAYLIST_IMPORT_MAX_ITEMS;
  if (input.selectedProviderContentIds.length > maxItems) {
    throw new AppError(
      "PLAYLIST_IMPORT_LIMIT_EXCEEDED",
      `Selecione no máximo ${maxItems} itens por importação.`,
      400,
    );
  }
  return playlistImportService.confirm(input);
}
