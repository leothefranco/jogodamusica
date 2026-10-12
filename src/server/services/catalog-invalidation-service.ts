import "server-only";
import { randomUUID } from "node:crypto";
import { sql, type SQL } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDatabase } from "@/db";
import { parseSourceHealthInvalidation } from "@/domain/music/catalog-invalidation";

type Executor = { execute(query: SQL): PromiseLike<unknown> };
type Claimed = {
  id: string;
  payload: unknown;
  createdAt: Date | string;
  attempts: number;
};
export type CatalogInvalidationMetric = {
  metric: "catalog_invalidation_delivery";
  result: "delivered" | "retry" | "disabled" | "claim_failed";
  delivered: number;
  retried: number;
  oldestAgeMs: number;
};
function record(metric: CatalogInvalidationMetric) {
  try {
    console.info("[catalog-invalidation]", metric);
  } catch {
    /* A telemetry failure cannot alter a commit. */
  }
}
async function rows<T>(database: Executor, query: SQL): Promise<T[]> {
  const result = await database.execute(query);
  return (
    Array.isArray(result) ? result : (result as { rows: T[] }).rows
  ) as T[];
}
export function createCatalogInvalidationConsumer(dependencies: {
  database(): Executor;
  clock(): Date;
  invalidatePath(path: string): Promise<void> | void;
  recordMetric?: (metric: CatalogInvalidationMetric) => void;
}) {
  const emit = (metric: CatalogInvalidationMetric) => {
    try {
      (dependencies.recordMetric ?? record)(metric);
    } catch {
      /* Keep committed health available. */
    }
  };
  return {
    async drain(limit = 50) {
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50)
        throw new Error("Invalid internal outbox batch size");
      let delivered = 0,
        retried = 0,
        oldestAgeMs = 0;
      if (process.env.CATALOG_INVALIDATION_CONSUMER_MODE === "disabled") {
        emit({
          metric: "catalog_invalidation_delivery",
          result: "disabled",
          delivered,
          retried,
          oldestAgeMs,
        });
        return { delivered, retried, oldestAgeMs };
      }
      const database = dependencies.database();
      const now = dependencies.clock(),
        token = randomUUID();
      const lease = new Date(now.getTime() + 30_000);
      let claimed: Claimed[];
      try {
        // This single statement commits the lease before any cache effect. A
        // crashed worker is recoverable, and acknowledgement is token-fenced.
        claimed = await rows<Claimed>(
          database,
          sql`
          with pending as (
            select id from public.catalog_invalidation_outbox
            where processed_at is null and available_at <= ${now.toISOString()}::timestamptz
              and (leased_until is null or leased_until <= ${now.toISOString()}::timestamptz)
            order by available_at, created_at, id for update skip locked limit ${limit}
          )
          update public.catalog_invalidation_outbox o
          set attempts = o.attempts + 1, lease_token = ${token}::uuid, leased_until = ${lease.toISOString()}::timestamptz
          from pending where o.id = pending.id
          returning o.id, o.payload, o.created_at as "createdAt", o.attempts
        `,
        );
      } catch {
        emit({
          metric: "catalog_invalidation_delivery",
          result: "claim_failed",
          delivered,
          retried: 1,
          oldestAgeMs,
        });
        return { delivered, retried: 1, oldestAgeMs };
      }
      for (const item of claimed) {
        oldestAgeMs = Math.max(
          oldestAgeMs,
          Math.max(0, now.getTime() - new Date(item.createdAt).getTime()),
        );
        try {
          const payload = parseSourceHealthInvalidation(item.payload);
          for (const path of payload.paths)
            await dependencies.invalidatePath(path);
          const acknowledged = await rows(
            database,
            sql`
            update public.catalog_invalidation_outbox
            set processed_at = ${dependencies.clock().toISOString()}::timestamptz, lease_token = null, leased_until = null
            where id = ${item.id}::uuid and lease_token = ${token}::uuid and processed_at is null returning id
          `,
          );
          if (acknowledged.length > 0) delivered++;
        } catch {
          retried++;
          const retryAt = new Date(
            dependencies.clock().getTime() +
              Math.min(60_000, 1000 * 2 ** Math.min(item.attempts - 1, 6)),
          );
          try {
            await database.execute(sql`
              update public.catalog_invalidation_outbox
              set available_at = ${retryAt.toISOString()}::timestamptz, lease_token = null, leased_until = null
              where id = ${item.id}::uuid and lease_token = ${token}::uuid and processed_at is null
            `);
          } catch {
            /* The expired lease remains retryable if the database is unavailable. */
          }
        }
      }
      emit({
        metric: "catalog_invalidation_delivery",
        result: retried ? "retry" : "delivered",
        delivered,
        retried,
        oldestAgeMs,
      });
      return { delivered, retried, oldestAgeMs };
    },
  };
}
const consumer = createCatalogInvalidationConsumer({
  database: getDatabase,
  clock: () => new Date(),
  invalidatePath: revalidatePath,
});
export const drainCatalogInvalidations = () => consumer.drain();
