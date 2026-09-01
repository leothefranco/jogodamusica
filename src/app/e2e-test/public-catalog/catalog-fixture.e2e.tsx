import { headers } from "next/headers";
import { notFound } from "next/navigation";

import type { PlayableThemeRecord } from "@/server/repositories/public-theme-repository";
import { createPublicThemeService } from "@/server/services/public-theme-service";

export const publicCatalogThemeId = "10000000-0000-4000-8000-000000000008";

const themes: PlayableThemeRecord[] = [
  {
    id: "10000000-0000-4000-8000-000000000003",
    name: "Tema legado três",
    slug: "tema-legado-tres",
    description: "Este conteúdo precisa permanecer oculto.",
    coverUrl: null,
    thumbnailUrls: [],
    activeSongCount: 3,
  },
  {
    id: publicCatalogThemeId,
    name: "Tema do tracer",
    slug: "tema-do-tracer",
    description: "Catálogo controlado do fluxo público.",
    coverUrl: null,
    thumbnailUrls: [],
    activeSongCount: 8,
  },
];

const service = createPublicThemeService({
  async listPlayableThemes() {
    return themes;
  },
  async findPlayableThemeBySlug(slug) {
    return themes.find((theme) => theme.slug === slug) ?? null;
  },
});

export const listCatalogThemes = service.listThemes;
export const findCatalogTheme = service.getTheme;

export async function requirePublicCatalogFixture() {
  const requestHeaders = await headers();
  if (requestHeaders.get("x-e2e-test") !== "public-catalog") notFound();
}
