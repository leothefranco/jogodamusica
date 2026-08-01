import { beforeEach, describe, expect, it, vi } from "vitest";

const gameService = vi.hoisted(() => ({
  abandonGameSession: vi.fn(),
  createGameSession: vi.fn(),
  getGameState: vi.fn(),
  reportGamePlaybackError: vi.fn(),
  voteForMatch: vi.fn(),
}));
const publicThemeService = vi.hoisted(() => ({
  getPublicThemes: vi.fn(),
}));

vi.mock("@/server/services/game-service", () => gameService);
vi.mock("@/server/services/public-theme-service", () => publicThemeService);

import { GET as getThemes } from "@/app/api/themes/route";
import { POST as createGame } from "@/app/api/games/route";
import {
  GET as getGame,
  PATCH as abandonGame,
} from "@/app/api/games/[sessionId]/route";
import { POST as reportPlayerError } from "@/app/api/games/[sessionId]/player-errors/route";
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

  it.each([64, 128] as const)(
    "aceita a modalidade de %i músicas",
    async (bracketSize) => {
      gameService.createGameSession.mockResolvedValue({ sessionId });

      const response = await createGame(
        new Request("http://localhost/api/games", {
          method: "POST",
          body: JSON.stringify({ themeId, bracketSize }),
        }),
      );

      expect(response.status).toBe(201);
      expect(gameService.createGameSession).toHaveBeenCalledWith({
        themeId,
        bracketSize,
      });
    },
  );

  it("rejeita uma modalidade fora das potências de dois suportadas", async () => {
    const response = await createGame(
      new Request("http://localhost/api/games", {
        method: "POST",
        body: JSON.stringify({ themeId, bracketSize: 3 }),
      }),
    );

    expect(response.status).toBe(400);
    expect(gameService.createGameSession).not.toHaveBeenCalled();
  });

  it("lista os temas jogáveis", async () => {
    const themes = [
      {
        id: themeId,
        name: "Clássicos da festa",
        supportedBracketSizes: [4, 8],
      },
    ];
    publicThemeService.getPublicThemes.mockResolvedValue(themes);

    const response = await getThemes();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ themes });
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

  it("abandona uma partida ativa", async () => {
    gameService.abandonGameSession.mockResolvedValue(undefined);

    const response = await abandonGame(
      new Request(`http://localhost/api/games/${sessionId}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "abandon" }),
      }),
      { params: Promise.resolve({ sessionId }) },
    );

    expect(response.status).toBe(204);
    expect(gameService.abandonGameSession).toHaveBeenCalledWith(sessionId);
  });

  it("registra falha do player sem dados pessoais", async () => {
    gameService.reportGamePlaybackError.mockResolvedValue(undefined);

    const response = await reportPlayerError(
      new Request(`http://localhost/api/games/${sessionId}/player-errors`, {
        method: "POST",
        body: JSON.stringify({ errorCode: 101, matchId }),
      }),
      { params: Promise.resolve({ sessionId }) },
    );

    expect(response.status).toBe(204);
    expect(gameService.reportGamePlaybackError).toHaveBeenCalledWith({
      sessionId,
      matchId,
      errorCode: 101,
    });
  });
});
