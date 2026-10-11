import "server-only";

import { asc, eq, inArray } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { themes, themeStateProjections } from "@/db/schema";
import {
  deriveThemeProjection,
  changedProjectionFields,
} from "@/domain/music/theme-projection";
import {
  createAuthoritativePublicThemeRepository,
  PUBLIC_CATALOG_PAGE_SIZE,
  type AuthoritativeThemeRecord,
  type PublicCatalogQuery,
} from "@/server/repositories/authoritative-public-theme-repository";
import { themeProjectionWritesEnabled } from "@/server/repositories/theme-projection-repository";

export function createProjectedPublicThemeRepository(
  database: Pick<PgDatabase<PgQueryResultHKT>, "select">,
) {
  const direct = createAuthoritativePublicThemeRepository(database);
  return {
    async queryThemes(
      query: PublicCatalogQuery,
    ): Promise<AuthoritativeThemeRecord[]> {
      // Turning off the projector also makes projected QA reads fall back to the
      // authoritative query. Never fall back to the legacy boolean classifier.
      if (!themeProjectionWritesEnabled()) return direct.queryThemes(query);
      const window = database
        .select({ id: themes.id })
        .from(themes)
        .where(
          query.themeIds !== undefined
            ? inArray(themes.id, query.themeIds)
            : query.slug === undefined
              ? eq(themes.editorialState, "published")
              : eq(themes.slug, query.slug),
        )
        .orderBy(asc(themes.name), asc(themes.id))
        .limit(
          query.themeIds?.length ??
            (query.slug === undefined ? PUBLIC_CATALOG_PAGE_SIZE + 1 : 1),
        )
        .offset(
          query.themeIds === undefined && query.slug === undefined
            ? ((query.page ?? 1) - 1) * PUBLIC_CATALOG_PAGE_SIZE
            : 0,
        );
      const rows = await database
        .select({
          id: themes.id,
          name: themes.name,
          slug: themes.slug,
          description: themes.description,
          coverUrl: themes.coverUrl,
          editorialState: themes.editorialState,
          projection: themeStateProjections,
        })
        .from(themes)
        .leftJoin(
          themeStateProjections,
          eq(themeStateProjections.themeId, themes.id),
        )
        .where(inArray(themes.id, window))
        .orderBy(asc(themes.name), asc(themes.id));
      const fallbackIds: string[] = [];
      const accepted = new Map<string, AuthoritativeThemeRecord>();
      for (const row of rows) {
        const projection = row.projection;
        if (
          !projection ||
          projection.policyVersion !== query.policy.version ||
          projection.calculatedAt > query.now ||
          (projection.nextTransitionAt !== null &&
            query.now > projection.nextTransitionAt)
        ) {
          fallbackIds.push(row.id);
          continue;
        }
        const counts = {
          availableFresh: projection.availableFresh,
          availableGrace: projection.availableGrace,
          unavailable: projection.unavailable,
          unknown: projection.unknown,
        };
        const expected = deriveThemeProjection({
          editorialState: row.editorialState,
          counts,
          now: query.now,
          policyVersion: query.policy.version,
        });
        if (changedProjectionFields(projection, expected).length > 0) {
          fallbackIds.push(row.id);
          continue;
        }
        accepted.set(row.id, {
          id: row.id,
          name: row.name,
          slug: row.slug,
          description: row.description,
          coverUrl: row.coverUrl,
          editorialState: row.editorialState,
          counts,
          thumbnailUrls: projection.thumbnailUrls,
        });
      }
      if (fallbackIds.length > 0) {
        for (const row of await direct.queryThemes({
          now: query.now,
          policy: query.policy,
          themeIds: fallbackIds,
        }))
          accepted.set(row.id, row);
      }
      // Missing records use one set-based fallback, retaining the exact CAT-05
      // catalog window/order/continuation semantics instead of filling holes.
      return rows.flatMap((row) => {
        const result = accepted.get(row.id);
        return result ? [result] : [];
      });
    },
  };
}
