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
const observability = vi.hoisted(() => ({
  reportObservabilityEvent: vi.fn(),
}));
const publicGamePage = vi.hoisted(() => ({
  getPublicGamePageState: vi.fn(),
}));
const resultShareCard = vi.hoisted(() => ({
  createResultShareCard: vi.fn(),
}));
const resultStoryImage = vi.hoisted(() => ({
  createResultStoryImage: vi.fn(),
}));

vi.mock("@/server/services/game-service", () => gameService);
vi.mock("@/server/services/public-theme-service", () => publicThemeService);
vi.mock("@/server/services/rate-limit", () => rateLimitService);
vi.mock("@/server/observability/reporter", () => observability);
vi.mock("@/app/(public)/game-page-state", () => publicGamePage);
vi.mock("@/domain/game/result-share-card", () => resultShareCard);
vi.mock("@/components/game/result-story-image", () => resultStoryImage);

import { GET as getThemes } from "@/app/api/themes/route";
import { POST as createGame } from "@/app/api/games/route";
import {
  GET as getGame,
  PATCH as abandonGame,
} from "@/app/api/games/[sessionId]/route";
import { POST as reportPlayerError } from "@/app/api/games/[sessionId]/player-errors/route";
import { POST as decide } from "@/app/api/games/[sessionId]/matches/[matchId]/decision/route";
import { GET as getResultImage } from "@/app/api/resultados/[sessionId]/imagem/route";
import { AppError } from "@/lib/errors";
import { createInMemoryObservabilityExporter } from "@/server/observability/exporters";
import type { ObservabilityEventInput } from "@/server/observability/reporter";

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

  it("correlaciona e emite uma falha inesperada ao criar partida", async () => {
    const { createObservabilityReporter } = await vi.importActual<
      typeof import("@/server/observability/reporter")
    >("@/server/observability/reporter");
    const exporter = createInMemoryObservabilityExporter({
      rawRetentionDays: 7,
    });
    const reporter = createObservabilityReporter({
      environment: "local",
      now: () => new Date("2026-08-25T14:00:00.000Z"),
      exporter,
    });
    observability.reportObservabilityEvent.mockImplementation(
      (event: ObservabilityEventInput) => reporter.report(event),
    );
    gameService.createGameSession.mockRejectedValue(
      new Error("database password=segredo"),
    );

    const response = await createGame(
      new Request("http://localhost/api/games", {
        method: "POST",
        body: JSON.stringify({ themeId, bracketSize: 4 }),
      }),
    );
    const body = await response.json();
    const requestId = response.headers.get("x-request-id");

    expect(response.status).toBe(500);
    expect(body.error.requestId).toBe(requestId);
    expect(JSON.stringify(body)).not.toContain("segredo");
    expect(observability.reportObservabilityEvent).toHaveBeenCalledOnce();
    expect(observability.reportObservabilityEvent).toHaveBeenCalledWith({
      eventName: "request_failed",
      correlationId: requestId,
      payload: {
        surface: "game_create",
        errorCode: "INTERNAL_ERROR",
        status: 500,
        failureClass: "unexpected_error",
      },
    });
    expect(exporter.events).toHaveLength(1);
    expect(exporter.events[0].correlationId).toBe(requestId);
  });

  it("cobre toda operação pública de jogo para AppError 5xx e exceção inesperada", async () => {
    const scenarios = [
      {
        surface: "game_create",
        fail: gameService.createGameSession,
        invoke: () =>
          createGame(
            new Request("http://localhost/api/games", {
              method: "POST",
              body: JSON.stringify({ themeId, bracketSize: 4 }),
            }),
          ),
      },
      {
        surface: "game_session",
        fail: gameService.getGameState,
        invoke: () =>
          getGame(new Request(`http://localhost/api/games/${sessionId}`), {
            params: Promise.resolve({ sessionId }),
          }),
      },
      {
        surface: "game_session",
        fail: gameService.abandonGameSession,
        invoke: () =>
          abandonGame(
            new Request(`http://localhost/api/games/${sessionId}`, {
              method: "PATCH",
              body: JSON.stringify({ action: "abandon" }),
            }),
            { params: Promise.resolve({ sessionId }) },
          ),
      },
      {
        surface: "game_decision",
        fail: gameService.decideMatch,
        invoke: () =>
          decide(
            new Request(
              `http://localhost/api/games/${sessionId}/matches/${matchId}/decision`,
              {
                method: "POST",
                body: JSON.stringify({ type: "vote", winnerSongId }),
              },
            ),
            { params: Promise.resolve({ sessionId, matchId }) },
          ),
      },
      {
        surface: "game_player_error",
        fail: gameService.reportGamePlaybackError,
        invoke: () =>
          reportPlayerError(
            new Request(
              `http://localhost/api/games/${sessionId}/player-errors`,
              {
                method: "POST",
                body: JSON.stringify({ errorCode: 101, matchId }),
              },
            ),
            { params: Promise.resolve({ sessionId }) },
          ),
      },
    ] as const;

    for (const scenario of scenarios) {
      for (const failure of [
        new AppError(
          "INVALID_BRACKET_STATE",
          "Detalhe interno token=segredo",
          503,
        ),
        new Error("Falha inesperada token=segredo"),
      ]) {
        vi.clearAllMocks();
        rateLimitService.enforcePublicRateLimit.mockResolvedValue(undefined);
        scenario.fail.mockRejectedValueOnce(failure);

        const response = await scenario.invoke();
        const body = await response.json();
        const requestId = response.headers.get("x-request-id");
        const expectedAppError = failure instanceof AppError;

        expect(response.status).toBe(expectedAppError ? 503 : 500);
        expect(body.error.requestId).toBe(requestId);
        expect(JSON.stringify(body)).not.toContain("segredo");
        expect(observability.reportObservabilityEvent).toHaveBeenCalledOnce();
        expect(observability.reportObservabilityEvent).toHaveBeenCalledWith({
          eventName: "request_failed",
          correlationId: requestId,
          payload: {
            surface: scenario.surface,
            errorCode: expectedAppError
              ? "INVALID_BRACKET_STATE"
              : "INTERNAL_ERROR",
            status: expectedAppError ? 503 : 500,
            failureClass: expectedAppError
              ? "expected_app_error"
              : "unexpected_error",
          },
        });
      }
    }
  });

  it("não emite request_failed para 4xx em nenhuma operação pública", async () => {
    const rateLimited = () =>
      new AppError("RATE_LIMITED", "Aguarde.", 429, null, {
        "Retry-After": "3",
      });
    const scenarios = [
      {
        prepare: () =>
          rateLimitService.enforcePublicRateLimit.mockRejectedValueOnce(
            rateLimited(),
          ),
        invoke: () =>
          createGame(
            new Request("http://localhost/api/games", {
              method: "POST",
              body: JSON.stringify({ themeId, bracketSize: 4 }),
            }),
          ),
      },
      {
        prepare: () =>
          gameService.getGameState.mockRejectedValueOnce(
            new AppError("GAME_SESSION_NOT_FOUND", "Ausente.", 404),
          ),
        invoke: () =>
          getGame(new Request(`http://localhost/api/games/${sessionId}`), {
            params: Promise.resolve({ sessionId }),
          }),
      },
      {
        prepare: () =>
          rateLimitService.enforcePublicRateLimit.mockRejectedValueOnce(
            rateLimited(),
          ),
        invoke: () =>
          abandonGame(
            new Request(`http://localhost/api/games/${sessionId}`, {
              method: "PATCH",
              body: JSON.stringify({ action: "abandon" }),
            }),
            { params: Promise.resolve({ sessionId }) },
          ),
      },
      {
        prepare: () =>
          rateLimitService.enforcePublicRateLimit.mockRejectedValueOnce(
            rateLimited(),
          ),
        invoke: () =>
          decide(
            new Request(
              `http://localhost/api/games/${sessionId}/matches/${matchId}/decision`,
              {
                method: "POST",
                body: JSON.stringify({ type: "vote", winnerSongId }),
              },
            ),
            { params: Promise.resolve({ sessionId, matchId }) },
          ),
      },
      {
        prepare: () =>
          rateLimitService.enforcePublicRateLimit.mockRejectedValueOnce(
            rateLimited(),
          ),
        invoke: () =>
          reportPlayerError(
            new Request(
              `http://localhost/api/games/${sessionId}/player-errors`,
              {
                method: "POST",
                body: JSON.stringify({ errorCode: 101, matchId }),
              },
            ),
            { params: Promise.resolve({ sessionId }) },
          ),
      },
    ];

    for (const scenario of scenarios) {
      vi.clearAllMocks();
      rateLimitService.enforcePublicRateLimit.mockResolvedValue(undefined);
      scenario.prepare();

      const response = await scenario.invoke();

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);
      expect(response.headers.get("x-request-id")).toBeNull();
      expect(observability.reportObservabilityEvent).not.toHaveBeenCalled();
    }
  });

  it("preserva status, corpo e headers quando o reporter falha", async () => {
    const { createObservabilityReporter } = await vi.importActual<
      typeof import("@/server/observability/reporter")
    >("@/server/observability/reporter");
    const reporter = createObservabilityReporter({
      environment: "local",
      now: () => new Date("2026-08-25T14:00:00.000Z"),
      exporter: {
        export() {
          throw new Error("exporter indisponível");
        },
      },
    });
    gameService.createGameSession.mockRejectedValue(
      new AppError("INVALID_BRACKET_STATE", "Detalhe interno.", 503, null, {
        "Retry-After": "17",
        "x-business-header": "preserved",
      }),
    );
    observability.reportObservabilityEvent.mockImplementation(
      (event: ObservabilityEventInput) => reporter.report(event),
    );

    const response = await createGame(
      new Request("http://localhost/api/games", {
        method: "POST",
        body: JSON.stringify({ themeId, bracketSize: 4 }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("17");
    expect(response.headers.get("x-business-header")).toBe("preserved");
    expect(gameService.createGameSession).toHaveBeenCalledOnce();
    expect(body).toEqual({
      error: {
        code: "INVALID_BRACKET_STATE",
        message: "Não foi possível concluir a operação.",
        fieldErrors: null,
        requestId: response.headers.get("x-request-id"),
      },
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

  it.each([
    [
      "AppError 5xx",
      new AppError(
        "INVALID_BRACKET_STATE",
        "Detalhe interno token=segredo",
        503,
      ),
      503,
      "INVALID_BRACKET_STATE",
      "expected_app_error",
    ],
    [
      "exceção inesperada",
      new Error("Falha inesperada token=segredo"),
      500,
      "INTERNAL_ERROR",
      "unexpected_error",
    ],
  ] as const)(
    "correlaciona %s no catálogo público de temas",
    async (_scenario, failure, status, errorCode, failureClass) => {
      publicThemeService.getPublicThemes.mockRejectedValue(failure);

      const response = await getThemes();
      const body = await response.json();
      const requestId = response.headers.get("x-request-id");

      expect(response.status).toBe(status);
      expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
      expect(body.error.requestId).toBe(requestId);
      expect(observability.reportObservabilityEvent).toHaveBeenCalledOnce();
      expect(observability.reportObservabilityEvent).toHaveBeenCalledWith({
        eventName: "request_failed",
        correlationId: requestId,
        payload: {
          surface: "theme_catalog",
          errorCode,
          status,
          failureClass,
        },
      });
    },
  );

  it("preserva 4xx no catálogo público de temas sem emitir evento", async () => {
    publicThemeService.getPublicThemes.mockRejectedValue(
      new AppError("THEMES_UNAVAILABLE", "Catálogo indisponível.", 409),
    );

    const response = await getThemes();

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "THEMES_UNAVAILABLE", message: "Catálogo indisponível." },
    });
    expect(response.headers.get("x-request-id")).toBeNull();
    expect(observability.reportObservabilityEvent).not.toHaveBeenCalled();
  });

  it.each([
    [
      "AppError 5xx",
      new AppError(
        "INVALID_BRACKET_STATE",
        "Detalhe interno token=segredo",
        503,
      ),
      503,
      "INVALID_BRACKET_STATE",
      "expected_app_error",
    ],
    [
      "exceção inesperada",
      new Error("Falha inesperada token=segredo"),
      500,
      "INTERNAL_ERROR",
      "unexpected_error",
    ],
  ] as const)(
    "correlaciona %s na imagem pública de resultado",
    async (_scenario, failure, status, errorCode, failureClass) => {
      publicGamePage.getPublicGamePageState.mockRejectedValue(failure);

      const response = await getResultImage(
        new Request(`http://localhost/api/resultados/${sessionId}/imagem`),
        { params: Promise.resolve({ sessionId }) },
      );
      const body = await response.json();
      const requestId = response.headers.get("x-request-id");

      expect(response.status).toBe(status);
      expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
      expect(body.error.requestId).toBe(requestId);
      expect(observability.reportObservabilityEvent).toHaveBeenCalledOnce();
      expect(observability.reportObservabilityEvent).toHaveBeenCalledWith({
        eventName: "request_failed",
        correlationId: requestId,
        payload: {
          surface: "game_result_image",
          errorCode,
          status,
          failureClass,
        },
      });
    },
  );

  it("preserva o contrato textual 404 quando o resultado ainda não está disponível", async () => {
    publicGamePage.getPublicGamePageState.mockResolvedValue(gameState);
    resultShareCard.createResultShareCard.mockReturnValue(null);

    const response = await getResultImage(
      new Request(`http://localhost/api/resultados/${sessionId}/imagem`),
      { params: Promise.resolve({ sessionId }) },
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toBe(
      "text/plain;charset=UTF-8",
    );
    await expect(response.text()).resolves.toBe(
      "O resultado ainda não está disponível.",
    );
    expect(response.headers.get("x-request-id")).toBeNull();
    expect(observability.reportObservabilityEvent).not.toHaveBeenCalled();
  });

  it("preserva AppError 4xx na imagem pública sem emitir evento", async () => {
    publicGamePage.getPublicGamePageState.mockRejectedValue(
      new AppError("GAME_SESSION_NOT_FOUND", "Partida não encontrada.", 404),
    );

    const response = await getResultImage(
      new Request(`http://localhost/api/resultados/${sessionId}/imagem`),
      { params: Promise.resolve({ sessionId }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "GAME_SESSION_NOT_FOUND",
        message: "Partida não encontrada.",
      },
    });
    expect(response.headers.get("x-request-id")).toBeNull();
    expect(observability.reportObservabilityEvent).not.toHaveBeenCalled();
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
    expect(observability.reportObservabilityEvent).not.toHaveBeenCalled();
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
