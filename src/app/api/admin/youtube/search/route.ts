import { z } from "zod";

import type { MusicProvider } from "@/domain/music/provider";
import { AppError, fieldErrorsFromZod } from "@/lib/errors";
import { getAdminUser } from "@/server/auth/session";
import { createAdminYouTubeHandler } from "@/server/http/admin-youtube-handler";
import { createYouTubeProvider } from "@/server/providers/youtube/youtube-provider";
import { enforceRateLimit } from "@/server/services/rate-limit";

const searchQuerySchema = z.object({
  q: z.string().trim().min(2).max(100),
});

type YouTubeSearchHandlerDependencies = {
  enforceRateLimit: typeof enforceRateLimit;
  getAdminUser: typeof getAdminUser;
  getEmbedData: MusicProvider["getEmbedData"];
  search: MusicProvider["search"];
};

export function createYouTubeSearchHandler(
  dependencies: YouTubeSearchHandlerDependencies,
) {
  return createAdminYouTubeHandler(
    dependencies,
    { rateLimitKey: "youtube-search", limit: 10 },
    async (request) => {
      const url = new URL(request.url);
      const parsed = searchQuerySchema.safeParse({
        q: url.searchParams.get("q"),
      });
      if (!parsed.success) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Revise os dados da consulta.",
          400,
          fieldErrorsFromZod(parsed.error.flatten().fieldErrors),
        );
      }

      const tracks = await dependencies.search(parsed.data.q);
      const results = await Promise.all(
        tracks.map(async (track) => ({
          ...track,
          ...(await dependencies.getEmbedData(track.providerContentId)),
        })),
      );
      return Response.json({ data: results });
    },
  );
}

const provider = createYouTubeProvider();

export const GET = createYouTubeSearchHandler({
  enforceRateLimit,
  getAdminUser,
  getEmbedData: provider.getEmbedData.bind(provider),
  search: provider.search.bind(provider),
});
