import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site";

export function createPublicManifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.name,
    short_name: siteConfig.shortName,
    description: siteConfig.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#08080f",
    theme_color: "#08080f",
    lang: siteConfig.locale,
    orientation: "any",
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
  };
}

export function createAdminManifest(): MetadataRoute.Manifest {
  return {
    id: "/admin",
    name: "Jogo da Música Admin",
    short_name: "Jogo da Música Admin",
    description: "Administre temas e músicas do Jogo da Música.",
    start_url: "/admin",
    scope: "/admin",
    display: "standalone",
    background_color: "#08080f",
    theme_color: "#059669",
    lang: "pt-BR",
    orientation: "any",
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
  };
}
