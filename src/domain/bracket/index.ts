import type { BracketSize } from "@/domain/music/content-validation";
import { AppError } from "@/lib/errors";

export type RoundCount = 2 | 3 | 4 | 5;
export type MatchStatus = "pending" | "ready" | "completed";

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

type MatchIdFactory = (roundNumber: number, position: number) => string;

const defaultMatchId: MatchIdFactory = (roundNumber, position) =>
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
        id: createMatchId(roundNumber, position),
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

export function advanceWinner(
  bracket: Bracket,
  matchId: string,
  winnerSongId: string,
): Bracket {
  const match = bracket.matches.find(({ id }) => id === matchId);
  if (!match) {
    throw new AppError(
      "MATCH_NOT_FOUND",
      "Confronto não encontrado nesta chave.",
      404,
    );
  }
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
  if (![match.songAId, match.songBId].includes(winnerSongId)) {
    throw new AppError(
      "INVALID_MATCH_WINNER",
      "A música vencedora não pertence a este confronto.",
    );
  }

  const matches = bracket.matches.map((item) =>
    item.id === matchId
      ? {
          ...item,
          winnerSongId,
          status: "completed" as const,
        }
      : { ...item },
  );
  const isFinal =
    match.roundNumber === roundCountFromBracketSize(bracket.bracketSize);

  if (isFinal) {
    return {
      ...bracket,
      status: "completed",
      championSongId: winnerSongId,
      matches,
    };
  }

  const nextRoundNumber = match.roundNumber + 1;
  const nextPosition = Math.ceil(match.position / 2);
  const nextMatchIndex = matches.findIndex(
    ({ roundNumber, position }) =>
      roundNumber === nextRoundNumber && position === nextPosition,
  );
  const nextMatch = matches[nextMatchIndex];
  const winnerSlot = match.position % 2 === 1 ? "songAId" : "songBId";
  const advancedMatch = { ...nextMatch, [winnerSlot]: winnerSongId };

  matches[nextMatchIndex] = {
    ...advancedMatch,
    status:
      advancedMatch.songAId && advancedMatch.songBId ? "ready" : "pending",
  };

  return { ...bracket, matches };
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

  const shuffled = [...songs];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }

  return shuffled.slice(0, bracketSize);
}
