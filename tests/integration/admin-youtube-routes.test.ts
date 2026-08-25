import { describe, expect, it } from "vitest";

import {
  createPlaylistImportHandler,
  createPlaylistPreviewHandler,
  createYouTubeResolveHandler,
  createYouTubeSearchHandler,
} from "@/server/http/admin-youtube-route-handlers";

describe("rotas administrativas do YouTube", () => {
  it("rejeita pesquisa de usuário sem perfil administrativo ativo", async () => {
    const handler = createYouTubeSearchHandler({
      enforceRateLimit: async () => undefined,
      getAdminUser: async () => null,
      getEmbedData: async () => ({
        embedUrl: "",
        watchUrl: "",
      }),
      search: async () => [],
    });

    const response = await handler(
      new Request("http://localhost/api/admin/youtube/search?q=rock"),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "UNAUTHORIZED" },
    });
  });

  it("rejeita resolução de usuário sem perfil administrativo ativo", async () => {
    const handler = createYouTubeResolveHandler({
      enforceRateLimit: async () => undefined,
      getAdminUser: async () => null,
      getEmbedData: async () => ({
        embedUrl: "",
        watchUrl: "",
      }),
      resolve: async () => {
        throw new Error("A fronteira do YouTube não deve ser chamada.");
      },
    });

    const response = await handler(
      new Request("http://localhost/api/admin/youtube/resolve", {
        method: "POST",
        body: JSON.stringify({ input: "dQw4w9WgXcQ" }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "UNAUTHORIZED" },
    });
  });

  it("rejeita JSON malformado como erro de validação", async () => {
    const handler = createYouTubeResolveHandler({
      enforceRateLimit: async () => undefined,
      getAdminUser: async () => ({
        userId: "10000000-0000-4000-8000-000000000010",
        email: "admin@example.com",
        displayName: "Admin",
        role: "admin",
      }),
      getEmbedData: async () => ({
        embedUrl: "",
        watchUrl: "",
      }),
      resolve: async () => {
        throw new Error("A fronteira do YouTube não deve ser chamada.");
      },
    });

    const response = await handler(
      new Request("http://localhost/api/admin/youtube/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });
  });

  it("entrega dados de incorporação da pesquisa pela fronteira do provedor", async () => {
    const rateLimits: Array<{
      key: string;
      options: { limit: number; windowMs: number };
    }> = [];
    const handler = createYouTubeSearchHandler({
      enforceRateLimit: async (key, options) => {
        rateLimits.push({ key, options });
      },
      getAdminUser: async () => ({
        userId: "10000000-0000-4000-8000-000000000010",
        email: "admin@example.com",
        displayName: "Admin",
        role: "admin",
      }),
      getEmbedData: async () => ({
        embedUrl: "https://provider.example/embed/dQw4w9WgXcQ",
        watchUrl: "https://provider.example/watch/dQw4w9WgXcQ",
      }),
      search: async () => [
        {
          providerContentId: "dQw4w9WgXcQ",
          sourceTitle: "Fonte",
          sourceChannel: "Canal",
          thumbnailUrl: "https://example.com/thumb.jpg",
          durationSeconds: 180,
          isEmbeddable: true,
        },
      ],
    });

    const response = await handler(
      new Request("http://localhost/api/admin/youtube/search?q=rock"),
    );

    expect(response.status).toBe(200);
    expect(rateLimits).toEqual([
      {
        key: "youtube-search:10000000-0000-4000-8000-000000000010",
        options: { limit: 10, windowMs: 60_000 },
      },
    ]);
    await expect(response.json()).resolves.toEqual({
      data: [
        {
          providerContentId: "dQw4w9WgXcQ",
          sourceTitle: "Fonte",
          sourceChannel: "Canal",
          thumbnailUrl: "https://example.com/thumb.jpg",
          durationSeconds: 180,
          isEmbeddable: true,
          embedUrl: "https://provider.example/embed/dQw4w9WgXcQ",
          watchUrl: "https://provider.example/watch/dQw4w9WgXcQ",
        },
      ],
    });
  });

  it("resolve a música, aplica o limite vigente e preserva o payload", async () => {
    const rateLimits: Array<{
      key: string;
      options: { limit: number; windowMs: number };
    }> = [];
    const handler = createYouTubeResolveHandler({
      enforceRateLimit: async (key, options) => {
        rateLimits.push({ key, options });
      },
      getAdminUser: async () => ({
        userId: "10000000-0000-4000-8000-000000000010",
        email: "admin@example.com",
        displayName: "Admin",
        role: "admin",
      }),
      getEmbedData: async () => ({
        embedUrl: "https://provider.example/embed/dQw4w9WgXcQ",
        watchUrl: "https://provider.example/watch/dQw4w9WgXcQ",
      }),
      resolve: async (input) => ({
        providerContentId: input,
        sourceTitle: "Fonte",
        sourceChannel: "Canal",
        thumbnailUrl: "https://example.com/thumb.jpg",
        durationSeconds: 180,
        isEmbeddable: true,
        isRegionAllowed: true,
      }),
    });

    const response = await handler(
      new Request("http://localhost/api/admin/youtube/resolve", {
        method: "POST",
        body: JSON.stringify({ input: "dQw4w9WgXcQ" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(rateLimits).toEqual([
      {
        key: "youtube-resolve:10000000-0000-4000-8000-000000000010",
        options: { limit: 20, windowMs: 60_000 },
      },
    ]);
    await expect(response.json()).resolves.toEqual({
      data: {
        providerContentId: "dQw4w9WgXcQ",
        sourceTitle: "Fonte",
        sourceChannel: "Canal",
        thumbnailUrl: "https://example.com/thumb.jpg",
        durationSeconds: 180,
        isEmbeddable: true,
        isRegionAllowed: true,
        embedUrl: "https://provider.example/embed/dQw4w9WgXcQ",
        watchUrl: "https://provider.example/watch/dQw4w9WgXcQ",
      },
    });
  });

  it("protege a prévia de playlist e aplica limite somente no cache miss", async () => {
    const rateLimits: Array<{
      key: string;
      options: { limit: number; windowMs: number };
    }> = [];
    const handler = createPlaylistPreviewHandler({
      enforceRateLimit: async (key, options) => {
        rateLimits.push({ key, options });
      },
      getAdminUser: async () => ({
        userId: "10000000-0000-4000-8000-000000000010",
        email: "admin@example.com",
        displayName: "Admin",
        role: "admin",
      }),
      previewPlaylistForTheme: async (input) => {
        await input.onCacheMiss?.();
        return {
          cacheHit: false,
          preview: {
            previewId: "20000000-0000-4000-8000-000000000020",
            expiresAt: Date.now() + 60_000,
            playlistId: "PL1234567890abcdef",
            playlistTitle: "Playlist",
            declaredItemCount: 0,
            positionsScanned: 0,
            uniqueVideoCount: 0,
            duplicateCount: 0,
            isTruncated: false,
            items: [],
          },
        };
      },
    });

    const response = await handler(
      new Request("http://localhost/api/admin/youtube/playlists/preview", {
        method: "POST",
        body: JSON.stringify({
          themeId: "30000000-0000-4000-8000-000000000030",
          input: "PL1234567890abcdef",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(rateLimits).toEqual([
      {
        key: "youtube-playlist-preview:10000000-0000-4000-8000-000000000010",
        options: { limit: 5, windowMs: 10 * 60_000 },
      },
    ]);
    await expect(response.json()).resolves.toEqual({
      data: {
        previewId: "20000000-0000-4000-8000-000000000020",
        expiresAt: expect.any(Number),
        playlistId: "PL1234567890abcdef",
        playlistTitle: "Playlist",
        declaredItemCount: 0,
        positionsScanned: 0,
        uniqueVideoCount: 0,
        duplicateCount: 0,
        isTruncated: false,
        items: [],
      },
    });
  });

  it("valida os IDs selecionados antes de confirmar importação", async () => {
    const handler = createPlaylistImportHandler({
      enforceRateLimit: async () => undefined,
      getAdminUser: async () => ({
        userId: "10000000-0000-4000-8000-000000000010",
        email: "admin@example.com",
        displayName: "Admin",
        role: "admin",
      }),
      confirmPlaylistImport: async () => {
        throw new Error("O serviço não deve ser chamado.");
      },
    });

    const response = await handler(
      new Request("http://localhost/api/admin/youtube/playlists/import", {
        method: "POST",
        body: JSON.stringify({
          themeId: "30000000-0000-4000-8000-000000000030",
          previewId: "20000000-0000-4000-8000-000000000020",
          selectedProviderContentIds: ["inválido"],
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });
  });

  it("confirma a importação com o usuário e limite vigentes", async () => {
    const rateLimits: Array<{
      key: string;
      options: { limit: number; windowMs: number };
    }> = [];
    const confirmations: unknown[] = [];
    const handler = createPlaylistImportHandler({
      enforceRateLimit: async (key, options) => {
        rateLimits.push({ key, options });
      },
      getAdminUser: async () => ({
        userId: "10000000-0000-4000-8000-000000000010",
        email: "admin@example.com",
        displayName: "Admin",
        role: "admin",
      }),
      confirmPlaylistImport: async (input) => {
        confirmations.push(input);
        return { added: 1, alreadyAssociated: 2, ignored: 3 };
      },
    });

    const response = await handler(
      new Request("http://localhost/api/admin/youtube/playlists/import", {
        method: "POST",
        body: JSON.stringify({
          themeId: "30000000-0000-4000-8000-000000000030",
          previewId: "20000000-0000-4000-8000-000000000020",
          selectedProviderContentIds: ["dQw4w9WgXcQ"],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(rateLimits).toEqual([
      {
        key: "youtube-playlist-import:10000000-0000-4000-8000-000000000010",
        options: { limit: 10, windowMs: 10 * 60_000 },
      },
    ]);
    expect(confirmations).toEqual([
      {
        adminUserId: "10000000-0000-4000-8000-000000000010",
        themeId: "30000000-0000-4000-8000-000000000030",
        previewId: "20000000-0000-4000-8000-000000000020",
        selectedProviderContentIds: ["dQw4w9WgXcQ"],
      },
    ]);
    await expect(response.json()).resolves.toEqual({
      data: { added: 1, alreadyAssociated: 2, ignored: 3 },
    });
  });
});
