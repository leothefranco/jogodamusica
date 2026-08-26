import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/observability/redaction", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/server/observability/redaction")>();
  return {
    ...actual,
    redactDiagnosticValue: vi.fn(actual.redactDiagnosticValue),
  };
});

import { createInMemoryObservabilityExporter } from "@/server/observability/exporters";
import { redactDiagnosticValue } from "@/server/observability/redaction";
import { createObservabilityReporter } from "@/server/observability/reporter";

describe("reporter de observabilidade", () => {
  it("completa e valida o envelope antes de exportar", () => {
    const exporter = createInMemoryObservabilityExporter({
      rawRetentionDays: 30,
    });
    const reporter = createObservabilityReporter({
      environment: "preview",
      releaseCommit: "2a24bf9059e95ca7b96c2364c0763d7de6e7c70e",
      now: () => new Date("2026-08-25T14:00:00.000Z"),
      exporter,
    });

    reporter.report({
      eventName: "request_failed",
      correlationId: "10000000-0000-4000-8000-000000000001",
      payload: {
        surface: "game_create",
        errorCode: "INTERNAL_ERROR",
        status: 500,
        failureClass: "unexpected_error",
      },
    });

    expect(exporter.events).toEqual([
      {
        eventName: "request_failed",
        schemaVersion: 1,
        occurredAt: "2026-08-25T14:00:00.000Z",
        environment: "preview",
        releaseCommit: "2a24bf9059e95ca7b96c2364c0763d7de6e7c70e",
        correlationId: "10000000-0000-4000-8000-000000000001",
        payload: {
          surface: "game_create",
          errorCode: "INTERNAL_ERROR",
          status: 500,
          failureClass: "unexpected_error",
        },
      },
    ]);
  });

  it("bloqueia texto livre e isola falhas do exporter", () => {
    const redact = vi.mocked(redactDiagnosticValue);
    redact.mockClear();
    const exportEvent = vi.fn(() => {
      throw new Error("exporter indisponível");
    });
    const reporter = createObservabilityReporter({
      environment: "local",
      now: () => new Date("2026-08-25T14:00:00.000Z"),
      exporter: { export: exportEvent },
    });
    const validInput = {
      eventName: "request_failed" as const,
      correlationId: "10000000-0000-4000-8000-000000000001",
      payload: {
        surface: "game_session" as const,
        errorCode: "INTERNAL_ERROR" as const,
        status: 500,
        failureClass: "unexpected_error" as const,
      },
    };

    expect(() => reporter.report(validInput)).not.toThrow();
    expect(exportEvent).toHaveBeenCalledOnce();
    expect(redact).toHaveBeenCalledOnce();
    expect(redact.mock.invocationCallOrder[0]).toBeLessThan(
      exportEvent.mock.invocationCallOrder[0],
    );

    reporter.report({ ...validInput, message: "texto livre" } as never);
    expect(exportEvent).toHaveBeenCalledOnce();
  });

  it("aplica redaction central antes de recusar um envelope desconhecido", () => {
    const exportEvent = vi.fn();
    const reporter = createObservabilityReporter({
      environment: "local",
      now: () => new Date("2026-08-25T14:00:00.000Z"),
      exporter: { export: exportEvent },
    });

    reporter.report({
      eventName: "request_failed",
      correlationId: "10000000-0000-4000-8000-000000000001",
      payload: {
        surface: "game_session",
        errorCode: "INTERNAL_ERROR",
        status: 500,
        failureClass: "unexpected_error",
      },
      diagnostic: {
        YOUTUBE_API_KEY: "sentinela-youtube-exporter",
        RATE_LIMIT_KEY_SECRET: "sentinela-rate-exporter",
        client_secret: "sentinela-client-exporter",
        accessToken: "sentinela-access-exporter",
        clientIp: "2001:db8::1",
      },
    } as never);

    expect(exportEvent).not.toHaveBeenCalled();
    expect(JSON.stringify(exportEvent.mock.calls)).not.toContain("sentinela-");
  });
});
