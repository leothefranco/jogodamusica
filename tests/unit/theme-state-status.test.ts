import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { ThemeStateStatus } from "@/components/admin/theme-state-status";
import { SupportedGameModes } from "@/components/admin/supported-game-modes";
import { classifyThemeState } from "@/domain/music/theme-state";

it("admin separa intenção, visibilidade e suspensão com contagens explicadas", () => {
  const state = classifyThemeState({
    editorialState: "published",
    counts: {
      availableFresh: 3,
      availableGrace: 0,
      unavailable: 0,
      unknown: 1,
    },
  });
  const html = renderToStaticMarkup(createElement(ThemeStateStatus, { state }));
  for (const text of [
    "Publicação",
    "Publicado",
    "Visibilidade derivada",
    "Oculto",
    "Estado operacional",
    "Suspenso: verificação pendente",
    "3 jogáveis",
    "4 potenciais",
    "1 desconhecida",
  ])
    expect(html).toContain(text);
  expect(html).toContain("A intenção de publicação é preservada");
});

it("destaca 32/64 antes das rápidas e deixa 128 como estendida", () => {
  const state = classifyThemeState({
    editorialState: "published",
    counts: {
      availableFresh: 128,
      availableGrace: 0,
      unavailable: 0,
      unknown: 0,
    },
  });
  const html = renderToStaticMarkup(
    createElement(SupportedGameModes, { modes: state.modes }),
  );
  expect(html).toContain('aria-label="Modalidades principais"');
  expect(html).toContain('aria-label="Modalidades rápidas"');
  expect(html).toContain('aria-label="Modalidade estendida"');
  expect(html.indexOf("32 músicas")).toBeLessThan(html.indexOf(">4 músicas"));
  expect(html.indexOf("64 músicas")).toBeLessThan(html.indexOf(">4 músicas"));
  expect(html.indexOf("16 músicas")).toBeLessThan(html.indexOf("128 músicas"));
});
