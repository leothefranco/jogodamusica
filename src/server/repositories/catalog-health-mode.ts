import "server-only";
import { isCatalogTransactionAbort } from "@/server/repositories/catalog-transaction";
import { sql, type SQL } from "drizzle-orm";
import { AppError } from "@/lib/errors";

export type CatalogHealthWriteMode = "legacy" | "enabled";
type Executor = { execute(query: SQL): PromiseLike<unknown> };
function busy(): never {
  throw new AppError(
    "CATALOG_BUSY",
    "O catálogo está sendo atualizado. Tente novamente.",
    409,
  );
}
export function catalogHealthWriteMode(): CatalogHealthWriteMode {
  const configured = process.env.CATALOG_GLOBAL_HEALTH_WRITE_MODE;
  if (configured === undefined) return "legacy";
  if (configured !== "enabled") return busy();
  const qa =
    process.env.VERCEL_ENV === "preview" ||
    (process.env.VERCEL_ENV !== "production" &&
      process.env.NODE_ENV !== "production");
  if (
    !qa ||
    !["authoritative_direct", "authoritative_projected"].includes(
      process.env.PUBLIC_CATALOG_READ_MODE ?? "",
    )
  )
    return busy();
  if (
    process.env.PUBLIC_CATALOG_READ_MODE === "authoritative_projected" &&
    process.env.THEME_PROJECTION_WRITE_MODE !== "enabled"
  )
    return busy();
  return "enabled";
}
async function rows<T>(database: Executor, query: SQL): Promise<T[]> {
  const result = await database.execute(query);
  return (
    Array.isArray(result) ? result : (result as { rows: T[] }).rows
  ) as T[];
}
async function checkCatalogHealthWriteAllowed(
  database: Executor,
  options: {
    transaction?: boolean;
    expectedMode?: CatalogHealthWriteMode;
  } = {},
): Promise<CatalogHealthWriteMode> {
  const mode = catalogHealthWriteMode();
  // The activation barrier precedes Theme/Source locks and shares their bound.
  if (options.transaction)
    await database.execute(sql`set local lock_timeout = '2000ms'`);
  if (options.expectedMode && mode !== options.expectedMode) return busy();
  const [schema] = await rows<{
    activation: string | null;
    outbox: string | null;
  }>(
    database,
    sql`
    select to_regclass('public.catalog_global_health_activation')::text as activation,
           to_regclass('public.catalog_invalidation_outbox')::text as outbox
  `,
  );
  if (!schema?.activation || !schema.outbox) {
    if (mode === "enabled" || schema?.activation || schema?.outbox)
      return busy();
    return "legacy";
  }
  const [security] = await rows<{ count: number }>(
    database,
    sql`
    select count(*)::int as count from pg_class c
    where c.oid in (to_regclass('public.catalog_global_health_activation'), to_regclass('public.catalog_invalidation_outbox'))
      and c.relrowsecurity and c.relforcerowsecurity
      and not has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      and not has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)
  `,
  );
  if (security?.count !== 2) return busy();
  const active = async () =>
    (
      await rows<{ singleton: boolean }>(
        database,
        sql`select singleton from public.catalog_global_health_activation where singleton = true`,
      )
    ).length > 0;
  if (await active()) {
    if (mode === "legacy") return busy();
    return mode;
  }
  if (options.transaction) {
    // Only the first activation needs an exclusive barrier. Legacy operations
    // hold a shared barrier before parent/source locks so activation cannot race
    // an already-started compatibility write. Active global writers avoid it.
    if (mode === "enabled")
      await database.execute(
        sql`select pg_advisory_xact_lock(hashtextextended('catalog-global-health-activation', 0))`,
      );
    else
      await database.execute(
        sql`select pg_advisory_xact_lock_shared(hashtextextended('catalog-global-health-activation', 0))`,
      );
    if (mode === "legacy" && (await active())) return busy();
  }
  return mode;
}

export async function assertCatalogHealthWriteAllowed(
  database: Executor,
  options: {
    transaction?: boolean;
    expectedMode?: CatalogHealthWriteMode;
  } = {},
): Promise<CatalogHealthWriteMode> {
  try {
    return await checkCatalogHealthWriteAllowed(database, options);
  } catch (error) {
    // Definite transactional aborts belong to the coordinator's bounded retry.
    // Configuration, unreadable schema and ambiguous failures stay fail closed.
    if (options.transaction && isCatalogTransactionAbort(error)) throw error;
    return busy();
  }
}
