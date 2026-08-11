import { describe, expect, it, vi } from "vitest";

import { errorResponse } from "@/lib/errors";
import {
  createRateLimiter,
  type RateLimitStore,
} from "@/server/services/rate-limit";

describe("limite de requisições", () => {
  it("bloqueia acima do limite sem entregar o identificador bruto ao adapter", async () => {
    const consume = vi
      .fn<RateLimitStore["consume"]>()
      .mockResolvedValueOnce({ count: 1, resetAt: new Date(70_000) })
      .mockResolvedValueOnce({ count: 2, resetAt: new Date(70_000) })
      .mockResolvedValueOnce({ count: 3, resetAt: new Date(70_000) });
    const enforce = createRateLimiter({
      keySecret: "segredo-de-teste-com-pelo-menos-32-caracteres",
      now: () => new Date(10_000),
      store: { consume },
    });

    await expect(
      enforce("criar-partida:203.0.113.10", {
        limit: 2,
        windowMs: 60_000,
      }),
    ).resolves.toBeUndefined();
    await expect(
      enforce("criar-partida:203.0.113.10", {
        limit: 2,
        windowMs: 60_000,
      }),
    ).resolves.toBeUndefined();

    const rejection = enforce("criar-partida:203.0.113.10", {
      limit: 2,
      windowMs: 60_000,
    });
    await expect(rejection).rejects.toMatchObject({
      code: "RATE_LIMITED",
      status: 429,
    });

    const error = await rejection.catch((caught: unknown) => caught);
    const response = errorResponse(error);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(consume).toHaveBeenCalledWith(
      expect.objectContaining({
        keyHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect(JSON.stringify(consume.mock.calls)).not.toContain("203.0.113.10");
  });

  it("compartilha a cota entre duas instâncias do limitador", async () => {
    let count = 0;
    const sharedStore: RateLimitStore = {
      async consume() {
        count += 1;
        return { count, resetAt: new Date(70_000) };
      },
    };
    const dependencies = {
      keySecret: "segredo-de-teste-com-pelo-menos-32-caracteres",
      now: () => new Date(10_000),
      store: sharedStore,
    };
    const replicaA = createRateLimiter(dependencies);
    const replicaB = createRateLimiter(dependencies);

    const results = await Promise.allSettled([
      replicaA("criar-partida:203.0.113.10", {
        limit: 1,
        windowMs: 60_000,
      }),
      replicaB("criar-partida:203.0.113.10", {
        limit: 1,
        windowMs: 60_000,
      }),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([
      "fulfilled",
      "rejected",
    ]);
  });
});
