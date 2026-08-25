import { getAdminUser } from "@/server/auth/session";
import { createPlaylistImportHandler } from "@/server/http/admin-youtube-route-handlers";
import { enforceRateLimit } from "@/server/services/rate-limit";
import { confirmPlaylistImport } from "@/server/services/playlist-import-service";

export const POST = createPlaylistImportHandler({
  confirmPlaylistImport,
  enforceRateLimit,
  getAdminUser,
});
