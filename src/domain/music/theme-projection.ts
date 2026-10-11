import {
  classifyThemeState,
  type ThemeAvailabilityCounts,
  type ThemeEditorialState,
} from "@/domain/music/theme-state";

export function deriveThemeProjection(input: {
  editorialState: ThemeEditorialState;
  counts: ThemeAvailabilityCounts;
  now: Date;
  policyVersion: number;
}) {
  for (const count of Object.values(input.counts)) {
    if (!Number.isSafeInteger(count) || count < 0)
      throw new Error("Invalid projection count");
  }
  if (
    !Number.isSafeInteger(input.policyVersion) ||
    input.policyVersion < 1 ||
    !Number.isFinite(input.now.getTime())
  )
    throw new Error("Invalid projection context");
  const state = classifyThemeState(input);
  return {
    ...state.counts,
    editorialState: state.editorialState,
    visibility: state.visibility,
    operationalState: state.operationalState,
    supportedModes: [
      ...state.modes.quick,
      ...state.modes.primary,
      ...state.modes.extended,
    ],
    policyVersion: input.policyVersion,
    ruleVersion: state.ruleVersion,
    calculatedAt: input.now,
  };
}

export type ThemeProjection = ReturnType<typeof deriveThemeProjection>;
export const projectionLogicalFields = [
  "availableFresh",
  "availableGrace",
  "unavailable",
  "unknown",
  "playableCount",
  "potentialCount",
  "activeEntryCount",
  "editorialState",
  "visibility",
  "operationalState",
  "supportedModes",
  "policyVersion",
  "ruleVersion",
] as const satisfies readonly (keyof ThemeProjection)[];

export function changedProjectionFields(
  before: Omit<ThemeProjection, "ruleVersion"> & { ruleVersion: number },
  after: ThemeProjection,
) {
  return projectionLogicalFields.filter(
    (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]),
  );
}
