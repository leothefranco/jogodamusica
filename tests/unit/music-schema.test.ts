import { describe, expect, it } from "vitest";

import { songs, themeSongs } from "@/db/schema";

describe("ownership dos dados exibidos da música", () => {
  it("mantém título e artista na associação com o tema", () => {
    expect(themeSongs.title).toBeDefined();
    expect(themeSongs.artist).toBeDefined();
    expect("title" in songs).toBe(false);
    expect("artist" in songs).toBe(false);
  });
});
