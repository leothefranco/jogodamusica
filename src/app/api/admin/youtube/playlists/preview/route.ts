import { z } from "zod";

import { AppError, fieldErrorsFromZod } from "@/lib/errors";
import { getAdminUser } from "@/server/auth/session";
import {
  createAdminYouTubeHandler,
  readJsonBody,
} from "@/server/http/admin-youtube-handler";
import { enforceRateLimit } from "@/server/services/rate-limit";
import { previewPlaylistForTheme } from "@/server/services/playlist-import-service";

const previewInputSchema = z.object({
  themeId: z.string().uuid(),
  input: z.string().trim().min(1).max(500),
});

type Dependencies = {
  enforceRateLimit: typeof enforceRateLimit;
  getAdminUser: typeof getAdminUser;
  previewPlaylistForTheme: typeof previewPlaylistForTheme;
};

export function createPlaylistPreviewHandler(dependencies: Dependencies) {
  return createAdminYouTubeHandler(
    dependencies,
    null,
    async (request, admin) => {
      const parsed = previewInputSchema.safeParse(
        await readJsonBody(request, "Revise a playlist informada."),
      );
      if (!parsed.success) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Revise a playlist informada.",
          400,
          fieldErrorsFromZod(parsed.error.flatten().fieldErrors),
        );
      }

      const result = await dependencies.previewPlaylistForTheme({
        adminUserId: admin.userId,
        themeId: parsed.data.themeId,
        playlistInput: parsed.data.input,
        onCacheMiss: () =>
          dependencies.enforceRateLimit(
            `youtube-playlist-preview:${admin.userId}`,
            { limit: 5, windowMs: 10 * 60_000 },
          ),
      });
      return Response.json({ data: result.preview });
    },
  );
}

export const POST = createPlaylistPreviewHandler({
  enforceRateLimit,
  getAdminUser,
  previewPlaylistForTheme,
});
