import "server-only";

import { connection } from "next/server";
import { cache } from "react";
import { getDatabase } from "@/db";
import { SOURCE_AVAILABILITY_POLICY } from "@/domain/music/source-availability";
import {
  classifyThemeState,
  type ThemeOperationalState,
} from "@/domain/music/theme-state";
import {
  createAuthoritativePublicThemeRepository,
  PUBLIC_CATALOG_PAGE_SIZE,
  type AuthoritativeThemeRecord,
  type PublicCatalogQuery,
} from "@/server/repositories/authoritative-public-theme-repository";
import { AppError } from "@/lib/errors";

import {
  getSupportedBracketSizes,
  minimumPlayableSongCount,
  type BracketSize,
} from "@/domain/music/content-validation";
import {
  findPlayableThemeBySlug,
  listPlayableThemes,
  type PlayableThemeRecord,
} from "@/server/repositories/public-theme-repository";

export type PublicTheme = PlayableThemeRecord & {
  supportedBracketSizes: BracketSize[];
  modeGroups?: {
    primary: BracketSize[];
    quick: BracketSize[];
    extended: BracketSize[];
  };
};

export type PublicCatalogReadMetric = {
  metric: "public_catalog_read";
  mode: "legacy_guardrail" | "authoritative_direct";
  policyVersion: typeof SOURCE_AVAILABILITY_POLICY.version;
  durationMs: number;
  examinedThemes: number;
  visibleThemes: number;
  states: Record<ThemeOperationalState, number> | null;
};
type PublicCatalogMetrics = { record(event: PublicCatalogReadMetric): void };
export type PublicCatalogPage = {
  themes: PublicTheme[];
  nextPage: number | null;
};
export function parsePublicCatalogPage(value: unknown = "1"): number {
  if (
    (typeof value !== "string" && typeof value !== "number") ||
    !/^[1-9]\d*$/.test(String(value)) ||
    !Number.isSafeInteger(Number(value) * PUBLIC_CATALOG_PAGE_SIZE)
  ) {
    throw new AppError(
      "INVALID_CATALOG_PAGE",
      "Página de catálogo inválida.",
      400,
    );
  }
  return Number(value);
}
function recordMetric(
  metrics: PublicCatalogMetrics | undefined,
  event: PublicCatalogReadMetric,
) {
  try {
    metrics?.record(event);
  } catch {
    /* Telemetry must not make discovery unavailable. */
  }
}

type PublicThemeServiceDependencies = {
  listPlayableThemes(): Promise<PlayableThemeRecord[]>;
  findPlayableThemeBySlug(slug: string): Promise<PlayableThemeRecord | null>;
  metrics?: PublicCatalogMetrics;
};

function presentTheme(theme: PlayableThemeRecord): PublicTheme {
  const supportedBracketSizes = getSupportedBracketSizes(theme.activeSongCount);
  return {
    id: theme.id,
    name: theme.name,
    slug: theme.slug,
    description: theme.description,
    coverUrl: theme.coverUrl,
    thumbnailUrls: theme.thumbnailUrls,
    activeSongCount: theme.activeSongCount,
    supportedBracketSizes,
  };
}

function isPlayableTheme(theme: PlayableThemeRecord) {
  return theme.activeSongCount >= minimumPlayableSongCount;
}

export function createPublicThemeService(
  dependencies: PublicThemeServiceDependencies,
) {
  async function read(slug?: string) {
    const startedAt = performance.now();
    const rows =
      slug === undefined
        ? await dependencies.listPlayableThemes()
        : [await dependencies.findPlayableThemeBySlug(slug)].filter(
            (row): row is PlayableThemeRecord => row !== null,
          );
    const visible = rows.filter(isPlayableTheme).map(presentTheme);
    recordMetric(dependencies.metrics, {
      metric: "public_catalog_read",
      mode: "legacy_guardrail",
      policyVersion: SOURCE_AVAILABILITY_POLICY.version,
      durationMs: performance.now() - startedAt,
      examinedThemes: rows.length,
      visibleThemes: visible.length,
      states: null,
    });
    return visible;
  }
  return {
    async listPage(): Promise<PublicCatalogPage> {
      return { themes: await read(), nextPage: null };
    },
    async listThemes(): Promise<PublicTheme[]> {
      return read();
    },
    async getTheme(slug: string): Promise<PublicTheme | null> {
      return (await read(slug))[0] ?? null;
    },
  };
}

export function createAuthoritativePublicThemeService(dependencies: {
  queryThemes(query: PublicCatalogQuery): Promise<AuthoritativeThemeRecord[]>;
  clock(): Date;
  metrics?: PublicCatalogMetrics;
}) {
  async function read(slug?: string, page = 1): Promise<PublicCatalogPage> {
    parsePublicCatalogPage(page);
    const startedAt = performance.now();
    const states: Record<ThemeOperationalState, number> = {
      editorial_draft: 0,
      healthy: 0,
      degraded: 0,
      suspended_pending_verification: 0,
      suspended_insufficient_healthy_entries: 0,
    };
    const result = await dependencies.queryThemes({
      now: dependencies.clock(),
      policy: SOURCE_AVAILABILITY_POLICY,
      slug,
      page,
    });
    const rows = result.slice(0, PUBLIC_CATALOG_PAGE_SIZE);
    const visible = rows.flatMap((row) => {
      const state = classifyThemeState(row);
      states[state.operationalState] += 1;
      if (state.visibility !== "visible") return [];
      return [
        {
          id: row.id,
          name: row.name,
          slug: row.slug,
          description: row.description,
          coverUrl: row.coverUrl,
          thumbnailUrls: row.thumbnailUrls,
          activeSongCount: state.counts.playableCount,
          supportedBracketSizes: [
            ...state.modes.quick,
            ...state.modes.primary,
            ...state.modes.extended,
          ],
          modeGroups: state.modes,
        },
      ];
    });
    recordMetric(dependencies.metrics, {
      metric: "public_catalog_read",
      mode: "authoritative_direct",
      policyVersion: SOURCE_AVAILABILITY_POLICY.version,
      durationMs: performance.now() - startedAt,
      examinedThemes: rows.length,
      visibleThemes: visible.length,
      states,
    });
    return {
      themes: visible,
      nextPage:
        slug === undefined && result.length > PUBLIC_CATALOG_PAGE_SIZE
          ? page + 1
          : null,
    };
  }
  return {
    listPage: (page = 1) => read(undefined, page),
    listThemes: async () => (await read()).themes,
    getTheme: async (slug: string) => (await read(slug)).themes[0] ?? null,
  };
}

const publicThemeService = createPublicThemeService({
  listPlayableThemes,
  findPlayableThemeBySlug,
  metrics: {
    record(event) {
      console.info("[public-catalog]", event);
    },
  },
});

function currentService() {
  // CAT-12 owns the production cutover. Unknown/missing settings stay legacy.
  const isQa =
    process.env.VERCEL_ENV === "preview" ||
    (process.env.VERCEL_ENV !== "production" &&
      process.env.NODE_ENV !== "production");
  if (isQa && process.env.PUBLIC_CATALOG_READ_MODE === "authoritative_direct") {
    return createAuthoritativePublicThemeService({
      ...createAuthoritativePublicThemeRepository(getDatabase()),
      clock: () => new Date(),
      metrics: {
        record(event) {
          console.info("[public-catalog]", event);
        },
      },
    });
  }
  return publicThemeService;
}

export const getPublicThemes = cache(async () => {
  await connection();
  return currentService().listThemes();
});
export const getPublicCatalogPage = cache(async (page = 1) => {
  parsePublicCatalogPage(page);
  await connection();
  return currentService().listPage(page);
});
export const getPublicTheme = cache(async (slug: string) => {
  await connection();
  return currentService().getTheme(slug);
});
