import type { PgliteDatabase } from "drizzle-orm/pglite";
import type * as schema from "@/db/schema";

// Exercise the production postgres-js raw-result boundary against disposable SQL.
// Query builders, transactions and rollback remain the real Drizzle/PGlite ones.
export function postgresRowsAdapter<T extends object>(database: T): T {
  return new Proxy(database, {
    get(target, key, receiver) {
      const source: object = target;
      if (key === "execute")
        return async (...args: unknown[]) => {
          const result = await Reflect.get(source, key).apply(target, args);
          return result.rows;
        };
      if (key === "transaction")
        return (
          operation: (tx: PgliteDatabase<typeof schema>) => Promise<unknown>,
        ) =>
          Reflect.get(source, key).call(
            target,
            (tx: PgliteDatabase<typeof schema>) =>
              operation(postgresRowsAdapter(tx)),
          );
      return Reflect.get(target, key, receiver);
    },
  });
}
