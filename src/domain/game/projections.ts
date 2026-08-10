import type {
  GameSong,
  GameState,
  PersistedGameMatch,
  SessionSongSnapshot,
} from "@/domain/game/state";

export type CurrentConfrontation = {
  match: PersistedGameMatch;
  songA: SessionSongSnapshot;
  songB: SessionSongSnapshot;
  progressPercent: number;
};

export type CompletedGame = {
  champion: SessionSongSnapshot;
  matches: Array<{
    match: PersistedGameMatch;
    songA: SessionSongSnapshot | null;
    songB: SessionSongSnapshot | null;
  }>;
};

function songsById(songs: readonly GameSong[]) {
  return new Map(songs.map((song) => [song.songId, song]));
}

export function projectCurrentConfrontation(
  state: GameState,
): CurrentConfrontation | null {
  const match = state.currentMatch;
  if (!match?.songAId || !match.songBId) return null;

  const songs = songsById(state.songs);
  const songA = songs.get(match.songAId) as SessionSongSnapshot | undefined;
  const songB = songs.get(match.songBId) as SessionSongSnapshot | undefined;
  if (!songA || !songB) return null;

  return {
    match,
    songA,
    songB,
    progressPercent:
      state.progress.totalMatches === 0
        ? 0
        : Math.round(
            (state.progress.completedMatches / state.progress.totalMatches) *
              10_000,
          ) / 100,
  };
}

export function projectCompletedGame(state: GameState): CompletedGame | null {
  if (state.session.status !== "completed" || !state.session.championSongId) {
    return null;
  }

  const songs = songsById(state.songs);
  const champion = songs.get(state.session.championSongId) as
    SessionSongSnapshot | undefined;
  if (!champion) return null;

  return {
    champion,
    matches: state.matches.map((match) => ({
      match,
      songA: match.songAId
        ? ((songs.get(match.songAId) as SessionSongSnapshot | undefined) ??
          null)
        : null,
      songB: match.songBId
        ? ((songs.get(match.songBId) as SessionSongSnapshot | undefined) ??
          null)
        : null,
    })),
  };
}
