import { getAdminUser } from "@/server/auth/session";
import { createYouTubeResolveHandler } from "@/server/http/admin-youtube-route-handlers";
import { createYouTubeProvider } from "@/server/providers/youtube/youtube-provider";
import { enforceRateLimit } from "@/server/services/rate-limit";

const provider = createYouTubeProvider();

export const POST = createYouTubeResolveHandler({
  enforceRateLimit,
  getAdminUser,
  getEmbedData: provider.getEmbedData.bind(provider),
  resolve: provider.resolve.bind(provider),
});
