import "server-only";

import { lte, sql } from "drizzle-orm";

import { getDatabase } from "@/db";
import { rateLimitBuckets } from "@/db/schema";
import type { RateLimitStore } from "@/server/services/rate-limit";

const EXPIRED_BUCKET_CLEANUP_INTERVAL_MS = 60_000;
let nextExpiredBucketCleanupAt = 0;

export const postgresRateLimitStore: RateLimitStore = {
  async consume({ keyHash, now, windowMs }) {
    const resetAt = new Date(now.getTime() + windowMs);
    const database = getDatabase();

    if (now.getTime() >= nextExpiredBucketCleanupAt) {
      nextExpiredBucketCleanupAt =
        now.getTime() + EXPIRED_BUCKET_CLEANUP_INTERVAL_MS;
      await database
        .delete(rateLimitBuckets)
        .where(lte(rateLimitBuckets.expiresAt, now));
    }

    const [bucket] = await database
      .insert(rateLimitBuckets)
      .values({
        keyHash,
        requestCount: 1,
        expiresAt: resetAt,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: rateLimitBuckets.keyHash,
        set: {
          requestCount: sql<number>`case
            when ${rateLimitBuckets.expiresAt} <= ${now} then 1
            else least(${rateLimitBuckets.requestCount} + 1, 2147483647)
          end`,
          expiresAt: sql<Date>`case
            when ${rateLimitBuckets.expiresAt} <= ${now} then ${resetAt}
            else ${rateLimitBuckets.expiresAt}
          end`,
          updatedAt: now,
        },
      })
      .returning({
        count: rateLimitBuckets.requestCount,
        resetAt: rateLimitBuckets.expiresAt,
      });

    if (!bucket) {
      throw new Error(
        "O contador de rate limit não retornou o bucket gravado.",
      );
    }

    return bucket;
  },
};
