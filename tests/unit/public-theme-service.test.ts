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
  it("remove campos internos acidentais também no guardrail legado e mede sem inventar saúde", async () => {
    const events: unknown[] = [];
    const internal = {
      ...theme,
      region: "BR",
      sourceIds: ["private-source"],
      confirmedState: "unavailable",
      policyVersion: 999,
      revision: 100,
    };
    const service = createPublicThemeService({
      listPlayableThemes: async () => [internal],
      findPlayableThemeBySlug: async () => internal,
      metrics: {
        record(event) {
          events.push(event);
        },
      },
    });
    expect(await service.listThemes()).toEqual([
      { ...theme, supportedBracketSizes: [4, 8] },
    ]);
    expect(await service.getTheme(theme.slug)).toEqual({
      ...theme,
      supportedBracketSizes: [4, 8],
    });
    expect(events).toEqual(
      [0, 1].map(() => ({
        metric: "public_catalog_read",
        mode: "legacy_guardrail",
        policyVersion: 1,
        durationMs: expect.any(Number),
        examinedThemes: 1,
        visibleThemes: 1,
        states: null,
      })),
    );
  });

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
