import type { BracketMatch } from "@/domain/bracket";
import type { BracketSize } from "@/domain/music/content-validation";

export type GameSong = {
  songId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  provider: "youtube";
  providerContentId: string;
  startTimeSeconds: number;
  previewDurationSeconds: number;
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

export type SessionSongSnapshot = GameSong & {
  sessionId: string;
  seed: number;
};

export type PersistedGameMatch = BracketMatch & {
  sessionId: string;
  completedAt: Date | null;
};

export type GameState = {
  theme: {
    name: string;
    slug: string;
  };
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
