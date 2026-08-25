import { getAdminUser } from "@/server/auth/session";
import { createPlaylistPreviewHandler } from "@/server/http/admin-youtube-route-handlers";
import { enforceRateLimit } from "@/server/services/rate-limit";
import { previewPlaylistForTheme } from "@/server/services/playlist-import-service";

export const POST = createPlaylistPreviewHandler({
  enforceRateLimit,
  getAdminUser,
  previewPlaylistForTheme,
});
