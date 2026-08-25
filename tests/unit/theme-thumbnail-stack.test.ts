import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ThemeThumbnailStack } from "@/components/theme-thumbnail-stack";

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
});
