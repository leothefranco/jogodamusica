import { describe, expect, it, vi } from "vitest";

import { createPublicThemeService } from "@/server/services/public-theme-service";

const theme = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "Clássicos da festa",
  slug: "classicos-da-festa",
  description: "Músicas para cantar junto.",
  coverUrl: null,
  activeSongCount: 10,
};

describe("catálogo público de temas", () => {
  it("expõe modalidades compatíveis sem escolher um padrão", async () => {
    const service = createPublicThemeService({
      listPlayableThemes: vi.fn().mockResolvedValue([theme]),
      findPlayableThemeBySlug: vi.fn(),
    });

    await expect(service.listThemes()).resolves.toEqual([
      {
        ...theme,
        supportedBracketSizes: [4, 8],
      },
    ]);
  });

  it("retorna null quando o slug não identifica um tema jogável", async () => {
    const service = createPublicThemeService({
      listPlayableThemes: vi.fn(),
      findPlayableThemeBySlug: vi.fn().mockResolvedValue(null),
    });

    await expect(service.getTheme("fora-do-ar")).resolves.toBeNull();
  });
});
