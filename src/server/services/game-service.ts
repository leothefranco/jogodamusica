import "server-only";

import {
  createBracket,
  selectSongsForSession,
  transitionBracket,
  type MatchDecision,
} from "@/domain/bracket";
import type { GameSong, GameState } from "@/domain/game/state";
import { gameMatchId } from "@/domain/game/ids";
import type { BracketSize } from "@/domain/music/content-validation";
import { AppError } from "@/lib/errors";
import {
  abandonGameSessionRecord,
  getGameStateRecord,
  withGameCreationTransaction,
  withGameDecisionTransaction,
} from "@/server/repositories/game-repository";
import type {
  GameCreationRepository,
  GameDecisionRepository,
} from "@/server/repositories/game-repository-contract";

export type {
  PersistedGameMatch,
  PersistedGameSession,
  SessionSongSnapshot,
} from "@/domain/game/state";
export type {
  GameCreationRepository,
  GameDecisionRepository,
  GameTheme,
  NewGameMatch,
  NewGameSession,
} from "@/server/repositories/game-repository-contract";

export type ActiveThemeSong = GameSong;

export type GameServiceDependencies = {
  getGameState(sessionId: string): Promise<GameState | null>;
  now: () => Date;
  random: () => number;
  withGameCreationTransaction<T>(
    themeId: string,
    operation: (repository: GameCreationRepository) => Promise<T>,
  ): Promise<T>;
  withGameDecisionTransaction<T>(
    sessionId: string,
    operation: (repository: GameDecisionRepository) => Promise<T>,
  ): Promise<T>;
};

export type CreateGameInput = {
  themeId: string;
  bracketSize: BracketSize;
};

export type DecideMatchInput = {
  sessionId: string;
  matchId: string;
  decision: MatchDecision;
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

          const sessionId = await repository.createGame({
            session: {
              themeId: theme.id,
              bracketSize: input.bracketSize,
              status: "active",
              currentRound: 1,
              championSongId: null,
              startedAt,
              completedAt: null,
            },
            songs: selectedSongs.map((song, index) => ({
              ...song,
              seed: index + 1,
            })),
            matches: bracket.matches.map((match) => ({
              roundNumber: match.roundNumber,
              position: match.position,
              songAId: match.songAId,
              songBId: match.songBId,
              winnerSongId: match.winnerSongId,
              status: match.status,
              completedAt: null,
            })),
          });

          return { sessionId };
        },
      );
    },

    async decide(input: DecideMatchInput): Promise<GameState> {
      await dependencies.withGameDecisionTransaction(
        input.sessionId,
        async (repository) => {
          const context = await repository.loadDecisionContext(
            gameMatchId(input.matchId),
          );
          const session = context.session;
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

          const match = context.match;
          if (!match) {
            throw new AppError(
              "MATCH_NOT_FOUND",
              "Confronto não encontrado nesta partida.",
              404,
            );
          }
          const completedAt = dependencies.now();
          await repository.applyTransition(
            transitionBracket({
              bracketSize: session.bracketSize,
              currentMatch: match,
              decision: input.decision,
              random: dependencies.random,
              roundMatches: context.roundMatches,
            }),
            completedAt,
          );
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
  withGameDecisionTransaction,
});

export const createGameSession = gameService.createSession;
export const getGameState = gameService.getState;
export const decideMatch = gameService.decide;

export async function abandonGameSession(sessionId: string): Promise<void> {
  const result = await abandonGameSessionRecord(sessionId, new Date());
  if (result === "not-found") {
    throw new AppError(
      "GAME_SESSION_NOT_FOUND",
      "Partida não encontrada.",
      404,
    );
  }
  if (result === "not-active") {
    throw new AppError(
      "GAME_SESSION_NOT_ACTIVE",
      "Esta partida já foi encerrada.",
      409,
    );
  }
}

export async function reportGamePlaybackError(input: {
  sessionId: string;
  matchId: string;
  errorCode: 2 | 5 | 100 | 101 | 150;
}): Promise<void> {
  await gameService.getState(input.sessionId);
  console.error("[game-player-error]", {
    sessionId: input.sessionId,
    matchId: input.matchId,
    errorCode: input.errorCode,
  });
}
