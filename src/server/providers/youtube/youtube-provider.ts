import "server-only";

import { z } from "zod";

import type {
  EmbedData,
  MusicProvider,
  ProviderSearchResult,
  ResolvedProviderTrack,
} from "@/domain/music/provider";
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
      }),
      status: z.object({
        embeddable: z.boolean(),
        privacyStatus: z.string(),
      }),
    }),
  ),
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
    response = await fetch(`${apiBaseUrl}/${path}?${params.toString()}`, {
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
): Promise<ResolvedProviderTrack[]> {
  if (videoIds.length === 0) {
    return [];
  }

  const params = new URLSearchParams({
    part: "snippet,contentDetails,status",
    id: videoIds.join(","),
    maxResults: String(Math.min(videoIds.length, 50)),
  });
  const payload = await youtubeFetch("videos", params, videoResponseSchema);

  return payload.items.map((item) => ({
    providerContentId: item.id,
    sourceTitle: decodeEntities(item.snippet.title),
    sourceChannel: decodeEntities(item.snippet.channelTitle),
    thumbnailUrl: getThumbnailUrl(item.snippet.thumbnails),
    durationSeconds: parseIsoDurationSeconds(item.contentDetails.duration),
    isEmbeddable:
      item.status.embeddable && item.status.privacyStatus !== "private",
  }));
}

export class YouTubeProvider implements MusicProvider {
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
    );
    const results = await getVideoDetails(
      searchPayload.items.map((item) => item.id.videoId),
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

    const [track] = await getVideoDetails([videoId]);
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

  async getEmbedData(providerContentId: string): Promise<EmbedData> {
    const videoId = parseYouTubeVideoId(providerContentId);

    return {
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
      watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
    };
  }
}

export function createYouTubeProvider(): MusicProvider {
  return new YouTubeProvider();
}
