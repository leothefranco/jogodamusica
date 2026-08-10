import { describe, expect, it } from "vitest";

import {
  bracketSizeFromRoundCount,
  createBracket,
  roundCountFromBracketSize,
  selectSongsForSession,
  transitionBracket,
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
      transitionBracket({
        bracketSize: bracket.bracketSize,
        currentMatch: firstMatch,
        decision: { type: "vote", winnerSongId: firstMatch.songAId! },
        roundMatches: bracket.matches.filter(
          ({ roundNumber }) => roundNumber === 1,
        ),
      }).session.championSongId,
    ).toBeNull();
    expect(
      transitionBracket({
        bracketSize: bracket.bracketSize,
        currentMatch: final,
        decision: { type: "vote", winnerSongId: final.songBId },
        roundMatches: [final],
      }).session.championSongId,
    ).toBe("song-2");
  });

  it("rejeita uma vencedora que não participa do confronto", () => {
    const bracket = createBracket(songIds(4), 4);

    expect(() =>
      transitionBracket({
        bracketSize: 4,
        currentMatch: bracket.matches[0],
        decision: { type: "vote", winnerSongId: "song-intrusa" },
        roundMatches: bracket.matches.filter(
          ({ roundNumber }) => roundNumber === 1,
        ),
      }),
    ).toThrow("A música vencedora não pertence a este confronto.");
  });

  it("rejeita um segundo voto no mesmo confronto", () => {
    const bracket = createBracket(songIds(4), 4);
    const match = { ...bracket.matches[0], status: "completed" as const };

    expect(() =>
      transitionBracket({
        bracketSize: 4,
        currentMatch: match,
        decision: { type: "vote", winnerSongId: match.songAId! },
        roundMatches: [match],
      }),
    ).toThrow("Este confronto já foi concluído.");
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
  it("mantém a rodada enquanto ainda existe confronto incompleto", () => {
    const bracket = createBracket(songIds(4), 4);
    const currentMatch = bracket.matches[0];

    expect(
      transitionBracket({
        bracketSize: 4,
        currentMatch,
        decision: { type: "vote", winnerSongId: currentMatch.songAId! },
        roundMatches: bracket.matches.filter(
          ({ roundNumber }) => roundNumber === currentMatch.roundNumber,
        ),
      }),
    ).toEqual({
      completedMatch: {
        matchId: currentMatch.id,
        winnerSongId: currentMatch.songAId,
      },
      nextRound: null,
      session: {
        championSongId: null,
        currentRound: 1,
        status: "active",
      },
    });
  });

  it("forma a próxima rodada quando a decisão conclui a rodada atual", () => {
    const bracket = createBracket(songIds(8), 8);
    const roundMatches = bracket.matches
      .filter(({ roundNumber }) => roundNumber === 1)
      .map((match, index) =>
        index < 3
          ? {
              ...match,
              status: "completed" as const,
              winnerSongId: match.songAId,
            }
          : match,
      );
    const currentMatch = roundMatches[3];

    expect(
      transitionBracket({
        bracketSize: 8,
        currentMatch,
        decision: { type: "vote", winnerSongId: currentMatch.songAId! },
        random: () => 0,
        roundMatches,
      }),
    ).toEqual({
      completedMatch: {
        matchId: currentMatch.id,
        winnerSongId: "song-7",
      },
      nextRound: {
        roundNumber: 2,
        pairs: [
          { songAId: "song-3", songBId: "song-5" },
          { songAId: "song-7", songBId: "song-1" },
        ],
      },
      session: {
        championSongId: null,
        currentRound: 2,
        status: "active",
      },
    });
  });

  it("conclui a partida quando a decisão resolve a final", () => {
    const final = {
      ...createBracket(songIds(4), 4).matches.find(
        ({ roundNumber }) => roundNumber === 2,
      )!,
      songAId: "song-1",
      songBId: "song-3",
      status: "ready" as const,
    };

    expect(
      transitionBracket({
        bracketSize: 4,
        currentMatch: final,
        decision: { type: "tiebreak" },
        random: () => 0.9,
        roundMatches: [final],
      }),
    ).toEqual({
      completedMatch: {
        matchId: final.id,
        winnerSongId: "song-3",
      },
      nextRound: null,
      session: {
        championSongId: "song-3",
        currentRound: 2,
        status: "completed",
      },
    });
  });

  it("rejeita uma transição sem o contexto completo da rodada", () => {
    const currentMatch = createBracket(songIds(4), 4).matches[0];

    expect(() =>
      transitionBracket({
        bracketSize: 4,
        currentMatch,
        decision: { type: "vote", winnerSongId: currentMatch.songAId! },
        roundMatches: [],
      }),
    ).toThrow("O contexto da rodada não contém o confronto atual.");
  });
});
