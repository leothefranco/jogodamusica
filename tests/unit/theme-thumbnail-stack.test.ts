import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  createThemeVisualFailures,
  recordThemeVisualFailure,
  selectThemeVisualCandidates,
  ThemeThumbnailStack,
} from "@/components/theme-thumbnail-stack";

describe("capa pública do tema", () => {
  it("prioriza a imagem personalizada sobre as miniaturas das músicas", () => {
    const customCoverUrl = "https://example.com/summer-eletrohits.jpg";
    const songThumbnailUrl = "https://i.ytimg.com/vi/summer-song/hqdefault.jpg";

    const html = renderToStaticMarkup(
      createElement(ThemeThumbnailStack, {
        thumbnailUrls: [songThumbnailUrl],
        fallbackCoverUrl: customCoverUrl,
      }),
    );

    expect(html).toContain(customCoverUrl);
    expect(html).not.toContain(songThumbnailUrl);
  });

  it("deduplica as miniaturas antes de limitar a seleção editorial", () => {
    const first = "https://i.ytimg.com/vi/first/hqdefault.jpg";
    const second = "https://i.ytimg.com/vi/second/hqdefault.jpg";
    const third = "https://i.ytimg.com/vi/third/hqdefault.jpg";
    const fourth = "https://i.ytimg.com/vi/fourth/hqdefault.jpg";
    const ignored = "https://i.ytimg.com/vi/ignored/hqdefault.jpg";

    const selection = selectThemeVisualCandidates(
      {
        fallbackCoverUrl: null,
        thumbnailUrls: [first, first, second, third, fourth, ignored],
      },
      createThemeVisualFailures(),
    );

    expect(selection).toEqual({
      kind: "thumbnails",
      urls: [first, second, third, fourth],
    });
  });

  it("remove somente as candidatas que falharam, independentemente da ordem", () => {
    const cover = "https://example.com/cover.jpg";
    const thumbnails = [
      "https://i.ytimg.com/vi/first/hqdefault.jpg",
      "https://i.ytimg.com/vi/second/hqdefault.jpg",
      "https://i.ytimg.com/vi/third/hqdefault.jpg",
      "https://i.ytimg.com/vi/fourth/hqdefault.jpg",
      "https://i.ytimg.com/vi/fifth/hqdefault.jpg",
    ];
    const props = { fallbackCoverUrl: cover, thumbnailUrls: thumbnails };

    const coverFailed = recordThemeVisualFailure(
      createThemeVisualFailures(),
      cover,
    );
    const firstOrder = recordThemeVisualFailure(
      recordThemeVisualFailure(coverFailed, thumbnails[0]),
      thumbnails[2],
    );
    const secondOrder = recordThemeVisualFailure(
      recordThemeVisualFailure(coverFailed, thumbnails[2]),
      thumbnails[0],
    );

    expect(selectThemeVisualCandidates(props, firstOrder)).toEqual({
      kind: "thumbnails",
      urls: [thumbnails[1], thumbnails[3]],
    });
    expect(selectThemeVisualCandidates(props, secondOrder)).toEqual({
      kind: "thumbnails",
      urls: [thumbnails[1], thumbnails[3]],
    });
  });

  it("não reintroduz uma URL falha quando as props são avaliadas novamente", () => {
    const failedUrl = "https://i.ytimg.com/vi/broken/hqdefault.jpg";
    const validUrl = "https://i.ytimg.com/vi/valid/hqdefault.jpg";
    const failures = recordThemeVisualFailure(
      createThemeVisualFailures(),
      failedUrl,
    );

    const rerendered = selectThemeVisualCandidates(
      {
        fallbackCoverUrl: failedUrl,
        thumbnailUrls: [failedUrl, validUrl, failedUrl],
      },
      failures,
    );

    expect(rerendered).toEqual({ kind: "thumbnails", urls: [validUrl] });
  });

  it("termina no placeholder quando todas as candidatas falham", () => {
    const cover = "https://example.com/cover.jpg";
    const thumbnail = "https://i.ytimg.com/vi/broken/hqdefault.jpg";
    const failures = recordThemeVisualFailure(
      recordThemeVisualFailure(createThemeVisualFailures(), cover),
      thumbnail,
    );

    expect(
      selectThemeVisualCandidates(
        { fallbackCoverUrl: cover, thumbnailUrls: [thumbnail] },
        failures,
      ),
    ).toEqual({ kind: "placeholder" });
  });

  it("reserva no HTML inicial um placeholder editorial quando não há imagem", () => {
    const html = renderToStaticMarkup(
      createElement(ThemeThumbnailStack, {
        thumbnailUrls: [],
        fallbackCoverUrl: null,
        className: "aspect-[16/9]",
      }),
    );

    expect(html).toContain('data-theme-visual="placeholder"');
    expect(html).toContain("Jogo da Música");
    expect(html).toContain("aspect-[16/9]");
  });
});
