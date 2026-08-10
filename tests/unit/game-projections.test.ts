import { describe, expect, it } from "vitest";

import {
  projectCompletedGame,
  projectCurrentConfrontation,
} from "@/domain/game/projections";
import type { GameState } from "@/domain/game/state";

function activeGameState(): GameState {
  const match = {
    id: "match-1",
    sessionId: "session-1",
    roundNumber: 1,
    position: 1,
    songAId: "song-a",
    songBId: "song-b",
    winnerSongId: null,
    status: "ready" as const,
    completedAt: null,
  };

  return {
    theme: { name: "Clássicos", slug: "classicos" },
    session: {
      id: "session-1",
      themeId: "theme-1",
      bracketSize: 4,
      status: "active",
      currentRound: 1,
      championSongId: null,
      startedAt: new Date("2026-01-01T00:00:00Z"),
      completedAt: null,
    },
    songs: [
      {
        sessionId: "session-1",
        songId: "song-a",
        seed: 1,
        title: "Música A",
        artist: "Artista A",
        thumbnailUrl: "https://example.com/a.jpg",
        provider: "youtube",
        providerContentId: "video-a",
        startTimeSeconds: 0,
        previewDurationSeconds: 30,
      },
      {
        sessionId: "session-1",
        songId: "song-b",
        seed: 2,
        title: "Música B",
        artist: "Artista B",
        thumbnailUrl: "https://example.com/b.jpg",
        provider: "youtube",
        providerContentId: "video-b",
        startTimeSeconds: 10,
        previewDurationSeconds: 30,
      },
    ],
    matches: [match],
    currentMatch: match,
    progress: {
      completedMatches: 1,
      totalMatches: 3,
      currentRound: 1,
      roundCount: 2,
    },
  };
}

describe("projeções públicas da partida", () => {
  it("projeta o confronto atual com participantes e progresso", () => {
    expect(projectCurrentConfrontation(activeGameState())).toMatchObject({
      match: { id: "match-1" },
      songA: { songId: "song-a", title: "Música A" },
      songB: { songId: "song-b", title: "Música B" },
      progressPercent: 33.33,
    });
  });

  it("projeta a campeã e os confrontos do resultado concluído", () => {
    const state = activeGameState();
    state.session.status = "completed";
    state.session.championSongId = "song-a";
    state.currentMatch = null;
    state.matches[0].status = "completed";
    state.matches[0].winnerSongId = "song-a";

    expect(projectCompletedGame(state)).toMatchObject({
      champion: { songId: "song-a", title: "Música A" },
      matches: [
        {
          match: { id: "match-1", winnerSongId: "song-a" },
          songA: { songId: "song-a" },
          songB: { songId: "song-b" },
        },
      ],
    });
  });
});
