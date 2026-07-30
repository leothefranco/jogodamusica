import { describe, expect, it } from "vitest";

import {
  createPlaybackGate,
  getRoundLabel,
  markSongStarted,
} from "@/domain/game/experience";

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

  it("libera o voto somente depois de iniciar as duas músicas do confronto", () => {
    const initial = createPlaybackGate("match-1");
    const afterA = markSongStarted(initial, "song-a");
    const afterB = markSongStarted(afterA, "song-b");

    expect(initial.canVote).toBe(false);
    expect(afterA.canVote).toBe(false);
    expect(afterB.canVote).toBe(true);
  });

  it("reinicia a escuta ao avançar para outro confronto", () => {
    const previous = markSongStarted(
      markSongStarted(createPlaybackGate("match-1"), "song-a"),
      "song-b",
    );

    expect(createPlaybackGate("match-2", previous).canVote).toBe(false);
  });
});
