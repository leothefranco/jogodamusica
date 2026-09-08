import { getSupportedBracketSizes } from "@/domain/music/content-validation";

export type ThemeEditorialState = "draft" | "published";

export type ThemeOperationalState =
  | "editorial_draft"
  | "healthy"
  | "degraded"
  | "suspended_pending_verification"
  | "suspended_insufficient_healthy_entries";

export type ThemeAvailabilityCounts = {
  availableFresh: number;
  availableGrace: number;
  unavailable: number;
  unknown: number;
};

export function classifyThemeState(input: {
  editorialState: ThemeEditorialState;
  counts: ThemeAvailabilityCounts;
}) {
  const playableCount =
    input.counts.availableFresh + input.counts.availableGrace;
  const potentialCount = playableCount + input.counts.unknown;
  const activeEntryCount = potentialCount + input.counts.unavailable;
  const supportedModes = getSupportedBracketSizes(playableCount);
  const hasWarning =
    input.counts.availableGrace > 0 ||
    input.counts.unavailable > 0 ||
    input.counts.unknown > 0;
  let operationalState: ThemeOperationalState;
  if (input.editorialState === "draft") {
    operationalState = "editorial_draft";
  } else if (playableCount >= 4) {
    operationalState = hasWarning ? "degraded" : "healthy";
  } else {
    operationalState =
      potentialCount >= 4
        ? "suspended_pending_verification"
        : "suspended_insufficient_healthy_entries";
  }

  return {
    ruleVersion: 1 as const,
    editorialState: input.editorialState,
    visibility: (input.editorialState === "published" && playableCount >= 4
      ? "visible"
      : "hidden") as "visible" | "hidden",
    operationalState,
    counts: {
      ...input.counts,
      playableCount,
      potentialCount,
      activeEntryCount,
    },
    warnings: {
      grace: input.counts.availableGrace > 0,
      unavailable: input.counts.unavailable > 0,
      unknown: input.counts.unknown > 0,
      healthLostPrimaryModes: ([32, 64] as const).filter(
        (size) => activeEntryCount >= size && playableCount < size,
      ),
    },
    modes: {
      primary: supportedModes.filter((size) => size === 32 || size === 64),
      quick: supportedModes.filter((size) => size <= 16),
      extended: supportedModes.filter((size) => size === 128),
    },
  };
}

export type ThemeState = ReturnType<typeof classifyThemeState>;

export type ThemeStateChangeCause = "editorial" | "health";
export type ThemeStateEventType =
  | "editorial_changed"
  | "visibility_changed"
  | "degradation_changed"
  | "suspension_changed"
  | "primary_modes_changed";
export type ThemeStateEvent = {
  type: ThemeStateEventType;
  cause: ThemeStateChangeCause;
  ruleVersion: 1;
  editorialState: ThemeEditorialState;
  visibility: ThemeState["visibility"];
  operationalState: ThemeOperationalState;
  counts: ThemeState["counts"];
  lostPrimaryModes: (32 | 64)[];
};

export function deriveThemeStateEvents(
  before: ThemeState,
  after: ThemeState,
  cause: ThemeStateChangeCause,
): ThemeStateEvent[] {
  const types: ThemeStateEventType[] = [];
  if (before.editorialState !== after.editorialState)
    types.push("editorial_changed");
  if (before.visibility !== after.visibility) types.push("visibility_changed");
  if (
    (before.operationalState === "degraded") !==
    (after.operationalState === "degraded")
  )
    types.push("degradation_changed");
  if (
    before.operationalState !== after.operationalState &&
    (before.operationalState.startsWith("suspended_") ||
      after.operationalState.startsWith("suspended_"))
  )
    types.push("suspension_changed");
  if (before.modes.primary.join(",") !== after.modes.primary.join(","))
    types.push("primary_modes_changed");
  return types.map((type) => ({
    type,
    cause,
    ruleVersion: after.ruleVersion,
    editorialState: after.editorialState,
    visibility: after.visibility,
    operationalState: after.operationalState,
    counts: {
      availableFresh: after.counts.availableFresh,
      availableGrace: after.counts.availableGrace,
      unavailable: after.counts.unavailable,
      unknown: after.counts.unknown,
      playableCount: after.counts.playableCount,
      potentialCount: after.counts.potentialCount,
      activeEntryCount: after.counts.activeEntryCount,
    },
    lostPrimaryModes: before.modes.primary.filter(
      (mode) => !after.modes.primary.includes(mode),
    ),
  }));
}
