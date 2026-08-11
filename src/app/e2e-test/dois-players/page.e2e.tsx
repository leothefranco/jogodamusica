import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { GameExperience } from "@/components/game/game-experience";
import type { GameState } from "@/domain/game/state";

const fixture: GameState = {
  theme: { name: "Clássicos do teste", slug: "classicos-do-teste" },
  session: {
    id: "00000000-0000-4000-8000-000000000001",
    themeId: "00000000-0000-4000-8000-000000000002",
    bracketSize: 4,
    status: "active",
    currentRound: 1,
    championSongId: null,
    startedAt: new Date("2026-01-01T00:00:00.000Z"),
    completedAt: null,
  },
  songs: [
    {
      sessionId: "00000000-0000-4000-8000-000000000001",
      songId: "song-a",
      seed: 1,
      title: "Canção A",
      artist: "Artista A",
      thumbnailUrl: "/icon.svg",
      provider: "youtube",
      providerContentId: "youtube-a",
      startTimeSeconds: 10,
      previewDurationSeconds: 30,
    },
    {
      sessionId: "00000000-0000-4000-8000-000000000001",
      songId: "song-b",
      seed: 2,
      title: "Canção B",
      artist: "Artista B",
      thumbnailUrl: "/icon.svg",
      provider: "youtube",
      providerContentId: "youtube-b",
      startTimeSeconds: 20,
      previewDurationSeconds: 30,
    },
  ],
  matches: [
    {
      id: "match-1",
      sessionId: "00000000-0000-4000-8000-000000000001",
      roundNumber: 1,
      position: 1,
      songAId: "song-a",
      songBId: "song-b",
      winnerSongId: null,
      status: "ready",
      completedAt: null,
    },
  ],
  currentMatch: {
    id: "match-1",
    sessionId: "00000000-0000-4000-8000-000000000001",
    roundNumber: 1,
    position: 1,
    songAId: "song-a",
    songBId: "song-b",
    winnerSongId: null,
    status: "ready",
    completedAt: null,
  },
  progress: {
    completedMatches: 0,
    totalMatches: 3,
    currentRound: 1,
    roundCount: 2,
  },
};

export default async function TwoPlayersFixturePage({
  searchParams,
}: {
  searchParams: Promise<{ completed?: string }>;
}) {
  const requestHeaders = await headers();
  if (requestHeaders.get("x-e2e-test") !== "two-players") notFound();

  const { completed } = await searchParams;
  const initialState: GameState =
    completed === "1"
      ? {
          ...fixture,
          session: {
            ...fixture.session,
            status: "completed",
            championSongId: "song-a",
            completedAt: new Date("2026-01-01T00:03:00.000Z"),
          },
          currentMatch: null,
        }
      : fixture;

  return <GameExperience initialState={initialState} />;
}
