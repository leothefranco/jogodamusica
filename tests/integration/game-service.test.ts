import { describe, expect, it } from "vitest";

import {
  createGameService,
  type GameCreationRepository,
  type GameServiceDependencies,
  type GameVoteRepository,
  type PersistedGameMatch,
  type PersistedGameSession,
  type SessionSongSnapshot,
} from "@/server/services/game-service";

const themeId = "10000000-0000-4000-8000-000000000010";
const sessionId = "20000000-0000-4000-8000-000000000020";

const activeSongs = Array.from({ length: 6 }, (_, index) => ({
  songId: `30000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  title: `Música ${index + 1}`,
  artist: `Artista ${index + 1}`,
  thumbnailUrl: `https://example.com/${index + 1}.jpg`,
  provider: "youtube" as const,
  providerContentId: `video${String(index + 1).padStart(6, "0")}`,
  startTimeSeconds: index,
  previewDurationSeconds: 30,
}));

function gameHarness(
  options: {
    isActive?: boolean;
    songs?: typeof activeSongs;
  } = {},
) {
  const sessions: PersistedGameSession[] = [];
  const snapshots: SessionSongSnapshot[] = [];
  const matches: PersistedGameMatch[] = [];
  let matchIdSequence = 0;
  let creationTransactions = 0;
  let voteTransactions = 0;

  const creationRepository: GameCreationRepository = {
    async getThemeWithActiveSongs() {
      return {
        id: themeId,
        isActive: options.isActive ?? true,
        songs: options.songs ?? activeSongs,
      };
    },
    async insertSession(session) {
      sessions.push({ id: sessionId, ...session });
      return sessionId;
    },
    async insertSessionSongs(items) {
      snapshots.push(...items);
    },
    async insertMatches(items) {
      matches.push(
        ...items.map((match) => {
          matchIdSequence += 1;
          return {
            id: `40000000-0000-4000-8000-${String(matchIdSequence).padStart(12, "0")}`,
            ...match,
          };
        }),
      );
    },
  };
  const voteRepository: GameVoteRepository = {
    async getSession() {
      return sessions[0] ?? null;
    },
    async getMatch(matchId) {
      return matches.find(({ id }) => id === matchId) ?? null;
    },
    async getMatchAt({ roundNumber, position }) {
      return (
        matches.find(
          (match) =>
            match.roundNumber === roundNumber && match.position === position,
        ) ?? null
      );
    },
    async completeMatch(matchId, winnerSongId, completedAt) {
      const match = matches.find(({ id }) => id === matchId)!;
      match.status = "completed";
      match.winnerSongId = winnerSongId;
      match.completedAt = completedAt;
    },
    async placeSongInMatch(matchId, slot, songId) {
      const match = matches.find(({ id }) => id === matchId)!;
      match[slot] = songId;
      if (match.songAId && match.songBId) match.status = "ready";
    },
    async hasIncompleteMatchesInRound(roundNumber) {
      return matches.some(
        (match) =>
          match.roundNumber === roundNumber && match.status !== "completed",
      );
    },
    async setCurrentRound(roundNumber) {
      sessions[0].currentRound = roundNumber;
    },
    async completeSession(championSongId, completedAt) {
      sessions[0].status = "completed";
      sessions[0].championSongId = championSongId;
      sessions[0].completedAt = completedAt;
    },
  };
  const dependencies: GameServiceDependencies = {
    async getGameState(requestedSessionId) {
      const session = sessions.find(({ id }) => id === requestedSessionId);
      return session
        ? {
            theme: {
              name: "Tema de teste",
              slug: "tema-de-teste",
            },
            session,
            songs: snapshots,
            matches,
            currentMatch:
              matches.find(({ status }) => status === "ready") ?? null,
            progress: {
              completedMatches: matches.filter(
                ({ status }) => status === "completed",
              ).length,
              totalMatches: matches.length,
              currentRound: session.currentRound,
              roundCount: Math.log2(session.bracketSize),
            },
          }
        : null;
    },
    now: () => new Date("2026-07-29T12:00:00Z"),
    random: () => 0,
    async withGameCreationTransaction(_themeId, operation) {
      creationTransactions += 1;
      return operation(creationRepository);
    },
    async withGameVoteTransaction(_sessionId, operation) {
      voteTransactions += 1;
      return operation(voteRepository);
    },
  };

  return {
    service: createGameService(dependencies),
    sessions,
    snapshots,
    matches,
    transactionCounts: () => ({ creationTransactions, voteTransactions }),
  };
}

describe("criação transacional de partida", () => {
  it("gera snapshots e todos os confrontos usando apenas o tamanho escolhido", async () => {
    const harness = gameHarness();

    const result = await harness.service.createSession({
      themeId,
      bracketSize: 4,
    });

    expect(result).toEqual({ sessionId });
    expect(harness.sessions).toHaveLength(1);
    expect(harness.snapshots).toHaveLength(4);
    expect(new Set(harness.snapshots.map(({ songId }) => songId))).toHaveLength(
      4,
    );
    expect(harness.snapshots.map(({ seed }) => seed)).toEqual([1, 2, 3, 4]);
    expect(harness.matches).toHaveLength(3);
    await expect(harness.service.getState(sessionId)).resolves.toMatchObject({
      currentMatch: {
        roundNumber: 1,
        position: 1,
        status: "ready",
      },
      progress: {
        completedMatches: 0,
        totalMatches: 3,
        currentRound: 1,
        roundCount: 2,
      },
    });
    expect(harness.transactionCounts().creationTransactions).toBe(1);
  });

  it("rejeita tema inativo sem persistir a sessão", async () => {
    const harness = gameHarness({ isActive: false });

    await expect(
      harness.service.createSession({ themeId, bracketSize: 4 }),
    ).rejects.toMatchObject({ code: "THEME_NOT_PLAYABLE", status: 409 });
    expect(harness.sessions).toHaveLength(0);
  });

  it("rejeita tema sem músicas ativas suficientes", async () => {
    const harness = gameHarness({ songs: activeSongs.slice(0, 3) });

    await expect(
      harness.service.createSession({ themeId, bracketSize: 4 }),
    ).rejects.toMatchObject({
      code: "INSUFFICIENT_ACTIVE_SONGS",
      status: 409,
    });
    expect(harness.sessions).toHaveLength(0);
  });
});

describe("voto transacional", () => {
  it("conclui o confronto e alimenta a posição correta do seguinte", async () => {
    const harness = gameHarness();
    await harness.service.createSession({ themeId, bracketSize: 4 });
    const firstMatch = harness.matches.find(
      ({ roundNumber, position }) => roundNumber === 1 && position === 1,
    )!;

    await harness.service.vote({
      sessionId,
      matchId: firstMatch.id,
      winnerSongId: firstMatch.songBId!,
    });

    expect(firstMatch).toMatchObject({
      status: "completed",
      winnerSongId: firstMatch.songBId,
    });
    expect(
      harness.matches.find(({ roundNumber }) => roundNumber === 2),
    ).toMatchObject({
      songAId: firstMatch.songBId,
      songBId: null,
      status: "pending",
    });
    expect(harness.transactionCounts().voteTransactions).toBe(1);
  });

  it("rejeita voto repetido sem avançar novamente", async () => {
    const harness = gameHarness();
    await harness.service.createSession({ themeId, bracketSize: 4 });
    const firstMatch = harness.matches[0];
    const input = {
      sessionId,
      matchId: firstMatch.id,
      winnerSongId: firstMatch.songAId!,
    };
    await harness.service.vote(input);

    await expect(harness.service.vote(input)).rejects.toMatchObject({
      code: "MATCH_ALREADY_COMPLETED",
      status: 409,
    });
  });

  it("conclui a sessão quando a final recebe o voto", async () => {
    const harness = gameHarness();
    await harness.service.createSession({ themeId, bracketSize: 4 });
    for (const match of harness.matches.filter(
      ({ roundNumber }) => roundNumber === 1,
    )) {
      await harness.service.vote({
        sessionId,
        matchId: match.id,
        winnerSongId: match.songAId!,
      });
    }
    const final = harness.matches.find(({ roundNumber }) => roundNumber === 2)!;

    await harness.service.vote({
      sessionId,
      matchId: final.id,
      winnerSongId: final.songBId!,
    });

    expect(harness.sessions[0]).toMatchObject({
      status: "completed",
      championSongId: final.songBId,
      currentRound: 2,
      completedAt: new Date("2026-07-29T12:00:00Z"),
    });
  });
});
