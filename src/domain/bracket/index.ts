import type { BracketSize } from "@/domain/music/content-validation";
import { AppError } from "@/lib/errors";

export type RoundCount = 2 | 3 | 4 | 5 | 6 | 7;
export type MatchStatus = "pending" | "ready" | "completed";
export type MatchCoordinate = {
  roundNumber: number;
  position: number;
};

export type BracketMatch = {
  id: string;
  roundNumber: number;
  position: number;
  songAId: string | null;
  songBId: string | null;
  winnerSongId: string | null;
  status: MatchStatus;
};

export type Bracket = {
  bracketSize: BracketSize;
  status: "active" | "completed";
  championSongId: string | null;
  matches: BracketMatch[];
};

export type RoundMatchPair = {
  songAId: string;
  songBId: string;
};

export type MatchDecision =
  { type: "vote"; winnerSongId: string } | { type: "tiebreak" };

export type ResolvedMatchDecision = {
  winnerSongId: string;
  championSongId: string | null;
};

export type BracketTransition = {
  completedMatch: {
    matchId: string;
    winnerSongId: string;
  };
  nextRound: {
    roundNumber: number;
    pairs: RoundMatchPair[];
  } | null;
  session: {
    status: "active" | "completed";
    currentRound: number;
    championSongId: string | null;
  };
};

type MatchIdFactory = (coordinate: MatchCoordinate) => string;

const defaultMatchId: MatchIdFactory = ({ roundNumber, position }) =>
  `round-${roundNumber}-match-${position}`;

export function roundCountFromBracketSize(
  bracketSize: BracketSize,
): RoundCount {
  return Math.log2(bracketSize) as RoundCount;
}

export function bracketSizeFromRoundCount(roundCount: RoundCount): BracketSize {
  return (2 ** roundCount) as BracketSize;
}

export function createBracket(
  songIds: string[],
  bracketSize: BracketSize,
  createMatchId: MatchIdFactory = defaultMatchId,
): Bracket {
  if (songIds.length !== bracketSize) {
    throw new AppError(
      "INVALID_BRACKET_SONG_COUNT",
      `A chave de ${bracketSize} posições exige exatamente ${bracketSize} músicas.`,
    );
  }
  if (new Set(songIds).size !== songIds.length) {
    throw new AppError(
      "DUPLICATE_BRACKET_SONG",
      "Uma música não pode ocupar mais de uma posição na chave.",
    );
  }

  const matches: BracketMatch[] = [];
  const roundCount = roundCountFromBracketSize(bracketSize);

  for (let roundNumber = 1; roundNumber <= roundCount; roundNumber += 1) {
    const matchesInRound = bracketSize / 2 ** roundNumber;
    for (let position = 1; position <= matchesInRound; position += 1) {
      const firstSongIndex = (position - 1) * 2;
      const isFirstRound = roundNumber === 1;
      matches.push({
        id: createMatchId({ roundNumber, position }),
        roundNumber,
        position,
        songAId: isFirstRound ? songIds[firstSongIndex] : null,
        songBId: isFirstRound ? songIds[firstSongIndex + 1] : null,
        winnerSongId: null,
        status: isFirstRound ? "ready" : "pending",
      });
    }
  }

  return {
    bracketSize,
    status: "active",
    championSongId: null,
    matches,
  };
}

function resolveMatchDecision(
  match: BracketMatch,
  bracketSize: BracketSize,
  decision: MatchDecision,
  random: () => number = Math.random,
): ResolvedMatchDecision {
  if (match.status === "completed") {
    throw new AppError(
      "MATCH_ALREADY_COMPLETED",
      "Este confronto já foi concluído.",
      409,
    );
  }
  if (match.status !== "ready") {
    throw new AppError(
      "MATCH_NOT_READY",
      "Este confronto ainda não está pronto para votação.",
      409,
    );
  }
  if (!match.songAId || !match.songBId) {
    throw new AppError(
      "INVALID_BRACKET_STATE",
      "O confronto pronto precisa de duas participantes.",
      500,
    );
  }

  const participants = [match.songAId, match.songBId] as const;
  const winnerSongId =
    decision.type === "vote"
      ? decision.winnerSongId
      : participants[Math.floor(random() * participants.length)];
  if (!participants.includes(winnerSongId)) {
    throw new AppError(
      "INVALID_MATCH_WINNER",
      "A música vencedora não pertence a este confronto.",
    );
  }

  if (match.roundNumber === roundCountFromBracketSize(bracketSize)) {
    return { winnerSongId, championSongId: winnerSongId };
  }

  return { winnerSongId, championSongId: null };
}

export function transitionBracket(input: {
  bracketSize: BracketSize;
  currentMatch: BracketMatch;
  decision: MatchDecision;
  roundMatches: readonly BracketMatch[];
  random?: () => number;
}): BracketTransition {
  const hasCurrentMatch = input.roundMatches.some(
    (match) => match.id === input.currentMatch.id,
  );
  const hasOnlyCurrentRound = input.roundMatches.every(
    (match) => match.roundNumber === input.currentMatch.roundNumber,
  );
  if (!hasCurrentMatch || !hasOnlyCurrentRound) {
    throw new AppError(
      "INVALID_BRACKET_STATE",
      "O contexto da rodada não contém o confronto atual.",
      500,
    );
  }

  const { winnerSongId, championSongId } = resolveMatchDecision(
    input.currentMatch,
    input.bracketSize,
    input.decision,
    input.random,
  );

  const completedMatch = {
    matchId: input.currentMatch.id,
    winnerSongId,
  };

  if (championSongId) {
    return {
      completedMatch,
      nextRound: null,
      session: {
        status: "completed",
        currentRound: input.currentMatch.roundNumber,
        championSongId,
      },
    };
  }

  const roundIsComplete = input.roundMatches.every(
    (match) =>
      match.id === input.currentMatch.id || match.status === "completed",
  );

  if (roundIsComplete) {
    const winnerSongIds = [...input.roundMatches]
      .sort((left, right) => left.position - right.position)
      .map((match) =>
        match.id === input.currentMatch.id ? winnerSongId : match.winnerSongId,
      );
    if (winnerSongIds.some((songId) => !songId)) {
      throw new AppError(
        "INVALID_BRACKET_STATE",
        "Uma rodada concluída possui confronto sem vencedora.",
        500,
      );
    }
    const nextRoundNumber = input.currentMatch.roundNumber + 1;

    return {
      completedMatch,
      nextRound: {
        roundNumber: nextRoundNumber,
        pairs: pairRoundWinners(
          shuffleRoundWinners(
            winnerSongIds as string[],
            input.random ?? Math.random,
          ),
        ),
      },
      session: {
        status: "active",
        currentRound: nextRoundNumber,
        championSongId: null,
      },
    };
  }

  return {
    completedMatch,
    nextRound: null,
    session: {
      status: "active",
      currentRound: input.currentMatch.roundNumber,
      championSongId: null,
    },
  };
}

export function selectSongsForSession<T>(
  songs: readonly T[],
  bracketSize: BracketSize,
  random: () => number = Math.random,
): T[] {
  if (songs.length < bracketSize) {
    throw new AppError(
      "INSUFFICIENT_ACTIVE_SONGS",
      `O tema não possui músicas ativas suficientes para uma chave de ${bracketSize}.`,
      409,
    );
  }

  return shuffleItems(songs, random).slice(0, bracketSize);
}

function shuffleRoundWinners(
  winners: readonly string[],
  random: () => number = Math.random,
): string[] {
  return shuffleItems(winners, random);
}

function pairRoundWinners(winnerSongIds: readonly string[]): RoundMatchPair[] {
  if (
    winnerSongIds.length % 2 !== 0 ||
    new Set(winnerSongIds).size !== winnerSongIds.length
  ) {
    throw new AppError(
      "INVALID_ROUND_WINNERS",
      "As vencedoras da rodada não formam pares únicos.",
      500,
    );
  }

  return Array.from({ length: winnerSongIds.length / 2 }, (_, index) => ({
    songAId: winnerSongIds[index * 2],
    songBId: winnerSongIds[index * 2 + 1],
  }));
}

function shuffleItems<T>(items: readonly T[], random: () => number): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }

  return shuffled;
}
