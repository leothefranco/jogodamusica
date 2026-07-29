import { beforeEach, describe, expect, it, vi } from "vitest";

const gameService = vi.hoisted(() => ({
  createGameSession: vi.fn(),
  getGameState: vi.fn(),
  voteForMatch: vi.fn(),
}));

vi.mock("@/server/services/game-service", () => gameService);

import { POST as createGame } from "@/app/api/games/route";
import { GET as getGame } from "@/app/api/games/[sessionId]/route";
import { POST as vote } from "@/app/api/games/[sessionId]/matches/[matchId]/vote/route";

const themeId = "10000000-0000-4000-8000-000000000010";
const sessionId = "20000000-0000-4000-8000-000000000020";
const matchId = "30000000-0000-4000-8000-000000000030";
const winnerSongId = "40000000-0000-4000-8000-000000000040";
const gameState = {
  session: { id: sessionId, status: "active" },
  songs: [],
  matches: [],
  currentMatch: null,
  progress: {
    completedMatches: 0,
    totalMatches: 0,
    currentRound: 1,
    roundCount: 2,
  },
};

describe("contratos públicos de partida", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cria uma partida e retorna sua URL", async () => {
    gameService.createGameSession.mockResolvedValue({ sessionId });

    const response = await createGame(
      new Request("http://localhost/api/games", {
        method: "POST",
        body: JSON.stringify({ themeId, bracketSize: 4 }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      sessionId,
      url: `/jogo/${sessionId}`,
    });
  });

  it("rejeita payload inválido com erro estruturado", async () => {
    const response = await createGame(
      new Request("http://localhost/api/games", {
        method: "POST",
        body: JSON.stringify({ themeId: "inválido", bracketSize: 3 }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_REQUEST" },
    });
  });

  it("retorna o estado recuperável da partida", async () => {
    gameService.getGameState.mockResolvedValue(gameState);

    const response = await getGame(
      new Request(`http://localhost/api/games/${sessionId}`),
      { params: Promise.resolve({ sessionId }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(gameState);
  });

  it("registra o voto e retorna o estado atualizado", async () => {
    gameService.voteForMatch.mockResolvedValue(gameState);

    const response = await vote(
      new Request(
        `http://localhost/api/games/${sessionId}/matches/${matchId}/vote`,
        {
          method: "POST",
          body: JSON.stringify({ winnerSongId }),
        },
      ),
      { params: Promise.resolve({ sessionId, matchId }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(gameState);
    expect(gameService.voteForMatch).toHaveBeenCalledWith({
      sessionId,
      matchId,
      winnerSongId,
    });
  });
});
