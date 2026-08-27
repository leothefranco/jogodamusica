import type { ResolvedProviderTrack } from "@/domain/music/provider";

const HOUR_MS = 60 * 60 * 1_000;
const DAY_MS = 24 * HOUR_MS;

export const SOURCE_AVAILABILITY_POLICY = {
  version: 1,
  region: "BR",
  availableForMs: 7 * DAY_MS,
  graceForMs: DAY_MS,
  unavailableRecheckMs: DAY_MS,
  transientBackoffMs: HOUR_MS,
} as const;

export type SourceAvailabilityRegion =
  (typeof SOURCE_AVAILABILITY_POLICY)["region"];

export type SourceAvailabilityConfirmedState =
  "available" | "unavailable" | "unknown";

export type SourceAvailabilityConfirmationReason =
  "available" | "region_blocked" | "not_embeddable" | "not_found";

export type SourceAvailabilityErrorCode =
  | "transport"
  | "quota"
  | "configuration"
  | "invalid_response"
  | "provider_error";

export type EffectiveSourceAvailabilityState =
  "available_fresh" | "available_grace" | "unavailable" | "unknown";

export type SourceAvailabilityObservation = {
  region: string;
  confirmedState: SourceAvailabilityConfirmedState;
  confirmationReason: SourceAvailabilityConfirmationReason | null;
  errorCode: SourceAvailabilityErrorCode | null;
  observedAt: Date;
  lastAttemptAt: Date;
  lastConfirmedAt: Date | null;
  validUntil: Date | null;
  graceUntil: Date | null;
  nextCheckAt: Date;
  revision: number;
  policyVersion: number;
};

export type ProviderAvailabilityInput =
  | { type: "resolved"; track: ResolvedProviderTrack }
  | { type: "not_found" }
  | { type: "error"; code: string };

export type NormalizedProviderAvailabilityResult =
  | {
      type: "available";
      reason: "available";
      track: ResolvedProviderTrack;
    }
  | {
      type: "unavailable";
      reason: Exclude<SourceAvailabilityConfirmationReason, "available">;
      track: ResolvedProviderTrack | null;
    }
  | { type: "transient_error"; errorCode: SourceAvailabilityErrorCode };

export type EffectiveSourceAvailability = {
  state: EffectiveSourceAvailabilityState;
  playable: boolean;
  degraded: boolean;
};

const providerErrorCodes = new Map<string, SourceAvailabilityErrorCode>([
  ["YOUTUBE_UNAVAILABLE", "transport"],
  ["YOUTUBE_QUOTA_EXCEEDED", "quota"],
  ["YOUTUBE_NOT_CONFIGURED", "configuration"],
  ["INVALID_PROVIDER_RESPONSE", "invalid_response"],
  ["YOUTUBE_REQUEST_FAILED", "provider_error"],
]);

function addMilliseconds(date: Date, milliseconds: number) {
  return new Date(date.getTime() + milliseconds);
}

export function normalizeProviderAvailabilityResult(
  input: ProviderAvailabilityInput,
): NormalizedProviderAvailabilityResult {
  if (input.type === "not_found") {
    return { type: "unavailable", reason: "not_found", track: null };
  }

  if (input.type === "error") {
    return {
      type: "transient_error",
      errorCode:
        providerErrorCodes.get(input.code) ?? UNRECOGNIZED_PROVIDER_ERROR_CODE,
    };
  }

  if (!input.track.isEmbeddable) {
    return {
      type: "unavailable",
      reason: "not_embeddable",
      track: input.track,
    };
  }

  if (!input.track.isRegionAllowed) {
    return {
      type: "unavailable",
      reason: "region_blocked",
      track: input.track,
    };
  }

  return { type: "available", reason: "available", track: input.track };
}

const UNRECOGNIZED_PROVIDER_ERROR_CODE: SourceAvailabilityErrorCode =
  "invalid_response";

export function applySourceAvailabilityResult({
  current,
  observedAt,
  result,
}: {
  current: SourceAvailabilityObservation | null;
  observedAt: Date;
  result: NormalizedProviderAvailabilityResult;
}): SourceAvailabilityObservation {
  const revision = (current?.revision ?? 0) + 1;

  if (result.type === "available") {
    const validUntil = addMilliseconds(
      observedAt,
      SOURCE_AVAILABILITY_POLICY.availableForMs,
    );
    return {
      region: SOURCE_AVAILABILITY_POLICY.region,
      confirmedState: "available",
      confirmationReason: result.reason,
      errorCode: null,
      observedAt,
      lastAttemptAt: observedAt,
      lastConfirmedAt: observedAt,
      validUntil,
      graceUntil: addMilliseconds(
        validUntil,
        SOURCE_AVAILABILITY_POLICY.graceForMs,
      ),
      nextCheckAt: validUntil,
      revision,
      policyVersion: SOURCE_AVAILABILITY_POLICY.version,
    };
  }

  if (result.type === "unavailable") {
    return {
      region: SOURCE_AVAILABILITY_POLICY.region,
      confirmedState: "unavailable",
      confirmationReason: result.reason,
      errorCode: null,
      observedAt,
      lastAttemptAt: observedAt,
      lastConfirmedAt: observedAt,
      validUntil: null,
      graceUntil: null,
      nextCheckAt: addMilliseconds(
        observedAt,
        SOURCE_AVAILABILITY_POLICY.unavailableRecheckMs,
      ),
      revision,
      policyVersion: SOURCE_AVAILABILITY_POLICY.version,
    };
  }

  return {
    region: SOURCE_AVAILABILITY_POLICY.region,
    confirmedState: current?.confirmedState ?? "unknown",
    confirmationReason: current?.confirmationReason ?? null,
    errorCode: result.errorCode,
    observedAt,
    lastAttemptAt: observedAt,
    lastConfirmedAt: current?.lastConfirmedAt ?? null,
    validUntil: current?.validUntil ?? null,
    graceUntil: current?.graceUntil ?? null,
    nextCheckAt: addMilliseconds(
      observedAt,
      SOURCE_AVAILABILITY_POLICY.transientBackoffMs,
    ),
    revision,
    policyVersion: SOURCE_AVAILABILITY_POLICY.version,
  };
}

export function deriveEffectiveSourceAvailability(
  observation: SourceAvailabilityObservation | null,
  now: Date,
): EffectiveSourceAvailability {
  if (!observation || observation.confirmedState === "unknown") {
    return { state: "unknown", playable: false, degraded: false };
  }

  if (observation.confirmedState === "unavailable") {
    return { state: "unavailable", playable: false, degraded: false };
  }

  if (observation.validUntil && now <= observation.validUntil) {
    return { state: "available_fresh", playable: true, degraded: false };
  }

  if (observation.graceUntil && now <= observation.graceUntil) {
    return { state: "available_grace", playable: true, degraded: true };
  }

  return { state: "unknown", playable: false, degraded: false };
}

export type SourceAvailabilityAgeBand =
  "unconfirmed" | "under_1d" | "from_1d_to_7d" | "from_7d_to_8d" | "over_8d";

export function getSourceAvailabilityAgeBand(
  observation: SourceAvailabilityObservation,
  now: Date,
): SourceAvailabilityAgeBand {
  if (!observation.lastConfirmedAt) return "unconfirmed";

  const age = Math.max(
    0,
    now.getTime() - observation.lastConfirmedAt.getTime(),
  );
  if (age < DAY_MS) return "under_1d";
  if (age <= SOURCE_AVAILABILITY_POLICY.availableForMs) return "from_1d_to_7d";
  if (
    age <=
    SOURCE_AVAILABILITY_POLICY.availableForMs +
      SOURCE_AVAILABILITY_POLICY.graceForMs
  ) {
    return "from_7d_to_8d";
  }
  return "over_8d";
}
