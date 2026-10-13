import type { ThemeState } from "@/domain/music/theme-state";
import { z } from "zod";

const ruleVersion: ThemeState["ruleVersion"] = 1;

type HealthState = Pick<
  ThemeState,
  "editorialState" | "visibility" | "operationalState"
> & { primaryModes: (32 | 64)[] };

export function createSourceHealthInvalidation(input: {
  source: { keyHash: string; revision: number; policyVersion: number };
  theme: { id: string; slug: string };
  before: HealthState;
  after: HealthState;
}) {
  if (
    typeof input.theme.id !== "string" ||
    typeof input.source.keyHash !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      input.theme.id,
    ) ||
    !/^[0-9a-f]{64}$/.test(input.source.keyHash) ||
    !Number.isSafeInteger(input.source.revision) ||
    input.source.revision < 1 ||
    !Number.isSafeInteger(input.source.policyVersion) ||
    input.source.policyVersion < 1
  ) {
    throw new Error("Invalid catalog invalidation identity");
  }
  if (input.before.editorialState !== input.after.editorialState) {
    throw new Error("Editorial change is not a source health change");
  }
  if (
    typeof input.theme.slug !== "string" ||
    input.theme.slug.length > 140 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.theme.slug)
  ) {
    throw new Error("Invalid catalog invalidation destination");
  }
  return {
    schemaVersion: 1 as const,
    ruleVersion,
    type: "source_health_changed" as const,
    cause: "health_change" as const,
    source: {
      keyHash: input.source.keyHash,
      region: "BR" as const,
      revision: input.source.revision,
      policyVersion: input.source.policyVersion,
    },
    theme: { id: input.theme.id, slug: input.theme.slug },
    transition: {
      fromVisibility: input.before.visibility,
      toVisibility: input.after.visibility,
      fromOperationalState: input.before.operationalState,
      toOperationalState: input.after.operationalState,
      lostPrimaryModes: input.before.primaryModes.filter(
        (mode) => !input.after.primaryModes.includes(mode),
      ),
      recoveredPrimaryModes: input.after.primaryModes.filter(
        (mode) => !input.before.primaryModes.includes(mode),
      ),
    },
    paths: [
      "/",
      `/tema/${input.theme.slug}`,
      "/admin",
      "/admin/temas",
      `/admin/temas/${input.theme.id}`,
    ],
  };
}

export type SourceHealthInvalidation = ReturnType<
  typeof createSourceHealthInvalidation
>;

const visibilitySchema = z.enum(["visible", "hidden"]);
const operationalStateSchema = z.enum([
  "editorial_draft",
  "healthy",
  "degraded",
  "suspended_pending_verification",
  "suspended_insufficient_healthy_entries",
]);
const primaryModesSchema = z
  .array(z.union([z.literal(32), z.literal(64)]))
  .max(2);
const positiveVersionSchema = z
  .number()
  .int()
  .min(1)
  .max(Number.MAX_SAFE_INTEGER);
const healthInvalidationSchema = z.strictObject({
  schemaVersion: z.literal(1),
  ruleVersion: z.literal(ruleVersion),
  type: z.literal("source_health_changed"),
  cause: z.literal("health_change"),
  source: z.strictObject({
    keyHash: z.string().regex(/^[0-9a-f]{64}$/),
    region: z.literal("BR"),
    revision: positiveVersionSchema,
    policyVersion: positiveVersionSchema,
  }),
  theme: z.strictObject({
    id: z
      .string()
      .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
    slug: z
      .string()
      .max(140)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  }),
  transition: z.strictObject({
    fromVisibility: visibilitySchema,
    toVisibility: visibilitySchema,
    fromOperationalState: operationalStateSchema,
    toOperationalState: operationalStateSchema,
    lostPrimaryModes: primaryModesSchema,
    recoveredPrimaryModes: primaryModesSchema,
  }),
  paths: z.array(z.string()).length(5),
});

export function parseSourceHealthInvalidation(
  value: unknown,
): SourceHealthInvalidation {
  const parsed = healthInvalidationSchema.safeParse(value);
  if (!parsed.success) throw new Error("Invalid catalog invalidation payload");
  const payload = parsed.data;
  const { lostPrimaryModes, recoveredPrimaryModes } = payload.transition;
  if (
    new Set(lostPrimaryModes).size !== lostPrimaryModes.length ||
    new Set(recoveredPrimaryModes).size !== recoveredPrimaryModes.length ||
    lostPrimaryModes.some((mode) => recoveredPrimaryModes.includes(mode))
  )
    throw new Error("Invalid catalog invalidation payload");
  const expected = createSourceHealthInvalidation({
    source: payload.source,
    theme: payload.theme,
    before: {
      editorialState:
        payload.transition.fromOperationalState === "editorial_draft"
          ? "draft"
          : "published",
      visibility: payload.transition.fromVisibility,
      operationalState: payload.transition.fromOperationalState,
      primaryModes: lostPrimaryModes,
    },
    after: {
      editorialState:
        payload.transition.toOperationalState === "editorial_draft"
          ? "draft"
          : "published",
      visibility: payload.transition.toVisibility,
      operationalState: payload.transition.toOperationalState,
      primaryModes: recoveredPrimaryModes,
    },
  });
  if (payload.paths.some((path, index) => path !== expected.paths[index]))
    throw new Error("Invalid catalog invalidation payload");
  return expected;
}
