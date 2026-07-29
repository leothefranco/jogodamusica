import "server-only";

import {
  createBracket,
  planWinnerAdvancement,
  roundCountFromBracketSize,
  selectSongsForSession,
  type BracketMatch,
  type MatchCoordinate,
  type MatchSongSlot,
} from "@/domain/bracket";
import type { BracketSize } from "@/domain/music/content-validation";
import { AppError } from "@/lib/errors";
import {
  getGameStateRecord,
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

export type NewGameSession = Omit<PersistedGameSession, "id">;

export type SessionSongSnapshot = ActiveThemeSong & {
  sessionId: string;
  seed: number;
};

export type PersistedGameMatch = BracketMatch & {
  sessionId: string;
  completedAt: Date | null;
};

export type NewGameMatch = Omit<PersistedGameMatch, "id">;
export type GameState = {
  session: PersistedGameSession;
  songs: SessionSongSnapshot[];
  matches: PersistedGameMatch[];
  currentMatch: PersistedGameMatch | null;
  progress: {
    completedMatches: number;
    totalMatches: number;
    currentRound: number;
    roundCount: number;
  };
};

export type GameCreationRepository = {
  getThemeWithActiveSongs(): Promise<GameTheme | null>;
  insertSession(session: NewGameSession): Promise<string>;
  insertSessionSongs(songs: SessionSongSnapshot[]): Promise<void>;
  insertMatches(matches: NewGameMatch[]): Promise<void>;
};

export type GameVoteRepository = {
  getSession(): Promise<PersistedGameSession | null>;
  getMatch(matchId: string): Promise<PersistedGameMatch | null>;
  getMatchAt(coordinate: MatchCoordinate): Promise<PersistedGameMatch | null>;
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
  getGameState(sessionId: string): Promise<GameState | null>;
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
    async getState(sessionId: string): Promise<GameState> {
      const state = await dependencies.getGameState(sessionId);
      if (!state) {
        throw new AppError(
          "GAME_SESSION_NOT_FOUND",
          "Partida não encontrada.",
          404,
        );
      }
      return state;
    },

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
          const startedAt = dependencies.now();
          const bracket = createBracket(
            selectedSongs.map(({ songId }) => songId),
            input.bracketSize,
          );

          const sessionId = await repository.insertSession({
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
              sessionId,
              seed: index + 1,
            })),
          );
          await repository.insertMatches(
            bracket.matches.map((match) => ({
              sessionId,
              roundNumber: match.roundNumber,
              position: match.position,
              songAId: match.songAId,
              songBId: match.songBId,
              winnerSongId: match.winnerSongId,
              status: match.status,
              completedAt: null,
            })),
          );

          return { sessionId };
        },
      );
    },

    async vote(input: VoteInput): Promise<GameState> {
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
          const advancement = planWinnerAdvancement(
            match,
            session.bracketSize,
            input.winnerSongId,
          );

          const completedAt = dependencies.now();
          await repository.completeMatch(
            match.id,
            input.winnerSongId,
            completedAt,
          );

          if (advancement.championSongId) {
            const finalRound = roundCountFromBracketSize(session.bracketSize);
            await repository.setCurrentRound(finalRound);
            await repository.completeSession(
              advancement.championSongId,
              completedAt,
            );
            return;
          }

          const { coordinate, slot } = advancement.nextMatch!;
          const nextMatch = await repository.getMatchAt(coordinate);
          if (!nextMatch) {
            throw new AppError(
              "INVALID_BRACKET_STATE",
              "O próximo confronto da chave não foi encontrado.",
              500,
            );
          }
          await repository.placeSongInMatch(
            nextMatch.id,
            slot,
            input.winnerSongId,
          );

          if (
            !(await repository.hasIncompleteMatchesInRound(match.roundNumber))
          ) {
            await repository.setCurrentRound(coordinate.roundNumber);
          }
        },
      );

      const state = await dependencies.getGameState(input.sessionId);
      if (!state) {
        throw new AppError(
          "GAME_SESSION_NOT_FOUND",
          "Partida não encontrada.",
          404,
        );
      }
      return state;
    },
  };
}

export const defaultGameServiceDependencies = {
  getGameState: getGameStateRecord,
  now: () => new Date(),
  random: Math.random,
};

const gameService = createGameService({
  ...defaultGameServiceDependencies,
  withGameCreationTransaction,
  withGameVoteTransaction,
});

export const createGameSession = gameService.createSession;
export const getGameState = gameService.getState;
export const voteForMatch = gameService.vote;
