import "server-only";

import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import {
  songs,
  sourceAvailabilityObservations as observations,
  themes,
  themeSongs,
} from "@/db/schema";
import type { SOURCE_AVAILABILITY_POLICY } from "@/domain/music/source-availability";
import type {
  ThemeAvailabilityCounts,
  ThemeEditorialState,
} from "@/domain/music/theme-state";
import type { PlayableThemeRecord } from "@/server/repositories/public-theme-repository";

export const PUBLIC_CATALOG_PAGE_SIZE = 200;

export type AuthoritativeThemeRecord = Omit<
  PlayableThemeRecord,
  "activeSongCount"
> & {
  editorialState: ThemeEditorialState;
  counts: ThemeAvailabilityCounts;
};
export type PublicCatalogQuery = {
  now: Date;
  policy: typeof SOURCE_AVAILABILITY_POLICY;
  slug?: string;
  page?: number;
};

export function createAuthoritativePublicThemeRepository(
  database: Pick<PgDatabase<PgQueryResultHKT>, "select">,
) {
  return {
    async queryThemes(
      query: PublicCatalogQuery,
    ): Promise<AuthoritativeThemeRecord[]> {
      const catalogWindow = database
        .select({ id: themes.id })
        .from(themes)
        .where(
          query.slug === undefined
            ? eq(themes.editorialState, "published")
            : eq(themes.slug, query.slug),
        )
        .orderBy(asc(themes.name), asc(themes.id))
        .limit(query.slug === undefined ? PUBLIC_CATALOG_PAGE_SIZE + 1 : 1)
        .offset(
          query.slug === undefined
            ? ((query.page ?? 1) - 1) * PUBLIC_CATALOG_PAGE_SIZE
            : 0,
        );
      // SQL adapter for CAT-03: inclusive validity boundaries, never isEmbeddable.
      const instant = query.now.toISOString();
      const state = sql`case
        when ${observations.confirmedState} = 'unavailable' then 'unavailable'
        when ${observations.confirmedState} = 'available' and ${observations.validUntil} >= ${instant}::timestamptz then 'available_fresh'
        when ${observations.confirmedState} = 'available' and ${observations.graceUntil} >= ${instant}::timestamptz then 'available_grace'
        else 'unknown' end`;
      const countState = (value: string) =>
        sql<number>`count(${themeSongs.songId}) filter (where ${state} = ${value})`.mapWith(
          Number,
        );
      return database
        .select({
          id: themes.id,
          name: themes.name,
          slug: themes.slug,
          description: themes.description,
          coverUrl: themes.coverUrl,
          editorialState: themes.editorialState,
          counts: {
            availableFresh: countState("available_fresh"),
            availableGrace: countState("available_grace"),
            unavailable: countState("unavailable"),
            unknown: countState("unknown"),
          },
          thumbnailUrls: sql<string[]>`coalesce((array_agg(${songs.thumbnailUrl}
          order by ${themeSongs.displayOrder} asc nulls last, ${themeSongs.createdAt} asc, ${themeSongs.songId} asc)
          filter (where ${state} in ('available_fresh', 'available_grace')))[1:4], array[]::text[])`,
        })
        .from(themes)
        .leftJoin(
          themeSongs,
          and(eq(themeSongs.themeId, themes.id), eq(themeSongs.isActive, true)),
        )
        .leftJoin(songs, eq(songs.id, themeSongs.songId))
        .leftJoin(
          observations,
          and(
            eq(observations.songId, themeSongs.songId),
            eq(observations.region, query.policy.region),
          ),
        )
        .where(inArray(themes.id, catalogWindow))
        .groupBy(themes.id)
        .orderBy(asc(themes.name), asc(themes.id));
    },
  };
}
