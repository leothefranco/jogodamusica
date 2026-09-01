import { describe, expect, it } from "vitest";

import {
  SOURCE_AVAILABILITY_POLICY,
  applySourceAvailabilityResult,
  deriveEffectiveSourceAvailability,
  normalizeProviderAvailabilityResult,
  type SourceAvailabilityObservation,
} from "@/domain/music/source-availability";

const observedAt = new Date("2026-01-01T00:00:00.000Z");
const track = {
  providerContentId: "dQw4w9WgXcQ",
  sourceTitle: "Fonte",
  sourceChannel: "Canal",
  thumbnailUrl: "https://example.com/thumb.jpg",
  durationSeconds: 180,
  isEmbeddable: true,
  isRegionAllowed: true,
};

function availableObservation(): SourceAvailabilityObservation {
  return applySourceAvailabilityResult({
    current: null,
    observedAt,
    result: { type: "available", reason: "available", track },
  });
}

describe("disponibilidade regional de Fonte", () => {
  it("aplica a policy v1 de sete dias e tolerância de vinte e quatro horas", () => {
    const observation = availableObservation();

    expect(SOURCE_AVAILABILITY_POLICY).toEqual({
      version: 1,
      region: "BR",
      availableForMs: 7 * 24 * 60 * 60 * 1_000,
      graceForMs: 24 * 60 * 60 * 1_000,
      unavailableRecheckMs: 24 * 60 * 60 * 1_000,
      transientBackoffMs: 60 * 60 * 1_000,
    });
    expect(observation).toMatchObject({
      region: "BR",
      confirmedState: "available",
      confirmationReason: "available",
      errorCode: null,
      observedAt,
      lastAttemptAt: observedAt,
      lastConfirmedAt: observedAt,
      validUntil: new Date("2026-01-08T00:00:00.000Z"),
      graceUntil: new Date("2026-01-09T00:00:00.000Z"),
      nextCheckAt: new Date("2026-01-08T00:00:00.000Z"),
      revision: 1,
      policyVersion: 1,
    });
  });

  it.each([
    ["último instante fresh", "2026-01-08T00:00:00.000Z", "available_fresh"],
    ["primeiro instante grace", "2026-01-08T00:00:00.001Z", "available_grace"],
    ["último instante grace", "2026-01-09T00:00:00.000Z", "available_grace"],
    ["primeiro instante unknown", "2026-01-09T00:00:00.001Z", "unknown"],
  ] as const)("deriva %s com limites inclusivos", (_case, now, state) => {
    expect(
      deriveEffectiveSourceAvailability(availableObservation(), new Date(now)),
    ).toMatchObject({
      state,
      playable: state !== "unknown",
      degraded: state === "available_grace",
    });
  });

  it("trata Fonte legada sem observação como unknown", () => {
    expect(deriveEffectiveSourceAvailability(null, observedAt)).toEqual({
      state: "unknown",
      playable: false,
      degraded: false,
    });
  });

  it("aplica indisponibilidade imediatamente e prioriza recheck em vinte e quatro horas", () => {
    const observation = applySourceAvailabilityResult({
      current: availableObservation(),
      observedAt: new Date("2026-01-02T00:00:00.000Z"),
      result: {
        type: "unavailable",
        reason: "region_blocked",
        track: { ...track, isRegionAllowed: false },
      },
    });

    expect(observation).toMatchObject({
      confirmedState: "unavailable",
      confirmationReason: "region_blocked",
      errorCode: null,
      validUntil: null,
      graceUntil: null,
      nextCheckAt: new Date("2026-01-03T00:00:00.000Z"),
      revision: 2,
    });
    expect(
      deriveEffectiveSourceAvailability(
        observation,
        new Date("2026-01-02T00:00:00.000Z"),
      ),
    ).toEqual({ state: "unavailable", playable: false, degraded: false });
  });

  it("preserva confirmação em falha transitória e termina em unknown depois da grace", () => {
    const current = availableObservation();
    const attemptedAt = new Date("2026-01-08T12:00:00.000Z");
    const observation = applySourceAvailabilityResult({
      current,
      observedAt: attemptedAt,
      result: { type: "transient_error", errorCode: "transport" },
    });

    expect(observation).toMatchObject({
      confirmedState: "available",
      confirmationReason: "available",
      errorCode: "transport",
      observedAt: attemptedAt,
      lastAttemptAt: attemptedAt,
      lastConfirmedAt: current.lastConfirmedAt,
      validUntil: current.validUntil,
      graceUntil: current.graceUntil,
      nextCheckAt: new Date("2026-01-08T13:00:00.000Z"),
      revision: 2,
    });
    expect(
      deriveEffectiveSourceAvailability(observation, attemptedAt),
    ).toMatchObject({ state: "available_grace", playable: true });
    expect(
      deriveEffectiveSourceAvailability(
        observation,
        new Date("2026-01-09T00:00:00.001Z"),
      ),
    ).toMatchObject({ state: "unknown", playable: false });
  });
});

describe("normalizador de resultado do provedor", () => {
  it.each([
    [
      "disponível",
      { type: "resolved", track },
      { type: "available", reason: "available", track },
    ],
    [
      "bloqueada no Brasil",
      { type: "resolved", track: { ...track, isRegionAllowed: false } },
      {
        type: "unavailable",
        reason: "region_blocked",
        track: { ...track, isRegionAllowed: false },
      },
    ],
    [
      "não incorporável",
      { type: "resolved", track: { ...track, isEmbeddable: false } },
      {
        type: "unavailable",
        reason: "not_embeddable",
        track: { ...track, isEmbeddable: false },
      },
    ],
    [
      "ausente no provedor",
      { type: "not_found" },
      { type: "unavailable", reason: "not_found", track: null },
    ],
  ] as const)("normaliza confirmação %s", (_case, input, expected) => {
    expect(normalizeProviderAvailabilityResult(input)).toEqual(expected);
  });

  it.each([
    ["YOUTUBE_UNAVAILABLE", "transport"],
    ["YOUTUBE_QUOTA_EXCEEDED", "quota"],
    ["YOUTUBE_NOT_CONFIGURED", "configuration"],
    ["INVALID_PROVIDER_RESPONSE", "invalid_response"],
    ["YOUTUBE_REQUEST_FAILED", "provider_error"],
  ] as const)("reduz %s ao código controlado %s", (code, errorCode) => {
    expect(
      normalizeProviderAvailabilityResult({ type: "error", code }),
    ).toEqual({ type: "transient_error", errorCode });
  });

  it("nunca persiste código ou payload bruto desconhecido", () => {
    const normalized = normalizeProviderAvailabilityResult({
      type: "error",
      code: "https://provider.example/?key=secret",
    });

    expect(normalized).toEqual({
      type: "transient_error",
      errorCode: "invalid_response",
    });
    expect(JSON.stringify(normalized)).not.toContain("secret");
  });
});
