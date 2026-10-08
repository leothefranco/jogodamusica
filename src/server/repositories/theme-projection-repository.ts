import "server-only";

import { eq } from "drizzle-orm";
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

// Caller supplies its domain transaction. Lock the parent before reading derived
// state, so absent-row creation and repeated upserts serialize on the same key.
export async function recalculateThemeProjectionUsing(
  database: ProjectionDatabase,
  themeId: string,
  context = captureProjectionContext(),
  cause: "mutation" | "rebuild" = "mutation",
) {
  const startedAt = performance.now();
  const [locked] = await database
    .select({ id: themes.id })
    .from(themes)
    .where(eq(themes.id, themeId))
    .for("update");
  if (!locked)
    throw new AppError("THEME_NOT_FOUND", "Tema não encontrado.", 404);
  const [base] = await createAuthoritativePublicThemeRepository(
    database,
  ).queryThemes({ ...context, themeIds: [themeId] });
  if (!base) throw new AppError("THEME_NOT_FOUND", "Tema não encontrado.", 404);
  const candidate = {
    themeId,
    ...deriveThemeProjection({
      editorialState: base.editorialState,
      counts: base.counts,
      now: context.now,
      policyVersion: context.policy.version,
    }),
    thumbnailUrls: base.thumbnailUrls,
    nextTransitionAt: base.nextTransitionAt ?? null,
  };
  const [before] = await database
    .select()
    .from(themeStateProjections)
    .where(eq(themeStateProjections.themeId, themeId))
    .for("update");
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
  if (status !== "unchanged") {
    await database
      .insert(themeStateProjections)
      .values(candidate)
      .onConflictDoUpdate({
        target: themeStateProjections.themeId,
        set: candidate,
      });
  }
  const metric: ThemeProjectionMetric = {
    metric: "theme_projection_recalculation",
    result: status,
    durationMs: performance.now() - startedAt,
    changedFieldCount: changedFields.length,
    driftCorrected: cause === "rebuild" && status === "corrected",
    ruleVersion: candidate.ruleVersion,
    policyVersion: candidate.policyVersion,
  };
  return { status, changedFields, metric };
}
