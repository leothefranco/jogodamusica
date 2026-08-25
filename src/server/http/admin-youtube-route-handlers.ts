import { z } from "zod";

import type { MusicProvider } from "@/domain/music/provider";
import { AppError, fieldErrorsFromZod } from "@/lib/errors";
import type { getAdminUser } from "@/server/auth/session";
import {
  createAdminYouTubeHandler,
  readJsonBody,
} from "@/server/http/admin-youtube-handler";
import type {
  confirmPlaylistImport,
  previewPlaylistForTheme,
} from "@/server/services/playlist-import-service";
import type { enforceRateLimit } from "@/server/services/rate-limit";

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
      const payload = await readJsonBody(
        request,
        "Revise a URL ou o ID informado.",
      );

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

const previewInputSchema = z.object({
  themeId: z.string().uuid(),
  input: z.string().trim().min(1).max(500),
});

type PlaylistPreviewHandlerDependencies = {
  enforceRateLimit: typeof enforceRateLimit;
  getAdminUser: typeof getAdminUser;
  previewPlaylistForTheme: typeof previewPlaylistForTheme;
};

export function createPlaylistPreviewHandler(
  dependencies: PlaylistPreviewHandlerDependencies,
) {
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

const importInputSchema = z.object({
  themeId: z.string().uuid(),
  previewId: z.string().uuid(),
  selectedProviderContentIds: z
    .array(z.string().regex(/^[A-Za-z0-9_-]{11}$/))
    .max(1_000),
});

type PlaylistImportHandlerDependencies = {
  confirmPlaylistImport: typeof confirmPlaylistImport;
  enforceRateLimit: typeof enforceRateLimit;
  getAdminUser: typeof getAdminUser;
};

export function createPlaylistImportHandler(
  dependencies: PlaylistImportHandlerDependencies,
) {
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
