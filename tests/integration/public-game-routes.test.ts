import { beforeEach, describe, expect, it, vi } from "vitest";

const gameService = vi.hoisted(() => ({
  abandonGameSession: vi.fn(),
  createGameSession: vi.fn(),
  decideMatch: vi.fn(),
  getGameState: vi.fn(),
  reportGamePlaybackError: vi.fn(),
}));
const publicThemeService = vi.hoisted(() => ({
  getPublicThemes: vi.fn(),
}));
const rateLimitService = vi.hoisted(() => ({
  enforcePublicRateLimit: vi.fn(),
}));

vi.mock("@/server/services/game-service", () => gameService);
vi.mock("@/server/services/public-theme-service", () => publicThemeService);
vi.mock("@/server/services/rate-limit", () => rateLimitService);

import { GET as getThemes } from "@/app/api/themes/route";
import { POST as createGame } from "@/app/api/games/route";
import {
  GET as getGame,
  PATCH as abandonGame,
} from "@/app/api/games/[sessionId]/route";
import { POST as reportPlayerError } from "@/app/api/games/[sessionId]/player-errors/route";
import { POST as decide } from "@/app/api/games/[sessionId]/matches/[matchId]/decision/route";
import { AppError } from "@/lib/errors";

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
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitService.enforcePublicRateLimit.mockResolvedValue(undefined);
  });

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

  it("limita a criação de partidas antes de tocar o domínio", async () => {
    rateLimitService.enforcePublicRateLimit.mockRejectedValue(
      new AppError(
        "RATE_LIMITED",
        "Muitas partidas em pouco tempo.",
        429,
        null,
        { "Retry-After": "120" },
      ),
    );

    const response = await createGame(
      new Request("http://localhost/api/games", {
        method: "POST",
        headers: { "x-forwarded-for": "203.0.113.10" },
        body: JSON.stringify({ themeId, bracketSize: 4 }),
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("120");
    expect(gameService.createGameSession).not.toHaveBeenCalled();
    expect(rateLimitService.enforcePublicRateLimit).toHaveBeenCalledWith(
      expect.any(Request),
      "game-create",
      { limit: 20, windowMs: 60 * 60_000 },
    );
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
    gameService.decideMatch.mockResolvedValue(gameState);

    const response = await decide(
      new Request(
        `http://localhost/api/games/${sessionId}/matches/${matchId}/decision`,
        {
          method: "POST",
          body: JSON.stringify({ type: "vote", winnerSongId }),
        },
      ),
      { params: Promise.resolve({ sessionId, matchId }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(gameState);
    expect(gameService.decideMatch).toHaveBeenCalledWith({
      sessionId,
      matchId,
      decision: { type: "vote", winnerSongId },
    });
  });

  it("limita decisões por sessão antes de tocar o domínio", async () => {
    rateLimitService.enforcePublicRateLimit.mockRejectedValue(
      new AppError("RATE_LIMITED", "Aguarde.", 429),
    );

    const response = await decide(
      new Request(
        `http://localhost/api/games/${sessionId}/matches/${matchId}/decision`,
        {
          method: "POST",
          body: JSON.stringify({ type: "vote", winnerSongId }),
        },
      ),
      { params: Promise.resolve({ sessionId, matchId }) },
    );

    expect(response.status).toBe(429);
    expect(gameService.decideMatch).not.toHaveBeenCalled();
    expect(rateLimitService.enforcePublicRateLimit).toHaveBeenCalledWith(
      expect.any(Request),
      "game-decision",
      { limit: 90, windowMs: 60_000 },
      sessionId,
    );
  });

  it("registra desempate sem vencedora fornecida pelo cliente", async () => {
    gameService.decideMatch.mockResolvedValue(gameState);

    const response = await decide(
      new Request(
        `http://localhost/api/games/${sessionId}/matches/${matchId}/decision`,
        { method: "POST", body: JSON.stringify({ type: "tiebreak" }) },
      ),
      { params: Promise.resolve({ sessionId, matchId }) },
    );

    expect(response.status).toBe(200);
    expect(gameService.decideMatch).toHaveBeenCalledWith({
      sessionId,
      matchId,
      decision: { type: "tiebreak" },
    });
  });

  it.each([
    ["voto sem vencedora", { type: "vote" }],
    ["tipo desconhecido", { type: "coin-flip" }],
    ["vencedora enviada em um desempate", { type: "tiebreak", winnerSongId }],
  ])("rejeita %s", async (_scenario, decision) => {
    const response = await decide(
      new Request(
        `http://localhost/api/games/${sessionId}/matches/${matchId}/decision`,
        {
          method: "POST",
          body: JSON.stringify(decision),
        },
      ),
      { params: Promise.resolve({ sessionId, matchId }) },
    );

    expect(response.status).toBe(400);
    expect(gameService.decideMatch).not.toHaveBeenCalled();
  });

  it.each([
    ["MATCH_NOT_FOUND", "Confronto não encontrado.", 404],
    ["GAME_SESSION_NOT_ACTIVE", "Partida encerrada.", 409],
  ] as const)("preserva erro %s do serviço", async (code, message, status) => {
    gameService.decideMatch.mockRejectedValue(
      new AppError(code, message, status),
    );

    const response = await decide(
      new Request(
        `http://localhost/api/games/${sessionId}/matches/${matchId}/decision`,
        {
          method: "POST",
          body: JSON.stringify({ type: "vote", winnerSongId }),
        },
      ),
      { params: Promise.resolve({ sessionId, matchId }) },
    );

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toMatchObject({ error: { code } });
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

  it("limita abandonos por sessão antes de tocar o domínio", async () => {
    rateLimitService.enforcePublicRateLimit.mockRejectedValue(
      new AppError("RATE_LIMITED", "Aguarde.", 429),
    );

    const response = await abandonGame(
      new Request(`http://localhost/api/games/${sessionId}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "abandon" }),
      }),
      { params: Promise.resolve({ sessionId }) },
    );

    expect(response.status).toBe(429);
    expect(gameService.abandonGameSession).not.toHaveBeenCalled();
    expect(rateLimitService.enforcePublicRateLimit).toHaveBeenCalledWith(
      expect.any(Request),
      "game-abandon",
      { limit: 10, windowMs: 10 * 60_000 },
      sessionId,
    );
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

  it("limita relatos de falha por sessão antes de tocar o domínio", async () => {
    rateLimitService.enforcePublicRateLimit.mockRejectedValue(
      new AppError("RATE_LIMITED", "Aguarde.", 429),
    );

    const response = await reportPlayerError(
      new Request(`http://localhost/api/games/${sessionId}/player-errors`, {
        method: "POST",
        body: JSON.stringify({ errorCode: 101, matchId }),
      }),
      { params: Promise.resolve({ sessionId }) },
    );

    expect(response.status).toBe(429);
    expect(gameService.reportGamePlaybackError).not.toHaveBeenCalled();
    expect(rateLimitService.enforcePublicRateLimit).toHaveBeenCalledWith(
      expect.any(Request),
      "player-error",
      { limit: 20, windowMs: 10 * 60_000 },
      sessionId,
    );
  });
});
