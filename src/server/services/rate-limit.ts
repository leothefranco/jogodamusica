import { AppError } from "@/lib/errors";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const entries = new Map<string, RateLimitEntry>();

export function enforceRateLimit(
  key: string,
  options: { limit: number; windowMs: number },
) {
  const now = Date.now();
  const current = entries.get(key);

  if (!current || current.resetAt <= now) {
    entries.set(key, { count: 1, resetAt: now + options.windowMs });
    return;
  }

  if (current.count >= options.limit) {
    throw new AppError(
      "RATE_LIMITED",
      "Muitas consultas em pouco tempo. Aguarde e tente novamente mais tarde.",
      429,
    );
  }

  current.count += 1;
}
