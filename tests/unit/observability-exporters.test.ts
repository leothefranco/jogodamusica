import { describe, expect, it, vi } from "vitest";

import {
  createInMemoryObservabilityExporter,
  createStructuredObservabilityExporter,
} from "@/server/observability/exporters";
import { getObservabilityMetricDimensions } from "@/server/observability/metrics";

describe("contrato compartilhado dos exporters", () => {
  it("entrega o mesmo evento validado em memória e no log estruturado", () => {
    const event = {
      eventName: "request_failed",
      schemaVersion: 1,
      occurredAt: "2026-08-25T14:00:00.000Z",
      environment: "local",
      correlationId: "10000000-0000-4000-8000-000000000001",
      payload: {
        surface: "game_decision",
        errorCode: "INVALID_ROUND_WINNERS",
        status: 500,
        failureClass: "expected_app_error",
      },
    };
    const write = vi.fn<(serializedEvent: string) => void>();
    const memory = createInMemoryObservabilityExporter({
      rawRetentionDays: 7,
    });
    const structured = createStructuredObservabilityExporter({
      rawRetentionDays: 7,
      write,
    });

    memory.export(event);
    structured.export(event);

    expect(memory.events).toEqual([event]);
    expect(JSON.parse(write.mock.calls[0][0])).toEqual(memory.events[0]);
    expect(memory.rawRetentionDays).toBe(7);
    expect(structured.rawRetentionDays).toBe(7);
  });

  it("rejeita configuração efetiva acima do teto de retenção", () => {
    expect(() =>
      createInMemoryObservabilityExporter({ rawRetentionDays: 31 }),
    ).toThrow();
    expect(() =>
      createStructuredObservabilityExporter({
        rawRetentionDays: 31,
        write: () => undefined,
      }),
    ).toThrow();
  });

  it("nunca transforma correlationId em dimensão agregável", () => {
    const event = {
      eventName: "player_playback_failed",
      schemaVersion: 1,
      occurredAt: "2026-08-25T14:00:00.000Z",
      environment: "production",
      releaseCommit: "2a24bf9059e95ca7b96c2364c0763d7de6e7c70e",
      correlationId: "10000000-0000-4000-8000-000000000001",
      payload: {
        surface: "game_player",
        playerErrorCode: 101,
        failureClass: "provider_playback",
      },
    };

    const dimensions = getObservabilityMetricDimensions(event);

    expect(dimensions).toEqual({
      eventName: "player_playback_failed",
      environment: "production",
      releaseCommit: "2a24bf9059e95ca7b96c2364c0763d7de6e7c70e",
      surface: "game_player",
      playerErrorCode: 101,
      failureClass: "provider_playback",
    });
    expect(dimensions).not.toHaveProperty("correlationId");

    const withoutRelease = getObservabilityMetricDimensions({
      ...event,
      releaseCommit: undefined,
    });
    expect(withoutRelease).toHaveProperty("releaseCommit", "unknown");
  });
});
