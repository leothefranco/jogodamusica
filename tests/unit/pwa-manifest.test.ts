import { describe, expect, it } from "vitest";

import manifest from "@/app/manifest";

describe("manifesto da PWA", () => {
  it("expõe a identidade instalável e os dois ícones obrigatórios", () => {
    expect(manifest()).toMatchObject({
      name: "Jogo da Música",
      short_name: "Jogo Música",
      start_url: "/",
      scope: "/",
      display: "standalone",
      lang: "pt-BR",
      background_color: "#08080f",
      theme_color: "#08080f",
      icons: [
        {
          src: "/icons/icon-192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          src: "/icons/icon-512.png",
          sizes: "512x512",
          type: "image/png",
        },
      ],
    });
  });
});
