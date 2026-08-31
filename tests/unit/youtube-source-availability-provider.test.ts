import { beforeEach, describe, expect, it, vi } from "vitest";

import { YouTubeProvider } from "@/server/providers/youtube/youtube-provider";

const videoId = "aaaaaaaaaaa";

function video(
  options: { id?: string; embeddable?: boolean; blocked?: string[] } = {},
) {
  return {
    id: options.id ?? videoId,
    snippet: {
      title: "Fonte",
      channelTitle: "Canal",
      thumbnails: { default: { url: "https://example.com/thumb.jpg" } },
    },
    contentDetails: {
      duration: "PT3M",
      regionRestriction: options.blocked
        ? { blocked: options.blocked }
        : undefined,
    },
    status: {
      embeddable: options.embeddable ?? true,
      privacyStatus: "public",
    },
  };
}

describe("observação regional do provider YouTube", () => {
  beforeEach(() => {
    process.env.YOUTUBE_API_KEY = "test-key";
  });

  it.each([
    ["available", video(), "available"],
    ["region-blocked", video({ blocked: ["BR"] }), "region_blocked"],
    ["not-embeddable", video({ embeddable: false }), "not_embeddable"],
  ] as const)(
    "normaliza resultado conclusivo %s",
    async (_case, item, reason) => {
      const provider = new YouTubeProvider(async () =>
        Response.json({ items: [item] }),
      );

      await expect(provider.observe(videoId, "BR")).resolves.toMatchObject({
        type: reason === "available" ? "available" : "unavailable",
        reason,
        track: { providerContentId: videoId },
      });
    },
  );

  it("normaliza ausência explícita sem inventar metadados", async () => {
    const provider = new YouTubeProvider(async () =>
      Response.json({ items: [] }),
    );

    await expect(provider.observe(videoId, "BR")).resolves.toEqual({
      type: "unavailable",
      reason: "not_found",
      track: null,
    });
  });

  it("rejeita metadados devolvidos para outro vídeo", async () => {
    const provider = new YouTubeProvider(async () =>
      Response.json({ items: [{ ...video(), id: "bbbbbbbbbbb" }] }),
    );

    await expect(provider.observe(videoId, "BR")).resolves.toEqual({
      type: "transient_error",
      errorCode: "invalid_response",
    });
  });

  it.each([
    [
      "transporte",
      async () => Promise.reject(new Error("URL com segredo")),
      "transport",
    ],
    [
      "quota",
      async () =>
        Response.json(
          { error: { errors: [{ reason: "quotaExceeded" }] } },
          { status: 403 },
        ),
      "quota",
    ],
    [
      "resposta inválida",
      async () => Response.json({ unexpected: true }),
      "invalid_response",
    ],
  ] as const)(
    "reduz falha de %s a código controlado",
    async (_case, fetcher, errorCode) => {
      const provider = new YouTubeProvider(fetcher as typeof fetch);

      const result = await provider.observe(videoId, "BR");

      expect(result).toEqual({ type: "transient_error", errorCode });
      expect(JSON.stringify(result)).not.toContain("segredo");
    },
  );

  it("classifica configuração ausente sem expor chave", async () => {
    delete process.env.YOUTUBE_API_KEY;
    const provider = new YouTubeProvider(async () => {
      throw new Error("não deveria executar fetch");
    });

    await expect(provider.observe(videoId, "BR")).resolves.toEqual({
      type: "transient_error",
      errorCode: "configuration",
    });
  });

  it("busca a observação sem cache para não renovar estado antigo como atual", async () => {
    const fetcher = vi.fn(async (...request: Parameters<typeof fetch>) => {
      void request;
      return Response.json({ items: [video()] });
    });
    const provider = new YouTubeProvider(fetcher);

    await provider.observe(videoId, "BR");

    const init = fetcher.mock.calls[0]?.[1] as
      (RequestInit & { next?: { revalidate?: number } }) | undefined;

    expect(init).toMatchObject({
      cache: "no-store",
      signal: expect.any(AbortSignal),
    });
    expect(init?.next).toBeUndefined();
  });

  it("preserva a revalidação dos demais consumidores do provider", async () => {
    const resolvedVideoId = "ccccccccccc";
    const fetcher = vi.fn(async (...request: Parameters<typeof fetch>) => {
      void request;
      return Response.json({ items: [video({ id: resolvedVideoId })] });
    });
    const provider = new YouTubeProvider(fetcher);

    await provider.resolve(resolvedVideoId);

    const init = fetcher.mock.calls[0]?.[1] as
      (RequestInit & { next?: { revalidate?: number } }) | undefined;

    expect(init).toMatchObject({
      next: { revalidate: 300 },
      signal: expect.any(AbortSignal),
    });
    expect(init?.cache).toBeUndefined();
  });
});
