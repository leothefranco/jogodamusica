import { describe, expect, it } from "vitest";

import { getRoundLabel } from "@/domain/game/experience";

describe("experiência pública da partida", () => {
  it("nomeia a rodada e localiza o confronto dentro dela", () => {
    expect(
      getRoundLabel({
        bracketSize: 16,
        roundNumber: 1,
        matchPosition: 2,
      }),
    ).toBe("Oitavas de final · confronto 2 de 8");
    expect(
      getRoundLabel({
        bracketSize: 16,
        roundNumber: 4,
        matchPosition: 1,
      }),
    ).toBe("Final · confronto 1 de 1");
  });
});
