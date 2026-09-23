import { GameResult } from "@/components/game/game-result";
import { projectCompletedGame } from "@/domain/game/projections";
import type { GameState } from "@/domain/game/state";

export function ResultFixture() {
  const sessionId = "00000000-0000-4000-8000-000000000001";
  const completedAt = new Date("2026-01-01T00:10:00Z");
  const state: GameState = {
    theme: { name: "Tema das quatro capas", slug: "ui-capas" },
    session: {
      id: sessionId,
      themeId: "00000000-0000-4000-8000-000000000002",
      bracketSize: 4,
      status: "completed",
      currentRound: 2,
      championSongId: "song-a",
      startedAt: new Date("2026-01-01T00:00:00Z"),
      completedAt,
    },
    songs: ["a", "b", "c", "d"].map((id, index) => ({
      sessionId,
      songId: `song-${id}`,
      seed: index + 1,
      title: `Canção ${id.toUpperCase()}`,
      artist: `Artista ${id.toUpperCase()}`,
      thumbnailUrl: `/e2e-images/thumb-${index + 1}.png`,
      provider: "youtube",
      providerContentId: `youtube-${id}`,
      startTimeSeconds: 0,
      previewDurationSeconds: 30,
    })),
    matches: [
      ["a", "b"],
      ["c", "d"],
      ["a", "c"],
    ].map(([a, b], index) => ({
      id: `match-${index + 1}`,
      sessionId,
      roundNumber: index === 2 ? 2 : 1,
      position: index === 2 ? 1 : index + 1,
      songAId: `song-${a}`,
      songBId: `song-${b}`,
      winnerSongId: `song-${a}`,
      status: "completed",
      completedAt,
    })),
    currentMatch: null,
    progress: {
      completedMatches: 3,
      totalMatches: 3,
      currentRound: 2,
      roundCount: 2,
    },
  };
  const result = projectCompletedGame(state);
  if (!result) throw new Error("Resultado da fixture inválido");
  return <GameResult state={state} result={result} sessionId={sessionId} />;
}
