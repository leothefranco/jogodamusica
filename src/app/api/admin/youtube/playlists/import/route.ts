import { z } from "zod";

import { AppError, fieldErrorsFromZod } from "@/lib/errors";
import { getAdminUser } from "@/server/auth/session";
import {
  createAdminYouTubeHandler,
  readJsonBody,
} from "@/server/http/admin-youtube-handler";
import { enforceRateLimit } from "@/server/services/rate-limit";
import { confirmPlaylistImport } from "@/server/services/playlist-import-service";

const importInputSchema = z.object({
  themeId: z.string().uuid(),
  previewId: z.string().uuid(),
  selectedProviderContentIds: z
    .array(z.string().regex(/^[A-Za-z0-9_-]{11}$/))
    .max(1_000),
});

type Dependencies = {
  confirmPlaylistImport: typeof confirmPlaylistImport;
  enforceRateLimit: typeof enforceRateLimit;
  getAdminUser: typeof getAdminUser;
};

export function createPlaylistImportHandler(dependencies: Dependencies) {
  return createAdminYouTubeHandler(
    dependencies,
    {
      rateLimitKey: "youtube-playlist-import",
      limit: 10,
      windowMs: 10 * 60_000,
    },
    async (request, admin) => {
      const parsed = importInputSchema.safeParse(
        await readJsonBody(request, "Revise os itens selecionados."),
      );
      if (!parsed.success) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Revise os itens selecionados.",
          400,
          fieldErrorsFromZod(parsed.error.flatten().fieldErrors),
        );
      }

      const result = await dependencies.confirmPlaylistImport({
        adminUserId: admin.userId,
        ...parsed.data,
      });
      return Response.json({ data: result });
    },
  );
}

export const POST = createPlaylistImportHandler({
  confirmPlaylistImport,
  enforceRateLimit,
  getAdminUser,
});
