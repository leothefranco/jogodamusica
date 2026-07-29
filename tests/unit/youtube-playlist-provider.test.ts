import { beforeEach, describe, expect, it } from "vitest";

import { YouTubeProvider } from "@/server/providers/youtube/youtube-provider";

const ids = {
  ready: "aaaaaaaaaaa",
  blocked: "bbbbbbbbbbb",
  noEmbed: "ccccccccccc",
};

function json(data: unknown) {
  return Response.json(data);
}

describe("prévia de playlist do YouTube", () => {
  beforeEach(() => {
    process.env.YOUTUBE_API_KEY = "test-key";
  });

  it("pagina até o teto e classifica duplicatas e elegibilidade", async () => {
    const fetcher: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/playlists")) {
        return json({
          items: [
            {
              snippet: { title: "Minha &amp; Playlist" },
              contentDetails: { itemCount: 5 },
            },
          ],
        });
      }
      if (url.pathname.endsWith("/playlistItems")) {
        if (!url.searchParams.has("pageToken")) {
          return json({
            items: [
              {
                snippet: { position: 0 },
                contentDetails: { videoId: ids.ready },
              },
              {
                snippet: { position: 1 },
                contentDetails: { videoId: ids.ready },
              },
              {
                snippet: { position: 2 },
                contentDetails: { videoId: ids.noEmbed },
              },
            ],
            nextPageToken: "next",
          });
        }
        return json({
          items: [
            {
              snippet: { position: 3 },
              contentDetails: { videoId: ids.blocked },
            },
            {
              snippet: { position: 4 },
              contentDetails: { videoId: "ddddddddddd" },
            },
          ],
        });
      }
      if (url.pathname.endsWith("/videos")) {
        return json({
          items: [
            video(ids.ready),
            video(ids.noEmbed, { embeddable: false }),
            video(ids.blocked, { blocked: ["BR"] }),
          ],
        });
      }
      throw new Error(`URL inesperada: ${url}`);
    };

    const preview = await new YouTubeProvider(fetcher).previewPlaylist(
      "PL1234567890abcdef",
      { maxItems: 4, regionCode: "BR" },
    );

    expect(preview).toMatchObject({
      playlistTitle: "Minha & Playlist",
      declaredItemCount: 5,
      positionsScanned: 4,
      uniqueVideoCount: 3,
      duplicateCount: 1,
      isTruncated: true,
    });
    expect(preview.items.map(({ status }) => status)).toEqual([
      "ready",
      "duplicate",
      "not_embeddable",
      "region_blocked",
    ]);
  });

  it("classifica um ID malformado sem invalidar a prévia inteira", async () => {
    const fetcher: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/playlists")) {
        return json({
          items: [
            {
              snippet: { title: "Playlist" },
              contentDetails: { itemCount: 2 },
            },
          ],
        });
      }
      if (url.pathname.endsWith("/playlistItems")) {
        return json({
          items: [
            {
              snippet: { position: 0 },
              contentDetails: { videoId: "curto" },
            },
            {
              snippet: { position: 1 },
              contentDetails: { videoId: ids.ready },
            },
          ],
        });
      }
      if (url.pathname.endsWith("/videos")) {
        expect(url.searchParams.get("id")).toBe(ids.ready);
        return json({ items: [video(ids.ready)] });
      }
      throw new Error(`URL inesperada: ${url}`);
    };

    const preview = await new YouTubeProvider(fetcher).previewPlaylist(
      "PL1234567890abcdef",
      { maxItems: 200, regionCode: "BR" },
    );

    expect(preview.uniqueVideoCount).toBe(1);
    expect(preview.items.map(({ status }) => status)).toEqual([
      "invalid",
      "ready",
    ]);
  });
});

function video(
  id: string,
  options: { embeddable?: boolean; blocked?: string[] } = {},
) {
  return {
    id,
    snippet: {
      title: `Título ${id}`,
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
