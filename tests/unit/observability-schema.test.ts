import { describe, expect, it } from "vitest";

import { observabilityEventSchema } from "@/server/observability/schema";

describe("contrato de eventos de observabilidade", () => {
  it("aceita um request_failed com envelope e payload fechados", () => {
    const event = {
      eventName: "request_failed",
      schemaVersion: 1,
      occurredAt: "2026-08-25T14:00:00.000Z",
      environment: "local",
      releaseCommit: "2a24bf9059e95ca7b96c2364c0763d7de6e7c70e",
      correlationId: "10000000-0000-4000-8000-000000000001",
      payload: {
        surface: "game_create",
        errorCode: "INTERNAL_ERROR",
        status: 500,
        failureClass: "unexpected_error",
      },
    };

    expect(observabilityEventSchema.parse(event)).toEqual(event);
  });

  it.each(["theme_catalog", "game_result_image"] as const)(
    "mantém a surface pública %s no catálogo fechado",
    (surface) => {
      const event = {
        eventName: "request_failed",
        schemaVersion: 1,
        occurredAt: "2026-08-25T14:00:00.000Z",
        environment: "preview",
        correlationId: "10000000-0000-4000-8000-000000000001",
        payload: {
          surface,
          errorCode: "INTERNAL_ERROR",
          status: 500,
          failureClass: "unexpected_error",
        },
      };

      expect(observabilityEventSchema.parse(event)).toEqual(event);
    },
  );

  it("rejeita campo desconhecido, versão incompatível, obrigatório ausente e timestamp sem UTC", () => {
    const baseEvent = {
      eventName: "request_failed",
      schemaVersion: 1,
      occurredAt: "2026-08-25T14:00:00.000Z",
      environment: "preview",
      correlationId: "10000000-0000-4000-8000-000000000001",
      payload: {
        surface: "game_session",
        errorCode: "INVALID_BRACKET_STATE",
        status: 500,
        failureClass: "expected_app_error",
      },
    };
    const withoutCorrelationId = Object.fromEntries(
      Object.entries(baseEvent).filter(([key]) => key !== "correlationId"),
    );

    const invalidEvents = [
      { ...baseEvent, unexpected: "free text" },
      { ...baseEvent, schemaVersion: 2 },
      withoutCorrelationId,
      { ...baseEvent, occurredAt: "2026-08-25T11:00:00-03:00" },
      { ...baseEvent, releaseCommit: "main token=segredo" },
    ];

    for (const event of invalidEvents) {
      expect(observabilityEventSchema.safeParse(event).success).toBe(false);
    }
  });

  it("aceita somente os cinco códigos fechados de player_playback_failed", () => {
    for (const playerErrorCode of [2, 5, 100, 101, 150]) {
      const event = {
        eventName: "player_playback_failed",
        schemaVersion: 1,
        occurredAt: "2026-08-25T14:00:00.000Z",
        environment: "production",
        correlationId: "10000000-0000-4000-8000-000000000001",
        payload: {
          surface: "game_player",
          playerErrorCode,
          failureClass: "provider_playback",
        },
      };

      expect(observabilityEventSchema.parse(event)).toEqual(event);
    }

    expect(
      observabilityEventSchema.safeParse({
        eventName: "player_playback_failed",
        schemaVersion: 1,
        occurredAt: "2026-08-25T14:00:00.000Z",
        environment: "production",
        correlationId: "10000000-0000-4000-8000-000000000001",
        payload: {
          surface: "game_player",
          playerErrorCode: 101,
          failureClass: "provider_playback",
          sessionId: "20000000-0000-4000-8000-000000000020",
        },
      }).success,
    ).toBe(false);
  });
});
