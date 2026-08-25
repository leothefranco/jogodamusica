import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AppError,
  createErrorResponseContext,
  errorResponse,
} from "@/lib/errors";

describe("respostas de erro", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("correlaciona e registra falhas inesperadas sem vazar a exceção", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const cause = new Error("Bearer causa-secreta");
    cause.name = "capability=games:write";
    const failure = new Error("senha=segredo", { cause });
    failure.name = "token=nome-secreto";
    const response = errorResponse(failure);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(body).toMatchObject({
      error: {
        code: "INTERNAL_ERROR",
        requestId: response.headers.get("x-request-id"),
      },
    });
    expect(JSON.stringify(body)).not.toContain("senha=segredo");
    expect(log).toHaveBeenCalledWith(
      "[server-error]",
      expect.objectContaining({
        requestId: response.headers.get("x-request-id"),
        name: "token=[REDACTED]",
        message: "senha=[REDACTED]",
        stack: expect.stringContaining("senha=[REDACTED]"),
        cause: expect.objectContaining({
          name: "capability=[REDACTED]",
          message: "Bearer [REDACTED]",
        }),
      }),
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain("senha=segredo");
    expect(JSON.stringify(log.mock.calls)).not.toContain("games:write");
    expect(JSON.stringify(log.mock.calls)).not.toContain("causa-secreta");
  });

  it("não registra erros operacionais esperados", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = errorResponse(new AppError("NOT_FOUND", "Ausente.", 404));

    expect(response.status).toBe(404);
    expect(response.headers.get("x-request-id")).toBeNull();
    expect(log).not.toHaveBeenCalled();
  });

  it("preserva o contrato legado de AppError 5xx fora da superfície pública", async () => {
    const response = errorResponse(
      new AppError("ADMIN_PROVIDER_ERROR", "Detalhe administrativo.", 502, {
        provider: ["indisponível"],
      }),
    );

    expect(response.status).toBe(502);
    expect(response.headers.get("x-request-id")).toBeNull();
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "ADMIN_PROVIDER_ERROR",
        message: "Detalhe administrativo.",
        fieldErrors: { provider: ["indisponível"] },
      },
    });
  });

  it("deduplica fronteiras aninhadas por requisição sem suprimir a próxima requisição", async () => {
    const reportFailure = vi.fn();
    const failure = new AppError(
      "INVALID_BRACKET_STATE",
      "Falha interna com token=segredo",
      503,
      { internal: ["não expor"] },
    );
    const requestContext = createErrorResponseContext();
    let firstResponse: Response | undefined;
    let nestedResponse: Response | undefined;

    try {
      try {
        throw failure;
      } catch (caught) {
        firstResponse = errorResponse(caught, {
          correlateServerFailure: true,
          failureContext: requestContext,
          reportFailure,
        });
        throw caught;
      }
    } catch (caught) {
      nestedResponse = errorResponse(caught, {
        correlateServerFailure: true,
        failureContext: requestContext,
        reportFailure,
      });
    }

    const secondResponse = errorResponse(failure, {
      correlateServerFailure: true,
      failureContext: createErrorResponseContext(),
      reportFailure,
    });
    expect(firstResponse).toBeDefined();
    expect(nestedResponse).toBeDefined();
    const firstBody = await firstResponse!.json();
    const nestedBody = await nestedResponse!.json();
    const secondBody = await secondResponse.json();
    const requestId = firstResponse!.headers.get("x-request-id");
    const secondRequestId = secondResponse.headers.get("x-request-id");

    expect(firstResponse!.status).toBe(503);
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(secondRequestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(secondRequestId).not.toBe(requestId);
    expect(nestedResponse!.headers.get("x-request-id")).toBe(requestId);
    expect(nestedBody.error.requestId).toBe(requestId);
    expect(firstBody).toEqual({
      error: {
        code: "INVALID_BRACKET_STATE",
        message: "Não foi possível concluir a operação.",
        fieldErrors: null,
        requestId,
      },
    });
    expect(secondBody.error.requestId).toBe(secondRequestId);
    expect(JSON.stringify(firstBody)).not.toContain("segredo");
    expect(reportFailure).toHaveBeenCalledTimes(2);
    expect(reportFailure).toHaveBeenNthCalledWith(1, {
      correlationId: requestId,
      errorCode: "INVALID_BRACKET_STATE",
      status: 503,
      failureClass: "expected_app_error",
    });
    expect(reportFailure).toHaveBeenNthCalledWith(2, {
      correlationId: secondRequestId,
      errorCode: "INVALID_BRACKET_STATE",
      status: 503,
      failureClass: "expected_app_error",
    });
  });
});
