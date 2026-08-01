import { describe, expect, it } from "vitest";

import {
  advanceWinner,
  bracketSizeFromRoundCount,
  createBracket,
  roundCountFromBracketSize,
  selectSongsForSession,
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

  it("avança vencedores para os lados corretos do confronto seguinte", () => {
    const bracket = createBracket(songIds(4), 4);
    const [firstMatch, secondMatch] = bracket.matches.filter(
      ({ roundNumber }) => roundNumber === 1,
    );

    const afterFirstVote = advanceWinner(
      bracket,
      firstMatch.id,
      firstMatch.songBId!,
    );
    const finalAfterFirstVote = afterFirstVote.matches.find(
      ({ roundNumber }) => roundNumber === 2,
    );

    expect(finalAfterFirstVote).toMatchObject({
      songAId: firstMatch.songBId,
      songBId: null,
      status: "pending",
    });

    const afterSecondVote = advanceWinner(
      afterFirstVote,
      secondMatch.id,
      secondMatch.songAId!,
    );
    expect(
      afterSecondVote.matches.find(({ roundNumber }) => roundNumber === 2),
    ).toMatchObject({
      songAId: firstMatch.songBId,
      songBId: secondMatch.songAId,
      status: "ready",
    });
  });

  it("conclui a chave quando a final recebe um voto", () => {
    let bracket = createBracket(songIds(4), 4);
    for (const match of bracket.matches.filter(
      ({ roundNumber }) => roundNumber === 1,
    )) {
      bracket = advanceWinner(bracket, match.id, match.songAId!);
    }
    const final = bracket.matches.find(({ roundNumber }) => roundNumber === 2)!;

    bracket = advanceWinner(bracket, final.id, final.songBId!);

    expect(bracket).toMatchObject({
      status: "completed",
      championSongId: final.songBId,
    });
  });

  it("rejeita uma vencedora que não participa do confronto", () => {
    const bracket = createBracket(songIds(4), 4);

    expect(() =>
      advanceWinner(bracket, bracket.matches[0].id, "song-intrusa"),
    ).toThrow("A música vencedora não pertence a este confronto.");
  });

  it("rejeita um segundo voto no mesmo confronto", () => {
    const bracket = createBracket(songIds(4), 4);
    const match = bracket.matches[0];
    const voted = advanceWinner(bracket, match.id, match.songAId!);

    expect(() => advanceWinner(voted, match.id, match.songAId!)).toThrow(
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
