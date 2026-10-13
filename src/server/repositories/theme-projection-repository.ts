import "server-only";

import { asc, inArray, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { themes, themeStateProjections } from "@/db/schema";
import { SOURCE_AVAILABILITY_POLICY } from "@/domain/music/source-availability";
import {
  deriveThemeProjection,
  changedProjectionFields,
} from "@/domain/music/theme-projection";
import { createAuthoritativePublicThemeRepository } from "@/server/repositories/authoritative-public-theme-repository";
import { AppError } from "@/lib/errors";

export type ProjectionDatabase = Pick<
  PgDatabase<PgQueryResultHKT>,
  "select" | "insert"
>;
export type ProjectionContext = {
  now: Date;
  policy: typeof SOURCE_AVAILABILITY_POLICY;
};
export function captureProjectionContext(now = new Date()): ProjectionContext {
  return { now: new Date(now.getTime()), policy: SOURCE_AVAILABILITY_POLICY };
}
export function themeProjectionWritesEnabled() {
  return process.env.THEME_PROJECTION_WRITE_MODE === "enabled";
}
export type ThemeProjectionMetric = {
  metric: "theme_projection_recalculation";
  result: "created" | "unchanged" | "corrected";
  durationMs: number;
  changedFieldCount: number;
  driftCorrected: boolean;
  ruleVersion: number;
  policyVersion: number;
};
export function recordThemeProjectionMetric(metric: ThemeProjectionMetric) {
  try {
    console.info("[theme-projection]", metric);
  } catch {
    /* Telemetry cannot change a committed mutation. */
  }
}

// The caller's transaction owns every affected parent before any source lock.
// One aggregate and one bulk write share the captured policy and instant.
export async function recalculateThemeProjectionsUsing(
  database: ProjectionDatabase,
  themeIds: string[],
  context = captureProjectionContext(),
  cause: "mutation" | "rebuild" = "mutation",
) {
  const ids = [...new Set(themeIds)].sort();
  if (ids.length === 0) return [];
  const startedAt = performance.now();
  const locked = await database
    .select({ id: themes.id })
    .from(themes)
    .where(inArray(themes.id, ids))
    .orderBy(asc(themes.id))
    .for("update");
  if (locked.length !== ids.length)
    throw new AppError("THEME_NOT_FOUND", "Tema não encontrado.", 404);
  const bases = await createAuthoritativePublicThemeRepository(
    database,
  ).queryThemes({ ...context, themeIds: ids });
  if (bases.length !== ids.length)
    throw new AppError("THEME_NOT_FOUND", "Tema não encontrado.", 404);
  const existing = new Map(
    (
      await database
        .select()
        .from(themeStateProjections)
        .where(inArray(themeStateProjections.themeId, ids))
        .orderBy(asc(themeStateProjections.themeId))
        .for("update")
    ).map((row) => [row.themeId, row]),
  );
  const recalculations = bases.map((base) => {
    const candidate = {
      themeId: base.id,
      ...deriveThemeProjection({
        editorialState: base.editorialState,
        counts: base.counts,
        now: context.now,
        policyVersion: context.policy.version,
      }),
      thumbnailUrls: base.thumbnailUrls,
      nextTransitionAt: base.nextTransitionAt ?? null,
    };
    const before = existing.get(base.id);
    const changedFields: string[] = before
      ? [...changedProjectionFields(before, candidate)]
      : ["projection"];
    if (
      before &&
      JSON.stringify(before.thumbnailUrls) !==
        JSON.stringify(candidate.thumbnailUrls)
    )
      changedFields.push("thumbnailUrls");
    if (
      before &&
      (before.nextTransitionAt?.getTime() ?? null) !==
        (candidate.nextTransitionAt?.getTime() ?? null)
    )
      changedFields.push("nextTransitionAt");
    const status = !before
      ? "created"
      : changedFields.length === 0
        ? "unchanged"
        : "corrected";
    const metric: ThemeProjectionMetric = {
      metric: "theme_projection_recalculation",
      result: status,
      durationMs: performance.now() - startedAt,
      changedFieldCount: changedFields.length,
      driftCorrected: cause === "rebuild" && status === "corrected",
      ruleVersion: candidate.ruleVersion,
      policyVersion: candidate.policyVersion,
    };
    return { candidate, status, changedFields, metric };
  });
  const changed = recalculations.filter(({ status }) => status !== "unchanged");
  if (changed.length > 0)
    await database
      .insert(themeStateProjections)
      .values(changed.map(({ candidate }) => candidate))
      .onConflictDoUpdate({
        target: themeStateProjections.themeId,
        set: {
          availableFresh: sql`excluded.available_fresh`,
          availableGrace: sql`excluded.available_grace`,
          unavailable: sql`excluded.unavailable`,
          unknown: sql`excluded.unknown`,
          playableCount: sql`excluded.playable_count`,
          potentialCount: sql`excluded.potential_count`,
          activeEntryCount: sql`excluded.active_entry_count`,
          supportedModes: sql`excluded.supported_modes`,
          editorialState: sql`excluded.editorial_state`,
          visibility: sql`excluded.visibility`,
          operationalState: sql`excluded.operational_state`,
          policyVersion: sql`excluded.policy_version`,
          ruleVersion: sql`excluded.rule_version`,
          calculatedAt: sql`excluded.calculated_at`,
          thumbnailUrls: sql`excluded.thumbnail_urls`,
          nextTransitionAt: sql`excluded.next_transition_at`,
        },
      });
  return recalculations.map(({ status, changedFields, metric }) => ({
    status,
    changedFields,
    metric: { ...metric, durationMs: performance.now() - startedAt },
  }));
}

export async function recalculateThemeProjectionUsing(
  database: ProjectionDatabase,
  themeId: string,
  context = captureProjectionContext(),
  cause: "mutation" | "rebuild" = "mutation",
) {
  const [result] = await recalculateThemeProjectionsUsing(
    database,
    [themeId],
    context,
    cause,
  );
  return result;
}
