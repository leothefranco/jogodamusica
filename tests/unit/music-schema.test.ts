import { describe, expect, it } from "vitest";

import { songs, themes, themeSongs } from "@/db/schema";

describe("ownership dos dados exibidos da música", () => {
  it("mantém título e artista na associação com o tema", () => {
    expect(themeSongs.title).toBeDefined();
    expect(themeSongs.artist).toBeDefined();
    expect("title" in songs).toBe(false);
    expect("artist" in songs).toBe(false);
  });
});

describe("configuração do tema", () => {
  it("não persiste modalidade padrão", () => {
    expect("defaultBracketSize" in themes).toBe(false);
  });
});
