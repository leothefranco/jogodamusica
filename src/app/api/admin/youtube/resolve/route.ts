import { z } from "zod";

import type { MusicProvider } from "@/domain/music/provider";
import { AppError, fieldErrorsFromZod } from "@/lib/errors";
import { getAdminUser } from "@/server/auth/session";
import { createAdminYouTubeHandler } from "@/server/http/admin-youtube-handler";
import { createYouTubeProvider } from "@/server/providers/youtube/youtube-provider";
import { enforceRateLimit } from "@/server/services/rate-limit";

const resolveInputSchema = z.object({
  input: z.string().trim().min(1).max(500),
});

type YouTubeResolveHandlerDependencies = {
  enforceRateLimit: typeof enforceRateLimit;
  getAdminUser: typeof getAdminUser;
  getEmbedData: MusicProvider["getEmbedData"];
  resolve: MusicProvider["resolve"];
};

export function createYouTubeResolveHandler(
  dependencies: YouTubeResolveHandlerDependencies,
) {
  return createAdminYouTubeHandler(
    dependencies,
    { rateLimitKey: "youtube-resolve", limit: 20 },
    async (request) => {
      let payload: unknown;
      try {
        payload = await request.json();
      } catch {
        throw new AppError(
          "VALIDATION_ERROR",
          "Revise a URL ou o ID informado.",
          400,
          { input: ["Envie um corpo JSON válido."] },
        );
      }

      const parsed = resolveInputSchema.safeParse(payload);
      if (!parsed.success) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Revise a URL ou o ID informado.",
          400,
          fieldErrorsFromZod(parsed.error.flatten().fieldErrors),
        );
      }

      const track = await dependencies.resolve(parsed.data.input);
      const embed = await dependencies.getEmbedData(track.providerContentId);

      return Response.json({ data: { ...track, ...embed } });
    },
  );
}

const provider = createYouTubeProvider();

export const POST = createYouTubeResolveHandler({
  enforceRateLimit,
  getAdminUser,
  getEmbedData: provider.getEmbedData.bind(provider),
  resolve: provider.resolve.bind(provider),
});
