import { describe, expect, it } from "vitest";

import type {
  PlaylistMusicProvider,
  ProviderPlaylistPreview,
} from "@/domain/music/provider";
import { createPlaylistImportService } from "@/server/services/playlist-import-service";

const readyTrack = {
  providerContentId: "aaaaaaaaaaa",
  sourceTitle: "Música",
  sourceChannel: "Artista",
  thumbnailUrl: "https://example.com/thumb.jpg",
  durationSeconds: 180,
  isEmbeddable: true,
  isRegionAllowed: true,
};

const providerPreview: ProviderPlaylistPreview = {
  playlistId: "PL1234567890abcdef",
  playlistTitle: "Playlist",
  declaredItemCount: 1,
  positionsScanned: 1,
  uniqueVideoCount: 1,
  duplicateCount: 0,
  isTruncated: false,
  items: [
    {
      position: 0,
      providerContentId: readyTrack.providerContentId,
      status: "ready",
      track: readyTrack,
    },
  ],
};

function createService(options?: {
  associatedIds?: string[];
  now?: () => number;
  provider?: Partial<PlaylistMusicProvider>;
}) {
  let importedIds: string[] = [];
  let associationIdsToInsert: string[] = [];
  let importCalls = 0;
  const provider: PlaylistMusicProvider = {
    search: async () => [],
    resolve: async () => readyTrack,
    resolveMany: async () => [readyTrack],
    previewPlaylist: async () => providerPreview,
    getEmbedData: async () => ({ embedUrl: "", watchUrl: "" }),
    ...options?.provider,
  };
  const service = createPlaylistImportService({
    findThemeSummary: async () => ({
      id: "10000000-0000-4000-8000-000000000010",
      name: "Tema",
      slug: "tema",
      description: null,
      coverUrl: null,
      isActive: false,
      activeSongCount: 0,
      totalSongCount: 0,
      updatedAt: new Date(),
    }),
    importPlaylistTracks: async (_themeId, tracks, importOptions) => {
      importCalls += 1;
      importedIds = tracks.map(({ providerContentId }) => providerContentId);
      associationIdsToInsert = importOptions.providerContentIdsToAssociate;
      const associated = new Set(options?.associatedIds ?? []);
      return {
        added: importOptions.providerContentIdsToAssociate.filter(
          (providerContentId) => !associated.has(providerContentId),
        ).length,
        alreadyAssociated: tracks.filter(
          ({ providerContentId }) =>
            associated.has(providerContentId) &&
            (importOptions.providerContentIdsToAssociate.includes(
              providerContentId,
            ) ||
              importOptions.providerContentIdsToCountAsExisting.includes(
                providerContentId,
              )),
        ).length,
      };
    },
    listThemeProviderContentIds: async () => options?.associatedIds ?? [],
    musicProvider: provider,
    now: options?.now ?? (() => 1_000),
    randomId: () => "preview-1",
  });
  return {
    service,
    getImportedIds: () => importedIds,
    getAssociationIdsToInsert: () => associationIdsToInsert,
    getImportCalls: () => importCalls,
  };
}

describe("serviço de importação de playlist", () => {
  it("marca associação existente e reutiliza a prévia em cache", async () => {
    const { service, getImportedIds, getAssociationIdsToInsert } =
      createService({
        associatedIds: [readyTrack.providerContentId],
      });
    let cacheMisses = 0;
    const input = {
      adminUserId: "admin-1",
      themeId: "theme-1",
      playlistInput: "PL1234567890abcdef",
      maxItems: 200,
      onCacheMiss: () => {
        cacheMisses += 1;
      },
    };

    const first = await service.preview(input);
    const second = await service.preview(input);

    expect(first.preview.items[0]?.status).toBe("already_associated");
    expect(second.cacheHit).toBe(true);
    expect(cacheMisses).toBe(1);

    const result = await service.confirm({
      adminUserId: "admin-1",
      themeId: "theme-1",
      previewId: first.preview.previewId,
      selectedProviderContentIds: [],
    });
    expect(result.alreadyAssociated).toBe(1);
    expect(getImportedIds()).toEqual([readyTrack.providerContentId]);
    expect(getAssociationIdsToInsert()).toEqual([]);
  });

  it("importa somente itens prontos selecionados da prévia confiável", async () => {
    const { service, getImportedIds } = createService();
    const { preview } = await service.preview({
      adminUserId: "admin-1",
      themeId: "theme-1",
      playlistInput: "PL1234567890abcdef",
      maxItems: 200,
    });

    const result = await service.confirm({
      adminUserId: "admin-1",
      themeId: "theme-1",
      previewId: preview.previewId,
      selectedProviderContentIds: [readyTrack.providerContentId, "bbbbbbbbbbb"],
    });

    expect(getImportedIds()).toEqual([readyTrack.providerContentId]);
    expect(result).toEqual({
      added: 1,
      alreadyAssociated: 0,
      ignored: 1,
    });
  });

  it("revalida IDs quando a prévia expirou", async () => {
    let now = 1_000;
    let resolutions = 0;
    const { service } = createService({
      now: () => now,
      provider: {
        resolveMany: async () => {
          resolutions += 1;
          return [readyTrack];
        },
      },
    });
    const { preview } = await service.preview({
      adminUserId: "admin-1",
      themeId: "theme-1",
      playlistInput: "PL1234567890abcdef",
      maxItems: 200,
    });
    now += 16 * 60 * 1_000;

    await service.confirm({
      adminUserId: "admin-1",
      themeId: "theme-1",
      previewId: preview.previewId,
      selectedProviderContentIds: [readyTrack.providerContentId],
    });

    expect(resolutions).toBe(1);
  });

  it("valida o tema pelo repositório mesmo quando nenhum item é elegível", async () => {
    const { service, getImportCalls } = createService({
      provider: { resolveMany: async () => [] },
    });

    const result = await service.confirm({
      adminUserId: "admin-1",
      themeId: "theme-inexistente",
      previewId: "preview-ausente",
      selectedProviderContentIds: [readyTrack.providerContentId],
    });

    expect(getImportCalls()).toBe(1);
    expect(result.ignored).toBe(1);
  });

  it("atualiza metadados globais sem contar nem recriar associação inelegível", async () => {
    const { service, getImportedIds, getAssociationIdsToInsert } =
      createService({
        associatedIds: [readyTrack.providerContentId],
        provider: {
          resolveMany: async () => [{ ...readyTrack, isEmbeddable: false }],
        },
      });
    const { preview } = await service.preview({
      adminUserId: "admin-1",
      themeId: "theme-1",
      playlistInput: "PL1234567890abcdef",
      maxItems: 200,
    });

    const result = await service.confirm({
      adminUserId: "admin-1",
      themeId: "theme-1",
      previewId: preview.previewId,
      selectedProviderContentIds: [],
    });

    expect(getImportedIds()).toEqual([readyTrack.providerContentId]);
    expect(getAssociationIdsToInsert()).toEqual([]);
    expect(result).toEqual({ added: 0, alreadyAssociated: 0, ignored: 1 });
  });
});
