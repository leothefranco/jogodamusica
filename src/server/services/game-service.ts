import "server-only";

import { randomUUID } from "node:crypto";

import {
  createBracket,
  roundCountFromBracketSize,
  selectSongsForSession,
  type BracketMatch,
} from "@/domain/bracket";
import type { BracketSize } from "@/domain/music/content-validation";
import { AppError } from "@/lib/errors";
import {
  withGameCreationTransaction,
  withGameVoteTransaction,
} from "@/server/repositories/game-repository";

export type ActiveThemeSong = {
  songId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  provider: "youtube";
  providerContentId: string;
  startTimeSeconds: number;
  previewDurationSeconds: number;
};

export type GameTheme = {
  id: string;
  isActive: boolean;
  songs: ActiveThemeSong[];
};

export type PersistedGameSession = {
  id: string;
  themeId: string;
  bracketSize: BracketSize;
  status: "active" | "completed" | "abandoned";
  currentRound: number;
  championSongId: string | null;
  startedAt: Date;
  completedAt: Date | null;
};

export type SessionSongSnapshot = ActiveThemeSong & {
  sessionId: string;
  seed: number;
};

export type PersistedGameMatch = BracketMatch & {
  sessionId: string;
  completedAt: Date | null;
};

export type GameCreationRepository = {
  getThemeWithActiveSongs(): Promise<GameTheme | null>;
  insertSession(session: PersistedGameSession): Promise<void>;
  insertSessionSongs(songs: SessionSongSnapshot[]): Promise<void>;
  insertMatches(matches: PersistedGameMatch[]): Promise<void>;
};

export type MatchSongSlot = "songAId" | "songBId";

export type GameVoteRepository = {
  getSession(): Promise<PersistedGameSession | null>;
  getMatch(matchId: string): Promise<PersistedGameMatch | null>;
  getMatchAt(
    roundNumber: number,
    position: number,
  ): Promise<PersistedGameMatch | null>;
  completeMatch(
    matchId: string,
    winnerSongId: string,
    completedAt: Date,
  ): Promise<void>;
  placeSongInMatch(
    matchId: string,
    slot: MatchSongSlot,
    songId: string,
  ): Promise<void>;
  hasIncompleteMatchesInRound(roundNumber: number): Promise<boolean>;
  setCurrentRound(roundNumber: number): Promise<void>;
  completeSession(championSongId: string, completedAt: Date): Promise<void>;
};

export type GameServiceDependencies = {
  createId: () => string;
  now: () => Date;
  random: () => number;
  withGameCreationTransaction<T>(
    themeId: string,
    operation: (repository: GameCreationRepository) => Promise<T>,
  ): Promise<T>;
  withGameVoteTransaction<T>(
    sessionId: string,
    operation: (repository: GameVoteRepository) => Promise<T>,
  ): Promise<T>;
};

export type CreateGameInput = {
  themeId: string;
  bracketSize: BracketSize;
};

export type VoteInput = {
  sessionId: string;
  matchId: string;
  winnerSongId: string;
};

export function createGameService(dependencies: GameServiceDependencies) {
  return {
    async createSession(input: CreateGameInput) {
      return dependencies.withGameCreationTransaction(
        input.themeId,
        async (repository) => {
          const theme = await repository.getThemeWithActiveSongs();
          if (!theme) {
            throw new AppError("THEME_NOT_FOUND", "Tema não encontrado.", 404);
          }
          if (!theme.isActive) {
            throw new AppError(
              "THEME_NOT_PLAYABLE",
              "Este tema não está disponível para iniciar uma partida.",
              409,
            );
          }

          const selectedSongs = selectSongsForSession(
            theme.songs,
            input.bracketSize,
            dependencies.random,
          );
          const id = dependencies.createId();
          const startedAt = dependencies.now();
          const bracket = createBracket(
            selectedSongs.map(({ songId }) => songId),
            input.bracketSize,
            () => dependencies.createId(),
          );

          await repository.insertSession({
            id,
            themeId: theme.id,
            bracketSize: input.bracketSize,
            status: "active",
            currentRound: 1,
            championSongId: null,
            startedAt,
            completedAt: null,
          });
          await repository.insertSessionSongs(
            selectedSongs.map((song, index) => ({
              ...song,
              sessionId: id,
              seed: index + 1,
            })),
          );
          await repository.insertMatches(
            bracket.matches.map((match) => ({
              ...match,
              sessionId: id,
              completedAt: null,
            })),
          );

          return { sessionId: id };
        },
      );
    },

    async vote(input: VoteInput): Promise<void> {
      await dependencies.withGameVoteTransaction(
        input.sessionId,
        async (repository) => {
          const session = await repository.getSession();
          if (!session) {
            throw new AppError(
              "GAME_SESSION_NOT_FOUND",
              "Partida não encontrada.",
              404,
            );
          }
          if (session.status !== "active") {
            throw new AppError(
              "GAME_SESSION_NOT_ACTIVE",
              "Esta partida já foi encerrada.",
              409,
            );
          }

          const match = await repository.getMatch(input.matchId);
          if (!match) {
            throw new AppError(
              "MATCH_NOT_FOUND",
              "Confronto não encontrado nesta partida.",
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
          if (![match.songAId, match.songBId].includes(input.winnerSongId)) {
            throw new AppError(
              "INVALID_MATCH_WINNER",
              "A música vencedora não pertence a este confronto.",
            );
          }

          const completedAt = dependencies.now();
          await repository.completeMatch(
            match.id,
            input.winnerSongId,
            completedAt,
          );

          const finalRound = roundCountFromBracketSize(session.bracketSize);
          if (match.roundNumber === finalRound) {
            await repository.setCurrentRound(finalRound);
            await repository.completeSession(input.winnerSongId, completedAt);
            return;
          }

          const nextRoundNumber = match.roundNumber + 1;
          const nextPosition = Math.ceil(match.position / 2);
          const nextMatch = await repository.getMatchAt(
            nextRoundNumber,
            nextPosition,
          );
          if (!nextMatch) {
            throw new AppError(
              "INVALID_BRACKET_STATE",
              "O próximo confronto da chave não foi encontrado.",
              500,
            );
          }
          const slot: MatchSongSlot =
            match.position % 2 === 1 ? "songAId" : "songBId";
          await repository.placeSongInMatch(
            nextMatch.id,
            slot,
            input.winnerSongId,
          );

          if (
            !(await repository.hasIncompleteMatchesInRound(match.roundNumber))
          ) {
            await repository.setCurrentRound(nextRoundNumber);
          }
        },
      );
    },
  };
}

export const defaultGameServiceDependencies = {
  createId: randomUUID,
  now: () => new Date(),
  random: Math.random,
};

const gameService = createGameService({
  ...defaultGameServiceDependencies,
  withGameCreationTransaction,
  withGameVoteTransaction,
});

export const createGameSession = gameService.createSession;
export const voteForMatch = gameService.vote;
