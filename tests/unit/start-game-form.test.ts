import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { StartGameForm } from "@/components/game/start-game-form";

describe("escolha da modalidade", () => {
  it("prioriza 32/64, agrupa rápidas e deixa 128 nas opções estendidas", () => {
    const html = renderToStaticMarkup(
      createElement(StartGameForm, {
        themeId: "10000000-0000-4000-8000-000000000128",
        activeSongCount: 128,
        supportedBracketSizes: [4, 8, 16, 32, 64, 128],
        modeGroups: { primary: [32, 64], quick: [4, 8, 16], extended: [128] },
      }),
    );
    expect(html).toContain("Principais");
    expect(html).toContain("Rápidas");
    expect(html).toContain("Mais opções");
    expect(html.indexOf('value="32"')).toBeLessThan(html.indexOf('value="4"'));
    expect(html.indexOf('value="128"')).toBeGreaterThan(
      html.indexOf('value="16"'),
    );
    expect(html).not.toContain('checked=""');
  });
  it("começa sem modalidade marcada e com início desabilitado", () => {
    const html = renderToStaticMarkup(
      createElement(StartGameForm, {
        themeId: "10000000-0000-4000-8000-000000000010",
        activeSongCount: 8,
        supportedBracketSizes: [4, 8],
      }),
    );

    expect(html).not.toContain('checked=""');
    expect(html).toContain('disabled=""');
    expect(html).toContain("Escolha uma modalidade");
  });
});
