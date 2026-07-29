export type ProviderSearchResult = {
  providerContentId: string;
  sourceTitle: string;
  sourceChannel: string;
  thumbnailUrl: string;
  durationSeconds: number;
  isEmbeddable: boolean;
};

export type ResolvedProviderTrack = ProviderSearchResult;

export type EmbedData = {
  embedUrl: string;
  watchUrl: string;
};

export interface MusicProvider {
  search(query: string): Promise<ProviderSearchResult[]>;
  resolve(input: string): Promise<ResolvedProviderTrack>;
  getEmbedData(providerContentId: string): Promise<EmbedData>;
}
