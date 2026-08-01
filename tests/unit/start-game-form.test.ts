import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { StartGameForm } from "@/components/game/start-game-form";

describe("escolha da modalidade", () => {
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
