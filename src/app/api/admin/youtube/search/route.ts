import { getAdminUser } from "@/server/auth/session";
import { createYouTubeSearchHandler } from "@/server/http/admin-youtube-route-handlers";
import { createYouTubeProvider } from "@/server/providers/youtube/youtube-provider";
import { enforceRateLimit } from "@/server/services/rate-limit";

const provider = createYouTubeProvider();

export const GET = createYouTubeSearchHandler({
  enforceRateLimit,
  getAdminUser,
  getEmbedData: provider.getEmbedData.bind(provider),
  search: provider.search.bind(provider),
});
