import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { assertCatalogHealthWriteAllowed } from "@/server/repositories/catalog-health-mode";
import { retryCatalogTransaction } from "@/server/repositories/catalog-transaction";

beforeEach(() => {
  vi.stubEnv("CATALOG_GLOBAL_HEALTH_WRITE_MODE", "enabled");
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("PUBLIC_CATALOG_READ_MODE", "authoritative_direct");
});
afterEach(() => vi.unstubAllEnvs());

function abortingDriver(code: string, failures: number, nested = false) {
  let remaining = failures;
  let transactionAttempts = 0;
  const dialect = new PgDialect();
  const driver = {
    async execute(query: SQL) {
      const statement = dialect.sqlToQuery(query).sql;
      if (statement.includes("set local lock_timeout"))
        transactionAttempts += 1;
      if (statement.includes("pg_advisory_xact_lock")) {
        if (remaining-- > 0) {
          const abort = Object.assign(new Error("Controlled driver abort"), {
            code,
          });
          throw nested ? new Error("Driver wrapper", { cause: abort }) : abort;
        }
        return [];
      }
      if (
        statement.includes(
          "to_regclass('public.catalog_global_health_activation')::text",
        )
      )
        return [
          {
            activation: "catalog_global_health_activation",
            outbox: "catalog_invalidation_outbox",
          },
        ];
      if (statement.includes("from pg_class c")) return [{ count: 2 }];
      if (statement.includes("select singleton")) return [];
      if (statement.includes("set local lock_timeout")) return [];
      throw new Error("Unexpected SQL guard operation");
    },
  };
  return { driver, attempts: () => transactionAttempts };
}

it.each(["55P03", "40P01", "40001"])(
  "aborto definitivo %s do guard chega ao coordenador e permite retry",
  async (code) => {
    const { driver, attempts } = abortingDriver(code, 1, true);
    const onRetry = vi.fn();
    expect(
      await retryCatalogTransaction(
        () => assertCatalogHealthWriteAllowed(driver, { transaction: true }),
        onRetry,
      ),
    ).toBe("enabled");
    expect(attempts()).toBe(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
  },
);

it.each(["55P03", "40P01", "40001"])(
  "disputa persistente %s respeita três tentativas e recusa integral",
  async (code) => {
    const { driver, attempts } = abortingDriver(code, 10);
    const onRetry = vi.fn();
    await expect(
      retryCatalogTransaction(
        () => assertCatalogHealthWriteAllowed(driver, { transaction: true }),
        onRetry,
      ),
    ).rejects.toMatchObject({ code: "CATALOG_BUSY", status: 409 });
    expect(attempts()).toBe(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
  },
);

it("falha ambígua e schema inseguro continuam fail closed sem retry", async () => {
  const ambiguous = abortingDriver("08006", 10);
  const retry = vi.fn();
  await expect(
    retryCatalogTransaction(
      () =>
        assertCatalogHealthWriteAllowed(ambiguous.driver, {
          transaction: true,
        }),
      retry,
    ),
  ).rejects.toMatchObject({ code: "CATALOG_BUSY" });
  expect(ambiguous.attempts()).toBe(1);
  expect(retry).not.toHaveBeenCalled();
  await expect(
    assertCatalogHealthWriteAllowed(
      { execute: async () => [] },
      { transaction: true },
    ),
  ).rejects.toMatchObject({ code: "CATALOG_BUSY" });
});
