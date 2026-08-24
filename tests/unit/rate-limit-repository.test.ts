import { drizzle } from "drizzle-orm/postgres-js";
import { describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import { buildRateLimitBucketUpsert } from "@/server/repositories/rate-limit-repository";

describe("repositório de rate limit", () => {
  it("codifica datas dos fragmentos SQL antes de enviá-las ao Postgres", () => {
    const database = drizzle.mock({ schema });
    const now = new Date("2026-08-24T23:00:00.000Z");
    const resetAt = new Date("2026-08-24T23:10:00.000Z");

    const query = buildRateLimitBucketUpsert(database, {
      keyHash: "a".repeat(64),
      now,
      resetAt,
    }).toSQL();

    expect(query.params).not.toContain(now);
    expect(query.params).not.toContain(resetAt);
    expect(query.params).toContain(now.toISOString());
    expect(query.params).toContain(resetAt.toISOString());
  });
});
