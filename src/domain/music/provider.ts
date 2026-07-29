import type { ProviderPlaylistItemStatus } from "@/domain/music/playlist";

export type ProviderSearchResult = {
  providerContentId: string;
  sourceTitle: string;
  sourceChannel: string;
  thumbnailUrl: string;
  durationSeconds: number;
  isEmbeddable: boolean;
};

export type ResolvedProviderTrack = ProviderSearchResult;

export type ResolvedPlaylistTrack = ResolvedProviderTrack & {
  isRegionAllowed: boolean;
};

export type ProviderPlaylistItem = {
  position: number;
  providerContentId: string | null;
  status: ProviderPlaylistItemStatus;
  track: ResolvedPlaylistTrack | null;
};

export type ProviderPlaylistPreview = {
  playlistId: string;
  playlistTitle: string;
  declaredItemCount: number;
  positionsScanned: number;
  uniqueVideoCount: number;
  duplicateCount: number;
  isTruncated: boolean;
  items: ProviderPlaylistItem[];
};

export type EmbedData = {
  embedUrl: string;
  watchUrl: string;
};

export interface MusicProvider {
  search(query: string): Promise<ProviderSearchResult[]>;
  resolve(input: string): Promise<ResolvedProviderTrack>;
  getEmbedData(providerContentId: string): Promise<EmbedData>;
}

export interface PlaylistMusicProvider extends MusicProvider {
  previewPlaylist(
    input: string,
    options: { maxItems: number; regionCode: string },
  ): Promise<ProviderPlaylistPreview>;
  resolveMany(
    providerContentIds: string[],
    regionCode: string,
  ): Promise<ResolvedPlaylistTrack[]>;
}
