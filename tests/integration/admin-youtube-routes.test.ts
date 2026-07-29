import { describe, expect, it } from "vitest";

import { createYouTubeResolveHandler } from "@/app/api/admin/youtube/resolve/route";
import { createYouTubeSearchHandler } from "@/app/api/admin/youtube/search/route";

describe("rotas administrativas do YouTube", () => {
  it("rejeita pesquisa de usuário sem perfil administrativo ativo", async () => {
    const handler = createYouTubeSearchHandler({
      enforceRateLimit: () => undefined,
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
      enforceRateLimit: () => undefined,
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
      enforceRateLimit: () => undefined,
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
    const handler = createYouTubeSearchHandler({
      enforceRateLimit: () => undefined,
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
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          embedUrl: "https://provider.example/embed/dQw4w9WgXcQ",
          watchUrl: "https://provider.example/watch/dQw4w9WgXcQ",
        },
      ],
    });
  });
});
