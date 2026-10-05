import "server-only";

import { createHash } from "node:crypto";
import { sql, type SQL } from "drizzle-orm";
import { AppError } from "@/lib/errors";

type Executor = { execute(query: SQL): PromiseLike<unknown> };
export class CatalogDependenciesChanged extends Error {}

// Only definite transaction-abort SQLSTATEs are retried. Connection/commit
// ambiguity is never retried: the caller may already have a committed session.
function retryable(error: unknown, depth = 0): boolean {
  if (error instanceof CatalogDependenciesChanged) return true;
  if (!error || typeof error !== "object" || depth > 3) return false;
  if (
    "code" in error &&
    ["55P03", "40P01", "40001"].includes(String(error.code))
  )
    return true;
  return "cause" in error && retryable(error.cause, depth + 1);
}
export async function retryCatalogTransaction<T>(
  operation: () => Promise<T>,
  onRetry?: () => void,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!retryable(error)) throw error;
      if (attempt === 2)
        throw new AppError(
          "CATALOG_BUSY",
          "O catálogo está sendo atualizado. Tente novamente.",
          409,
        );
      try {
        onRetry?.();
      } catch {
        /* Metrics cannot alter transaction outcomes. */
      }
    }
  }
}
async function rows<T>(database: Executor, query: SQL): Promise<T[]> {
  const result = await database.execute(query);
  // postgres-js returns an array; the disposable PGlite adapter returns rows.
  return (
    Array.isArray(result) ? result : (result as { rows: T[] }).rows
  ) as T[];
}
export async function configureCatalogTransaction(database: Executor) {
  await database.execute(sql`set local lock_timeout = '2000ms'`);
}
export async function lockCatalogThemes(
  database: Executor,
  themeIds: string[],
) {
  for (const id of [...new Set(themeIds)].sort()) {
    await database.execute(
      sql`select id from public.themes where id = ${id}::uuid for update`,
    );
  }
}
export async function lockCatalogSources(
  database: Executor,
  providerContentIds: string[],
  region: string,
) {
  // Global source order is provider_content_id (the current provider is YouTube).
  // Each identity also covers missing observation/source rows during first insert.
  for (const id of [...new Set(providerContentIds)].sort()) {
    const hash = createHash("sha256")
      .update(`youtube:${id}`, "utf8")
      .digest("hex");
    await database.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`${hash}:${region}`}, 0))`,
    );
    await database.execute(
      sql`select id from public.songs where provider = 'youtube' and provider_content_id = ${id} for update`,
    );
    await database.execute(
      sql`select o.song_id from public.source_availability_observations o inner join public.songs s on s.id = o.song_id where s.provider = 'youtube' and s.provider_content_id = ${id} and o.region = ${region} for update of o`,
    );
  }
}
async function themeSources(database: Executor, themeId: string) {
  return rows<{ id: string }>(
    database,
    sql`select s.provider_content_id as id from public.theme_songs e inner join public.songs s on s.id = e.song_id where e.theme_id = ${themeId}::uuid order by s.provider_content_id`,
  );
}
async function sourceThemes(database: Executor, providerContentId: string) {
  return rows<{ id: string }>(
    database,
    sql`select e.theme_id as id from public.theme_songs e inner join public.songs s on s.id = e.song_id where s.provider = 'youtube' and s.provider_content_id = ${providerContentId} order by e.theme_id`,
  );
}
function assertSameDependencies(
  before: { id: string }[],
  after: { id: string }[],
) {
  if (JSON.stringify(before) !== JSON.stringify(after))
    throw new CatalogDependenciesChanged();
}
export async function coordinateGameCreation(
  database: Executor,
  themeId: string,
  region: string,
) {
  await configureCatalogTransaction(database);
  await lockCatalogThemes(database, [themeId]);
  const before = await themeSources(database, themeId);
  await lockCatalogSources(
    database,
    before.map(({ id }) => id),
    region,
  );
  assertSameDependencies(before, await themeSources(database, themeId));
}
export async function coordinateSourceHealth(
  database: Executor,
  providerContentId: string,
  region: string,
) {
  await configureCatalogTransaction(database);
  const before = await sourceThemes(database, providerContentId);
  await lockCatalogThemes(
    database,
    before.map(({ id }) => id),
  );
  await lockCatalogSources(database, [providerContentId], region);
  // A newly associated Tema requires restarting, never taking a Tema lock after
  // a Fonte lock. Deletions/reassociations are equally rechecked.
  const recheck = async () =>
    assertSameDependencies(
      before,
      await sourceThemes(database, providerContentId),
    );
  await recheck();
  return recheck;
}
