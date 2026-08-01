import { describe, expect, it } from "vitest";

import {
  bracketSizeFromRoundCount,
  createBracket,
  pairRoundWinners,
  resolveMatchWinner,
  roundCountFromBracketSize,
  selectSongsForSession,
  shuffleRoundWinners,
} from "@/domain/bracket";

const songIds = (count: number) =>
  Array.from({ length: count }, (_, index) => `song-${index + 1}`);

describe("domínio do chaveamento", () => {
  it.each([4, 8, 16, 32, 64, 128] as const)(
    "cria a chave de %i músicas com N - 1 confrontos",
    (bracketSize) => {
      const bracket = createBracket(songIds(bracketSize), bracketSize);

      expect(bracket.matches).toHaveLength(bracketSize - 1);
      expect(
        bracket.matches.filter(({ roundNumber }) => roundNumber === 1),
      ).toHaveLength(bracketSize / 2);
      expect(
        bracket.matches
          .filter(({ roundNumber }) => roundNumber === 1)
          .every(
            ({ songAId, songBId, status }) =>
              songAId !== null && songBId !== null && status === "ready",
          ),
      ).toBe(true);
      expect(
        bracket.matches
          .filter(({ roundNumber }) => roundNumber > 1)
          .every(
            ({ songAId, songBId, status }) =>
              songAId === null && songBId === null && status === "pending",
          ),
      ).toBe(true);
    },
  );

  it("rejeita uma quantidade de músicas diferente do tamanho da chave", () => {
    expect(() => createBracket(songIds(3), 4)).toThrow(
      "A chave de 4 posições exige exatamente 4 músicas.",
    );
  });

  it("identifica somente a vencedora da final como campeã", () => {
    const bracket = createBracket(songIds(4), 4);
    const firstMatch = bracket.matches[0];
    const final = {
      ...bracket.matches.find(({ roundNumber }) => roundNumber === 2)!,
      songAId: "song-1",
      songBId: "song-2",
      status: "ready" as const,
    };

    expect(
      resolveMatchWinner(firstMatch, bracket.bracketSize, firstMatch.songAId!),
    ).toBeNull();
    expect(resolveMatchWinner(final, bracket.bracketSize, final.songBId)).toBe(
      "song-2",
    );
  });

  it("rejeita uma vencedora que não participa do confronto", () => {
    const bracket = createBracket(songIds(4), 4);

    expect(() =>
      resolveMatchWinner(bracket.matches[0], 4, "song-intrusa"),
    ).toThrow("A música vencedora não pertence a este confronto.");
  });

  it("rejeita um segundo voto no mesmo confronto", () => {
    const bracket = createBracket(songIds(4), 4);
    const match = { ...bracket.matches[0], status: "completed" as const };

    expect(() => resolveMatchWinner(match, 4, match.songAId!)).toThrow(
      "Este confronto já foi concluído.",
    );
  });
});

describe("tamanho da partida", () => {
  it.each([
    [2, 4],
    [3, 8],
    [4, 16],
    [5, 32],
    [6, 64],
    [7, 128],
  ] as const)(
    "converte %i rodadas em uma chave de %i músicas",
    (rounds, size) => {
      expect(bracketSizeFromRoundCount(rounds)).toBe(size);
      expect(roundCountFromBracketSize(size)).toBe(rounds);
    },
  );
});

describe("sorteio da sessão", () => {
  it("seleciona somente a quantidade pedida sem repetir músicas", () => {
    const catalog = songIds(10);
    const selected = selectSongsForSession(catalog, 4, () => 0);

    expect(selected).toHaveLength(4);
    expect(new Set(selected)).toHaveLength(4);
    expect(catalog).toEqual(songIds(10));
  });

  it("rejeita catálogos sem músicas suficientes", () => {
    expect(() => selectSongsForSession(songIds(3), 4)).toThrow(
      "O tema não possui músicas ativas suficientes para uma chave de 4.",
    );
  });
});

describe("sorteio de rodada", () => {
  it("embaralha todas as vencedoras sem alterar a lista recebida", () => {
    const winners = ["winner-1", "winner-2", "winner-3", "winner-4"];

    expect(shuffleRoundWinners(winners, () => 0)).toEqual([
      "winner-2",
      "winner-3",
      "winner-4",
      "winner-1",
    ]);
    expect(winners).toEqual(["winner-1", "winner-2", "winner-3", "winner-4"]);
  });

  it("forma os pares da próxima rodada na ordem sorteada", () => {
    expect(
      pairRoundWinners(["winner-2", "winner-3", "winner-4", "winner-1"]),
    ).toEqual([
      { songAId: "winner-2", songBId: "winner-3" },
      { songAId: "winner-4", songBId: "winner-1" },
    ]);
  });
});
