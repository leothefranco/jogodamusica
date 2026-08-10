import { describe, expect, it } from "vitest";

import {
  createGameService,
  type GameCreationRepository,
  type GameDecisionRepository,
  type GameServiceDependencies,
  type PersistedGameMatch,
  type PersistedGameSession,
  type SessionSongSnapshot,
} from "@/server/services/game-service";

const themeId = "10000000-0000-4000-8000-000000000010";
const sessionId = "20000000-0000-4000-8000-000000000020";

const createActiveSongs = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    songId: `30000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    title: `Música ${index + 1}`,
    artist: `Artista ${index + 1}`,
    thumbnailUrl: `https://example.com/${index + 1}.jpg`,
    provider: "youtube" as const,
    providerContentId: `video${String(index + 1).padStart(6, "0")}`,
    startTimeSeconds: index,
    previewDurationSeconds: 30,
  }));

const activeSongs = createActiveSongs(10);

function gameHarness(
  options: {
    isActive?: boolean;
    failWhenPopulatingRound?: boolean;
    random?: () => number;
    songs?: typeof activeSongs;
  } = {},
) {
  const sessions: PersistedGameSession[] = [];
  const snapshots: SessionSongSnapshot[] = [];
  const matches: PersistedGameMatch[] = [];
  let matchIdSequence = 0;
  let creationTransactions = 0;
  let decisionTransactions = 0;

  const creationRepository: GameCreationRepository = {
    async getThemeWithActiveSongs() {
      return {
        id: themeId,
        isActive: options.isActive ?? true,
        songs: options.songs ?? activeSongs,
      };
    },
    async createGame(plan) {
      sessions.push({ id: sessionId, ...plan.session });
      snapshots.push(...plan.songs.map((song) => ({ ...song, sessionId })));
      matches.push(
        ...plan.matches.map((match) => {
          matchIdSequence += 1;
          return {
            id: `40000000-0000-4000-8000-${String(matchIdSequence).padStart(12, "0")}`,
            sessionId,
            ...match,
          };
        }),
      );
      return sessionId;
    },
  };
  const decisionRepository: GameDecisionRepository = {
    async loadDecisionContext(matchId) {
      const session = sessions[0] ?? null;
      const match = matches.find(({ id }) => id === matchId) ?? null;
      return {
        session,
        match,
        roundMatches: match
          ? matches
              .filter(({ roundNumber }) => roundNumber === match.roundNumber)
              .sort((left, right) => left.position - right.position)
          : [],
      };
    },
    async applyTransition(transition, completedAt) {
      const match = matches.find(
        ({ id }) => id === transition.completedMatch.matchId,
      )!;
      match.status = "completed";
      match.winnerSongId = transition.completedMatch.winnerSongId;
      match.completedAt = completedAt;

      if (transition.nextRound) {
        if (options.failWhenPopulatingRound) {
          throw new Error("Falha de persistência simulada.");
        }
        const roundMatches = matches
          .filter(
            ({ roundNumber }) =>
              roundNumber === transition.nextRound!.roundNumber,
          )
          .sort((left, right) => left.position - right.position);
        roundMatches.forEach((nextMatch, index) => {
          const pair = transition.nextRound!.pairs[index];
          nextMatch.songAId = pair.songAId;
          nextMatch.songBId = pair.songBId;
          nextMatch.status = "ready";
        });
      }

      sessions[0].currentRound = transition.session.currentRound;
      if (transition.session.status === "completed") {
        sessions[0].status = "completed";
        sessions[0].championSongId = transition.session.championSongId;
        sessions[0].completedAt = completedAt;
      }
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
    random: options.random ?? (() => 0),
    async withGameCreationTransaction(_themeId, operation) {
      creationTransactions += 1;
      return operation(creationRepository);
    },
    async withGameDecisionTransaction(_sessionId, operation) {
      decisionTransactions += 1;
      const sessionSnapshot = structuredClone(sessions);
      const matchSnapshot = structuredClone(matches);
      try {
        return await operation(decisionRepository);
      } catch (error) {
        sessions.splice(0, sessions.length, ...sessionSnapshot);
        matches.splice(0, matches.length, ...matchSnapshot);
        throw error;
      }
    },
  };

  return {
    service: createGameService(dependencies),
    sessions,
    snapshots,
    matches,
    transactionCounts: () => ({
      creationTransactions,
      decisionTransactions,
    }),
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

  it.each([64, 128] as const)(
    "cria uma partida com a modalidade de %i músicas",
    async (bracketSize) => {
      const harness = gameHarness({ songs: createActiveSongs(bracketSize) });

      await harness.service.createSession({ themeId, bracketSize });

      expect(harness.sessions[0].bracketSize).toBe(bracketSize);
      expect(harness.snapshots).toHaveLength(bracketSize);
      expect(harness.matches).toHaveLength(bracketSize - 1);
    },
  );
});

describe("decisão transacional de confronto", () => {
  it.each([
    [0, "songAId"],
    [0.999, "songBId"],
  ] as const)(
    "resolve desempate no servidor pela participante %s",
    async (randomValue, expectedSlot) => {
      const harness = gameHarness({ random: () => randomValue });
      await harness.service.createSession({ themeId, bracketSize: 4 });
      const match = harness.matches[0];

      await harness.service.decide({
        sessionId,
        matchId: match.id,
        decision: { type: "tiebreak" },
      });

      expect(match).toMatchObject({
        status: "completed",
        winnerSongId: match[expectedSlot],
      });
    },
  );

  it("sorteia e persiste todos os pares somente ao concluir a rodada", async () => {
    const harness = gameHarness();
    await harness.service.createSession({ themeId, bracketSize: 8 });
    const firstRound = harness.matches.filter(
      ({ roundNumber }) => roundNumber === 1,
    );
    const secondRound = harness.matches.filter(
      ({ roundNumber }) => roundNumber === 2,
    );
    const winnerSongIds = firstRound.map(({ songAId }) => songAId!);

    for (const match of firstRound.slice(0, -1)) {
      await harness.service.decide({
        sessionId,
        matchId: match.id,
        decision: { type: "vote", winnerSongId: match.songAId! },
      });
    }

    expect(secondRound).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          songAId: null,
          songBId: null,
          status: "pending",
        }),
      ]),
    );
    expect(secondRound.every(({ status }) => status === "pending")).toBe(true);

    const lastMatch = firstRound.at(-1)!;
    await harness.service.decide({
      sessionId,
      matchId: lastMatch.id,
      decision: { type: "vote", winnerSongId: lastMatch.songAId! },
    });

    expect(
      secondRound.flatMap(({ songAId, songBId }) => [songAId, songBId]),
    ).toEqual([
      winnerSongIds[1],
      winnerSongIds[2],
      winnerSongIds[3],
      winnerSongIds[0],
    ]);
    expect(secondRound.every(({ status }) => status === "ready")).toBe(true);
    const persistedPairs = secondRound.map(({ songAId, songBId }) => [
      songAId,
      songBId,
    ]);
    await expect(harness.service.getState(sessionId)).resolves.toMatchObject({
      currentMatch: { id: secondRound[0].id },
      progress: { currentRound: 2 },
    });
    await harness.service.getState(sessionId);
    expect(
      secondRound.map(({ songAId, songBId }) => [songAId, songBId]),
    ).toEqual(persistedPairs);
    expect(harness.transactionCounts().decisionTransactions).toBe(4);
  });

  it("não persiste parcialmente a decisão quando a transação falha", async () => {
    const harness = gameHarness({ failWhenPopulatingRound: true });
    await harness.service.createSession({ themeId, bracketSize: 4 });
    const firstRound = harness.matches.filter(
      ({ roundNumber }) => roundNumber === 1,
    );
    await harness.service.decide({
      sessionId,
      matchId: firstRound[0].id,
      decision: { type: "vote", winnerSongId: firstRound[0].songAId! },
    });

    await expect(
      harness.service.decide({
        sessionId,
        matchId: firstRound[1].id,
        decision: { type: "vote", winnerSongId: firstRound[1].songAId! },
      }),
    ).rejects.toThrow("Falha de persistência simulada.");

    await expect(harness.service.getState(sessionId)).resolves.toMatchObject({
      currentMatch: { id: firstRound[1].id },
      progress: { completedMatches: 1, currentRound: 1 },
    });
  });

  it("rejeita decisão repetida sem avançar novamente", async () => {
    const harness = gameHarness({ random: () => 0 });
    await harness.service.createSession({ themeId, bracketSize: 4 });
    const firstMatch = harness.matches[0];
    const input = {
      sessionId,
      matchId: firstMatch.id,
      decision: { type: "tiebreak" as const },
    };
    await harness.service.decide(input);

    await expect(harness.service.decide(input)).rejects.toMatchObject({
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
      await harness.service.decide({
        sessionId,
        matchId: match.id,
        decision: { type: "vote", winnerSongId: match.songAId! },
      });
    }
    const final = harness.matches.find(({ roundNumber }) => roundNumber === 2)!;

    await harness.service.decide({
      sessionId,
      matchId: final.id,
      decision: { type: "vote", winnerSongId: final.songBId! },
    });

    expect(harness.sessions[0]).toMatchObject({
      status: "completed",
      championSongId: final.songBId,
      currentRound: 2,
      completedAt: new Date("2026-07-29T12:00:00Z"),
    });
  });
});
