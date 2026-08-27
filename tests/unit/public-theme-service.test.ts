import { describe, expect, it, vi } from "vitest";

import { createPublicThemeService } from "@/server/services/public-theme-service";

const theme = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "Clássicos da festa",
  slug: "classicos-da-festa",
  description: "Músicas para cantar junto.",
  coverUrl: null,
  thumbnailUrls: [
    "https://i.ytimg.com/vi/primeira/hqdefault.jpg",
    "https://i.ytimg.com/vi/segunda/hqdefault.jpg",
  ],
  activeSongCount: 10,
};

function themeWithCount(activeSongCount: number) {
  return {
    ...theme,
    id: `10000000-0000-4000-8000-${String(activeSongCount).padStart(12, "0")}`,
    slug: `tema-${activeSongCount}`,
    activeSongCount,
  };
}

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

  it("oculta três candidatas e publica quatro somente na modalidade mínima", async () => {
    const service = createPublicThemeService({
      listPlayableThemes: vi
        .fn()
        .mockResolvedValue([themeWithCount(3), themeWithCount(4)]),
      findPlayableThemeBySlug: vi
        .fn()
        .mockResolvedValueOnce(themeWithCount(3))
        .mockResolvedValueOnce(themeWithCount(4)),
    });

    await expect(service.listThemes()).resolves.toEqual([
      {
        ...themeWithCount(4),
        supportedBracketSizes: [4],
      },
    ]);
    await expect(service.getTheme("tema-3")).resolves.toBeNull();
    await expect(service.getTheme("tema-4")).resolves.toMatchObject({
      activeSongCount: 4,
      supportedBracketSizes: [4],
    });
  });

  it.each([
    [31, [4, 8, 16]],
    [32, [4, 8, 16, 32]],
    [63, [4, 8, 16, 32]],
    [64, [4, 8, 16, 32, 64]],
  ] as const)(
    "deriva somente as modalidades suportadas no limite literal %i",
    async (activeSongCount, supportedBracketSizes) => {
      const record = themeWithCount(activeSongCount);
      const service = createPublicThemeService({
        listPlayableThemes: vi.fn().mockResolvedValue([record]),
        findPlayableThemeBySlug: vi.fn().mockResolvedValue(record),
      });

      await expect(service.listThemes()).resolves.toEqual([
        { ...record, supportedBracketSizes: [...supportedBracketSizes] },
      ]);
      await expect(service.getTheme(record.slug)).resolves.toMatchObject({
        supportedBracketSizes: [...supportedBracketSizes],
      });
    },
  );
});
