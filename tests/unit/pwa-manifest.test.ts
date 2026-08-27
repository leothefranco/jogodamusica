import { describe, expect, it } from "vitest";

import { createAdminManifest, createPublicManifest } from "@/lib/pwa-manifest";

describe("manifesto da PWA", () => {
  it("expõe a identidade instalável e os dois ícones obrigatórios", () => {
    expect(createPublicManifest()).toEqual({
      name: "Jogo da Música",
      short_name: "Jogo da Música",
      description:
        "Compare músicas em confrontos eliminatórios e descubra a campeã do grupo.",
      start_url: "/",
      scope: "/",
      display: "standalone",
      lang: "pt-BR",
      orientation: "any",
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
    expect(createAdminManifest()).toEqual({
      id: "/admin",
      name: "Jogo da Música Admin",
      short_name: "Jogo da Música Admin",
      description: "Administre temas e músicas do Jogo da Música.",
      start_url: "/admin",
      scope: "/admin",
      display: "standalone",
      lang: "pt-BR",
      orientation: "any",
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
