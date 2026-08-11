import { afterEach, describe, expect, it, vi } from "vitest";

import { AppError, errorResponse } from "@/lib/errors";

describe("respostas de erro", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("correlaciona e registra falhas inesperadas sem vazar a exceção", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = errorResponse(new Error("senha=segredo"));
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
        name: "Error",
        message: "senha=[REDACTED]",
        stack: expect.stringContaining("senha=[REDACTED]"),
      }),
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain("senha=segredo");
  });

  it("não registra erros operacionais esperados", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = errorResponse(new AppError("NOT_FOUND", "Ausente.", 404));

    expect(response.status).toBe(404);
    expect(response.headers.get("x-request-id")).toBeNull();
    expect(log).not.toHaveBeenCalled();
  });
});
