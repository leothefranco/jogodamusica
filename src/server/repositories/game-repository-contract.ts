import type { BracketTransition } from "@/domain/bracket";
import type { GameMatchId } from "@/domain/game/ids";
import type {
  GameSong,
  PersistedGameMatch,
  PersistedGameSession,
  SessionSongSnapshot,
} from "@/domain/game/state";

export type GameTheme = {
  id: string;
  isActive: boolean;
  songs: GameSong[];
};

export type NewGameSession = Omit<PersistedGameSession, "id">;
export type NewGameMatch = Omit<PersistedGameMatch, "id" | "sessionId">;
export type NewSessionSongSnapshot = Omit<SessionSongSnapshot, "sessionId">;

export type GameCreationPlan = {
  session: NewGameSession;
  songs: NewSessionSongSnapshot[];
  matches: NewGameMatch[];
};

export type GameCreationRepository = {
  getThemeWithActiveSongs(): Promise<GameTheme | null>;
  createGame(plan: GameCreationPlan): Promise<string>;
};

export type GameDecisionContext = {
  session: PersistedGameSession | null;
  match: PersistedGameMatch | null;
  roundMatches: PersistedGameMatch[];
};

export type GameDecisionRepository = {
  loadDecisionContext(matchId: GameMatchId): Promise<GameDecisionContext>;
  applyTransition(
    transition: BracketTransition,
    completedAt: Date,
  ): Promise<void>;
};
