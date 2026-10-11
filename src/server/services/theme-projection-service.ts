import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDatabase } from "@/db";
import { adminProfiles, themes } from "@/db/schema";
import { requireAdmin } from "@/server/auth/session";
import type { AdminUser } from "@/server/auth/authorization";
import { AppError } from "@/lib/errors";
import {
  captureProjectionContext,
  recalculateThemeProjectionUsing,
  recordThemeProjectionMetric,
} from "@/server/repositories/theme-projection-repository";

export async function rebuildThemeProjectionRecord(
  themeId: string,
  actorId: string,
) {
  const context = captureProjectionContext();
  const result = await getDatabase().transaction(async (tx) => {
    const [theme] = await tx
      .select({ id: themes.id })
      .from(themes)
      .where(eq(themes.id, themeId))
      .for("update");
    if (!theme)
      throw new AppError("THEME_NOT_FOUND", "Tema não encontrado.", 404);
    const [actor] = await tx
      .select({ userId: adminProfiles.userId })
      .from(adminProfiles)
      .where(
        and(
          eq(adminProfiles.userId, actorId),
          eq(adminProfiles.isActive, true),
        ),
      )
      .for("share", { noWait: true });
    if (!actor)
      throw new AppError(
        "THEME_PROJECTION_REBUILD_FORBIDDEN",
        "Uma sessão administrativa ativa é necessária para reconstruir a projeção.",
        403,
      );
    return recalculateThemeProjectionUsing(tx, themeId, context, "rebuild");
  });
  recordThemeProjectionMetric(result.metric);
  return { status: result.status, changedFields: result.changedFields };
}

export function createThemeProjectionRebuildService(dependencies: {
  authorize(): Promise<AdminUser>;
  rebuild(
    themeId: string,
    actorId: string,
  ): ReturnType<typeof rebuildThemeProjectionRecord>;
}) {
  return async function rebuild(input: unknown) {
    // Strict input rejects counters/modes/versions rather than trusting derived
    // values even when the caller has an administrative session.
    const actor = await dependencies.authorize();
    const parsed = z.strictObject({ themeId: z.uuid() }).safeParse(input);
    if (!parsed.success)
      throw new AppError(
        "INVALID_REQUEST",
        "Envie apenas o identificador do Tema.",
        400,
      );
    return dependencies.rebuild(parsed.data.themeId, actor.userId);
  };
}

export const rebuildThemeProjection = createThemeProjectionRebuildService({
  authorize: requireAdmin,
  rebuild: rebuildThemeProjectionRecord,
});
