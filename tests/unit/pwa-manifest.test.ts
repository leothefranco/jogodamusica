import { describe, expect, it } from "vitest";

import { createAdminManifest } from "@/app/admin/manifest.webmanifest/route";
import { createPublicManifest } from "@/app/manifest.webmanifest/route";

describe("manifesto da PWA", () => {
  it("expõe a identidade instalável e os dois ícones obrigatórios", () => {
    expect(createPublicManifest()).toMatchObject({
      name: "Jogo da Música",
      short_name: "Jogo da Música",
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

  it("separa a instalação administrativa por nome, escopo e cor", () => {
    expect(createAdminManifest()).toMatchObject({
      id: "/admin",
      name: "Jogo da Música Admin",
      short_name: "Jogo da Música Admin",
      start_url: "/admin",
      scope: "/admin",
      display: "standalone",
      lang: "pt-BR",
      background_color: "#08080f",
      theme_color: "#059669",
      icons: [
        {
          src: "/icons/admin-icon-192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/icons/admin-icon-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/icons/admin-icon-192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "maskable",
        },
        {
          src: "/icons/admin-icon-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    });
  });
});
