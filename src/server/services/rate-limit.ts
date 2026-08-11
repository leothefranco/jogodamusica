import "server-only";

import { createHmac } from "node:crypto";

import { ipAddress } from "@vercel/functions";

import { AppError } from "@/lib/errors";
import { getRateLimitEnv } from "@/lib/env";
import { postgresRateLimitStore } from "@/server/repositories/rate-limit-repository";

export type RateLimitStore = {
  consume(input: {
    keyHash: string;
    now: Date;
    windowMs: number;
  }): Promise<{ count: number; resetAt: Date }>;
};

export function createRateLimiter(dependencies: {
  keySecret: string;
  now: () => Date;
  store: RateLimitStore;
}) {
  return async function enforceRateLimit(
    key: string,
    options: { limit: number; windowMs: number },
  ) {
    const now = dependencies.now();
    const keyHash = createHmac("sha256", dependencies.keySecret)
      .update(key)
      .digest("hex");
    const bucket = await dependencies.store.consume({
      keyHash,
      now,
      windowMs: options.windowMs,
    });

    if (bucket.count <= options.limit) return;

    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((bucket.resetAt.getTime() - now.getTime()) / 1_000),
    );
    throw new AppError(
      "RATE_LIMITED",
      "Muitas consultas em pouco tempo. Aguarde e tente novamente mais tarde.",
      429,
      null,
      { "Retry-After": String(retryAfterSeconds) },
    );
  };
}

let defaultRateLimiter: ReturnType<typeof createRateLimiter> | undefined;

export async function enforceRateLimit(
  key: string,
  options: { limit: number; windowMs: number },
) {
  defaultRateLimiter ??= createRateLimiter({
    keySecret: getRateLimitEnv().RATE_LIMIT_KEY_SECRET,
    now: () => new Date(),
    store: postgresRateLimitStore,
  });

  await defaultRateLimiter(key, options);
}

export async function enforcePublicRateLimit(
  request: Request,
  scope: string,
  options: { limit: number; windowMs: number },
  resource?: string,
) {
  const clientIp = ipAddress(request) ?? "unknown";
  const key = ["public", scope, clientIp, resource]
    .filter((part): part is string => Boolean(part))
    .join(":");

  await enforceRateLimit(key, options);
}
