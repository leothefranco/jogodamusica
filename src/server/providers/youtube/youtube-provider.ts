import "server-only";

import { z } from "zod";

import type {
  EmbedData,
  PlaylistMusicProvider,
  ProviderPlaylistItem,
  ProviderPlaylistPreview,
  ProviderSearchResult,
  ResolvedPlaylistTrack,
  ResolvedProviderTrack,
} from "@/domain/music/provider";
import { parseYouTubePlaylistId } from "@/domain/music/playlist";
import {
  parseIsoDurationSeconds,
  parseYouTubeVideoId,
} from "@/domain/music/youtube";
import { getYouTubeEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";

const searchResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.object({ videoId: z.string() }),
    }),
  ),
});

const videoResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      snippet: z.object({
        title: z.string(),
        channelTitle: z.string(),
        thumbnails: z.record(
          z.string(),
          z.object({
            url: z.string().url(),
          }),
        ),
      }),
      contentDetails: z.object({
        duration: z.string(),
        regionRestriction: z
          .object({
            allowed: z.array(z.string()).optional(),
            blocked: z.array(z.string()).optional(),
          })
          .optional(),
      }),
      status: z.object({
        embeddable: z.boolean(),
        privacyStatus: z.string(),
      }),
    }),
  ),
});

const playlistResponseSchema = z.object({
  items: z.array(
    z.object({
      snippet: z.object({
        title: z.string(),
      }),
      contentDetails: z.object({
        itemCount: z.number().int().nonnegative(),
      }),
    }),
  ),
});

const playlistItemsResponseSchema = z.object({
  items: z.array(
    z.object({
      contentDetails: z
        .object({
          videoId: z.string().optional(),
        })
        .optional(),
      snippet: z
        .object({
          position: z.number().int().nonnegative(),
          resourceId: z
            .object({
              videoId: z.string().optional(),
            })
            .optional(),
        })
        .optional(),
    }),
  ),
  nextPageToken: z.string().optional(),
});

const providerErrorSchema = z.object({
  error: z
    .object({
      message: z.string().optional(),
      errors: z.array(z.object({ reason: z.string().optional() })).optional(),
    })
    .optional(),
});

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const searchCache = new Map<string, CacheEntry<ProviderSearchResult[]>>();
const resolveCache = new Map<string, CacheEntry<ResolvedProviderTrack>>();
const cacheDurationMs = 5 * 60 * 1_000;
const apiBaseUrl = "https://www.googleapis.com/youtube/v3";

function decodeEntities(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function getThumbnailUrl(thumbnails: Record<string, { url: string }>): string {
  return (
    thumbnails.high?.url ??
    thumbnails.medium?.url ??
    thumbnails.default?.url ??
    ""
  );
}

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string) {
  const entry = cache.get(key);

  if (!entry || entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return entry.value;
}

function setCached<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  value: T,
) {
  cache.set(key, { value, expiresAt: Date.now() + cacheDurationMs });
}

async function youtubeFetch<T>(
  path: string,
  params: URLSearchParams,
  schema: z.ZodType<T>,
  fetcher: typeof fetch = fetch,
): Promise<T> {
  let YOUTUBE_API_KEY: string;
  try {
    YOUTUBE_API_KEY = getYouTubeEnv().YOUTUBE_API_KEY;
  } catch {
    throw new AppError(
      "YOUTUBE_NOT_CONFIGURED",
      "Configure YOUTUBE_API_KEY no ambiente do servidor para usar o YouTube.",
      503,
    );
  }
  params.set("key", YOUTUBE_API_KEY);

  let response: Response;
  try {
    response = await fetcher(`${apiBaseUrl}/${path}?${params.toString()}`, {
      signal: AbortSignal.timeout(10_000),
      next: { revalidate: 300 },
    });
  } catch {
    throw new AppError(
      "YOUTUBE_UNAVAILABLE",
      "O YouTube não respondeu a tempo. Tente novamente.",
      503,
    );
  }

  const payload: unknown = await response.json();

  if (!response.ok) {
    const parsedError = providerErrorSchema.safeParse(payload);
    const reason = parsedError.success
      ? parsedError.data.error?.errors?.[0]?.reason
      : undefined;

    if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") {
      throw new AppError(
        "YOUTUBE_QUOTA_EXCEEDED",
        "A cota do YouTube está indisponível. Use novamente mais tarde.",
        503,
      );
    }

    if (
      reason === "playlistNotFound" ||
      reason === "playlistItemsNotAccessible"
    ) {
      throw new AppError(
        "YOUTUBE_PLAYLIST_NOT_FOUND",
        "A playlist não foi encontrada ou não está acessível.",
        404,
      );
    }

    if (reason === "playlistForbidden") {
      throw new AppError(
        "YOUTUBE_PLAYLIST_FORBIDDEN",
        "Esta playlist não está acessível com a configuração atual.",
        403,
      );
    }

    throw new AppError(
      "YOUTUBE_REQUEST_FAILED",
      "Não foi possível consultar o YouTube agora.",
      502,
    );
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new AppError(
      "INVALID_PROVIDER_RESPONSE",
      "O YouTube retornou uma resposta inesperada.",
      502,
    );
  }

  return parsed.data;
}

async function getVideoDetails(
  videoIds: string[],
  regionCode = "BR",
  fetcher: typeof fetch = fetch,
): Promise<ResolvedPlaylistTrack[]> {
  if (videoIds.length === 0) {
    return [];
  }

  const params = new URLSearchParams({
    part: "snippet,contentDetails,status",
    id: videoIds.join(","),
    maxResults: String(Math.min(videoIds.length, 50)),
  });
  const payload = await youtubeFetch(
    "videos",
    params,
    videoResponseSchema,
    fetcher,
  );

  return payload.items.map((item) => {
    const restriction = item.contentDetails.regionRestriction;
    const isRegionAllowed =
      (!restriction?.allowed || restriction.allowed.includes(regionCode)) &&
      !restriction?.blocked?.includes(regionCode);

    return {
      providerContentId: item.id,
      sourceTitle: decodeEntities(item.snippet.title),
      sourceChannel: decodeEntities(item.snippet.channelTitle),
      thumbnailUrl: getThumbnailUrl(item.snippet.thumbnails),
      durationSeconds: parseIsoDurationSeconds(item.contentDetails.duration),
      isEmbeddable:
        item.status.embeddable &&
        ["public", "unlisted"].includes(item.status.privacyStatus),
      isRegionAllowed,
    };
  });
}

export class YouTubeProvider implements PlaylistMusicProvider {
  constructor(private readonly fetcher: typeof fetch = fetch) {}

  async search(query: string): Promise<ProviderSearchResult[]> {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    const cached = getCached(searchCache, normalizedQuery);
    if (cached) {
      return cached;
    }

    const params = new URLSearchParams({
      part: "snippet",
      type: "video",
      maxResults: "8",
      regionCode: "BR",
      order: "relevance",
      q: query.trim(),
    });
    const searchPayload = await youtubeFetch(
      "search",
      params,
      searchResponseSchema,
      this.fetcher,
    );
    const results = await getVideoDetails(
      searchPayload.items.map((item) => item.id.videoId),
      "BR",
      this.fetcher,
    );

    setCached(searchCache, normalizedQuery, results);
    return results;
  }

  async resolve(input: string): Promise<ResolvedProviderTrack> {
    const videoId = parseYouTubeVideoId(input);
    const cached = getCached(resolveCache, videoId);
    if (cached) {
      return cached;
    }

    const [track] = await getVideoDetails([videoId], "BR", this.fetcher);
    if (!track) {
      throw new AppError(
        "YOUTUBE_VIDEO_NOT_FOUND",
        "O vídeo não foi encontrado ou não está disponível.",
        404,
      );
    }

    setCached(resolveCache, videoId, track);
    return track;
  }

  async resolveMany(
    providerContentIds: string[],
    regionCode: string,
  ): Promise<ResolvedPlaylistTrack[]> {
    const uniqueIds = [...new Set(providerContentIds.map(parseYouTubeVideoId))];
    const results: ResolvedPlaylistTrack[] = [];
    for (let index = 0; index < uniqueIds.length; index += 50) {
      results.push(
        ...(await getVideoDetails(
          uniqueIds.slice(index, index + 50),
          regionCode,
          this.fetcher,
        )),
      );
    }
    return results;
  }

  async previewPlaylist(
    input: string,
    options: { maxItems: number; regionCode: string },
  ): Promise<ProviderPlaylistPreview> {
    const playlistId = parseYouTubePlaylistId(input);
    const playlistParams = new URLSearchParams({
      part: "snippet,contentDetails",
      id: playlistId,
      maxResults: "1",
    });
    const playlistPayload = await youtubeFetch(
      "playlists",
      playlistParams,
      playlistResponseSchema,
      this.fetcher,
    );
    const playlist = playlistPayload.items[0];
    if (!playlist) {
      throw new AppError(
        "YOUTUBE_PLAYLIST_NOT_FOUND",
        "A playlist não foi encontrada ou não está acessível.",
        404,
      );
    }

    const positions: Array<{
      position: number;
      providerContentId: string | null;
    }> = [];
    let nextPageToken: string | undefined;

    do {
      const params = new URLSearchParams({
        part: "contentDetails,snippet",
        playlistId,
        maxResults: "50",
      });
      if (nextPageToken) params.set("pageToken", nextPageToken);
      const page = await youtubeFetch(
        "playlistItems",
        params,
        playlistItemsResponseSchema,
        this.fetcher,
      );

      for (const item of page.items) {
        if (positions.length >= options.maxItems) break;
        positions.push({
          position: item.snippet?.position ?? positions.length,
          providerContentId:
            item.contentDetails?.videoId ??
            item.snippet?.resourceId?.videoId ??
            null,
        });
      }

      nextPageToken = page.nextPageToken;
    } while (nextPageToken && positions.length < options.maxItems);

    const seen = new Set<string>();
    const duplicateIds = new Set<string>();
    const invalidIds = new Set<string>();
    const uniqueIds: string[] = [];
    for (const item of positions) {
      const id = item.providerContentId;
      if (!id) continue;
      try {
        parseYouTubeVideoId(id);
      } catch {
        invalidIds.add(`${item.position}:${id}`);
        continue;
      }
      if (seen.has(id)) {
        duplicateIds.add(`${item.position}:${id}`);
      } else {
        seen.add(id);
        uniqueIds.push(id);
      }
    }

    const tracks = await this.resolveMany(uniqueIds, options.regionCode);
    const tracksById = new Map(
      tracks.map((track) => [track.providerContentId, track]),
    );
    const items: ProviderPlaylistItem[] = positions.map((item) => {
      const id = item.providerContentId;
      if (!id) {
        return { ...item, status: "invalid", track: null };
      }
      if (invalidIds.has(`${item.position}:${id}`)) {
        return { ...item, status: "invalid", track: null };
      }
      if (duplicateIds.has(`${item.position}:${id}`)) {
        return {
          ...item,
          status: "duplicate",
          track: tracksById.get(id) ?? null,
        };
      }
      const track = tracksById.get(id);
      if (!track) return { ...item, status: "unavailable", track: null };
      if (!track.isEmbeddable) {
        return { ...item, status: "not_embeddable", track };
      }
      if (!track.isRegionAllowed) {
        return { ...item, status: "region_blocked", track };
      }
      return { ...item, status: "ready", track };
    });

    return {
      playlistId,
      playlistTitle: decodeEntities(playlist.snippet.title),
      declaredItemCount: playlist.contentDetails.itemCount,
      positionsScanned: positions.length,
      uniqueVideoCount: uniqueIds.length,
      duplicateCount: items.filter(({ status }) => status === "duplicate")
        .length,
      isTruncated:
        playlist.contentDetails.itemCount > positions.length ||
        Boolean(nextPageToken),
      items,
    };
  }

  async getEmbedData(providerContentId: string): Promise<EmbedData> {
    const videoId = parseYouTubeVideoId(providerContentId);

    return {
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
      watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
    };
  }
}

export function createYouTubeProvider(): PlaylistMusicProvider {
  return new YouTubeProvider();
}
