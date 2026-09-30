import { describe, expect, it } from "vitest";

import { createAdminManifest, createPublicManifest } from "@/lib/pwa-manifest";

describe("manifesto da PWA", () => {
  it("expõe a identidade instalável e os dois ícones obrigatórios", () => {
    expect(createPublicManifest()).toEqual({
      name: "Last Track Standing",
      short_name: "Last Track",
      description:
        "Compare músicas em confrontos eliminatórios e descubra a campeã do grupo.",
      start_url: "/",
      scope: "/",
      display: "standalone",
      lang: "pt-BR",
      orientation: "any",
      background_color: "#101216",
      theme_color: "#101216",
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
        {
          src: "/icons/icon-maskable-192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "maskable",
        },
        {
          src: "/icons/icon-maskable-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    });
  });

  it("separa a instalação administrativa por nome, escopo e cor", () => {
    expect(createAdminManifest()).toEqual({
      id: "/admin",
      name: "Last Track Standing Admin",
      short_name: "LTS Admin",
      description: "Administre temas e músicas do Last Track Standing.",
      start_url: "/admin",
      scope: "/admin",
      display: "standalone",
      lang: "pt-BR",
      orientation: "any",
      background_color: "#101216",
      theme_color: "#181C22",
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
          src: "/icons/admin-icon-maskable-192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "maskable",
        },
        {
          src: "/icons/admin-icon-maskable-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    });
  });
});
