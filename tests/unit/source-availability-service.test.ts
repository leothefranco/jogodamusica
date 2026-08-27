import { describe, expect, it, vi } from "vitest";

import type {
  NormalizedProviderAvailabilityResult,
  SourceAvailabilityObservation,
} from "@/domain/music/source-availability";
import { createSourceAvailabilityService } from "@/server/services/source-availability-service";

const providerContentId = "dQw4w9WgXcQ";
const songId = "20000000-0000-4000-8000-000000000020";
const now = new Date("2026-01-01T00:00:00.000Z");
const track = {
  providerContentId,
  sourceTitle: "Fonte",
  sourceChannel: "Canal",
  thumbnailUrl: "https://example.com/thumb.jpg",
  durationSeconds: 180,
  isEmbeddable: true,
  isRegionAllowed: true,
};

type Dependencies = Parameters<typeof createSourceAvailabilityService>[0];

function createService(overrides: Partial<Dependencies> = {}) {
  return createSourceAvailabilityService({
    clock: () => now,
    findSource: async () => null,
    metrics: { record: vi.fn() },
    persistObservation: async ({ observation }) => ({
      songId,
      observation,
      applied: true,
    }),
    provider: {
      observe: async () => ({ type: "available", reason: "available", track }),
    },
    ...overrides,
  });
}

describe("serviço de disponibilidade regional", () => {
  it("resolve fora da transação curta, persiste e emite somente campos controlados", async () => {
    const order: string[] = [];
    let transactionOpen = false;
    const metrics = { record: vi.fn() };
    const service = createService({
      clock: () => {
        order.push("clock");
        return now;
      },
      findSource: async () => {
        order.push("read-current");
        return null;
      },
      provider: {
        observe: async () => {
          expect(transactionOpen).toBe(false);
          order.push("provider");
          return { type: "available", reason: "available", track };
        },
      },
      persistObservation: async ({ observation }) => {
        order.push("transaction");
        transactionOpen = true;
        try {
          return { songId, observation, applied: true };
        } finally {
          transactionOpen = false;
        }
      },
      metrics,
    });

    await expect(
      service.observeSource(providerContentId),
    ).resolves.toMatchObject({
      songId,
      applied: true,
      availability: { state: "available_fresh", playable: true },
      observation: { revision: 1, policyVersion: 1 },
    });
    expect(order).toEqual(["read-current", "clock", "provider", "transaction"]);
    expect(metrics.record).toHaveBeenCalledWith({
      metric: "source_availability_observation",
      count: 1,
      effectiveState: "available_fresh",
      policyVersion: 1,
      ageBand: "under_1d",
      resultCode: "available",
    });
    expect(JSON.stringify(metrics.record.mock.calls)).not.toContain(
      providerContentId,
    );
    expect(JSON.stringify(metrics.record.mock.calls)).not.toContain("Fonte");
  });

  it("persiste confirmação indisponível sem torná-la candidata", async () => {
    const persistObservation = vi.fn(async ({ observation }) => ({
      songId,
      observation,
      applied: true,
    }));
    const blockedTrack = { ...track, isRegionAllowed: false };
    const service = createService({
      provider: {
        observe: async () => ({
          type: "unavailable",
          reason: "region_blocked",
          track: blockedTrack,
        }),
      },
      persistObservation,
    });

    await expect(
      service.observeSource(providerContentId),
    ).resolves.toMatchObject({
      availability: { state: "unavailable", playable: false },
      observation: { confirmationReason: "region_blocked" },
    });
    expect(persistObservation).toHaveBeenCalledWith(
      expect.objectContaining({ track: blockedTrack }),
    );
  });

  it("preserva confirmação disponível em erro transitório", async () => {
    const current: SourceAvailabilityObservation = {
      region: "BR",
      confirmedState: "available",
      confirmationReason: "available",
      errorCode: null,
      observedAt: new Date("2025-12-31T00:00:00.000Z"),
      lastAttemptAt: new Date("2025-12-31T00:00:00.000Z"),
      lastConfirmedAt: new Date("2025-12-31T00:00:00.000Z"),
      validUntil: new Date("2026-01-07T00:00:00.000Z"),
      graceUntil: new Date("2026-01-08T00:00:00.000Z"),
      nextCheckAt: new Date("2026-01-07T00:00:00.000Z"),
      revision: 4,
      policyVersion: 1,
    };
    const service = createService({
      findSource: async () => ({
        songId,
        providerContentId,
        track,
        observation: current,
      }),
      provider: {
        observe: async () => ({
          type: "transient_error",
          errorCode: "quota",
        }),
      },
    });

    await expect(
      service.observeSource(providerContentId),
    ).resolves.toMatchObject({
      availability: { state: "available_fresh", playable: true },
      observation: {
        confirmedState: "available",
        errorCode: "quota",
        lastConfirmedAt: current.lastConfirmedAt,
        revision: 5,
      },
    });
  });

  it("persiste tentativa transitória nova sem fabricar uma Fonte", async () => {
    const persistObservation = vi.fn(async ({ observation }) => ({
      songId: null,
      observation,
      applied: true,
    }));
    const service = createService({
      persistObservation,
      provider: {
        observe: async () => ({
          type: "transient_error",
          errorCode: "transport",
        }),
      },
    });

    await expect(
      service.observeSource(providerContentId),
    ).resolves.toMatchObject({
      songId: null,
      track: null,
      availability: { state: "unknown", playable: false },
      observation: { errorCode: "transport", revision: 1 },
    });
    expect(persistObservation).toHaveBeenCalledWith(
      expect.objectContaining({ track: null }),
    );
  });

  it("torna retry concorrente idempotente no adapter em memória", async () => {
    let stored: SourceAvailabilityObservation | null = null;
    let effects = 0;
    let queue = Promise.resolve();
    const persistObservation: Dependencies["persistObservation"] = async ({
      observation,
    }) => {
      const previous = queue;
      let release: () => void = () => {};
      queue = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        const sameSemanticObservation =
          stored !== null &&
          JSON.stringify({ ...observation, revision: 0 }) ===
            JSON.stringify({ ...stored, revision: 0 });
        const applied =
          stored === null ||
          (observation.revision >= stored.revision &&
            observation.observedAt >= stored.observedAt &&
            observation.lastAttemptAt >= stored.lastAttemptAt &&
            !sameSemanticObservation);
        if (applied) {
          stored = {
            ...observation,
            revision: stored ? stored.revision + 1 : observation.revision,
          };
          effects += 1;
        }
        return { songId, observation: stored!, applied };
      } finally {
        release();
      }
    };
    const service = createService({ persistObservation });

    const results = await Promise.all([
      service.observeSource(providerContentId),
      service.observeSource(providerContentId),
    ]);

    expect(results.map(({ applied }) => applied).toSorted()).toEqual([
      false,
      true,
    ]);
    expect(stored).toMatchObject({ revision: 1 });
    expect(effects).toBe(1);
  });

  it("mantém a observação concorrente mais nova mesmo se a antiga terminar depois", async () => {
    const olderAt = new Date("2026-01-01T00:00:00.000Z");
    const newerAt = new Date("2026-01-01T00:00:01.000Z");
    const clock = vi
      .fn<() => Date>()
      .mockReturnValueOnce(olderAt)
      .mockReturnValueOnce(newerAt);
    const resolvers: Array<
      (result: NormalizedProviderAvailabilityResult) => void
    > = [];
    const provider = {
      observe: vi.fn(
        () =>
          new Promise<NormalizedProviderAvailabilityResult>((resolve) => {
            resolvers.push(resolve);
          }),
      ),
    };
    let stored: SourceAvailabilityObservation | null = null;
    let effects = 0;
    let queue = Promise.resolve();
    const persistObservation: Dependencies["persistObservation"] = async ({
      observation,
    }) => {
      const previous = queue;
      let release: () => void = () => {};
      queue = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        const applied =
          stored === null ||
          (observation.revision >= stored.revision &&
            observation.observedAt >= stored.observedAt &&
            observation.lastAttemptAt >= stored.lastAttemptAt);
        if (applied) {
          stored = {
            ...observation,
            revision: stored ? stored.revision + 1 : observation.revision,
          };
          effects += 1;
        }
        return { songId, observation: stored!, applied };
      } finally {
        release();
      }
    };
    const service = createService({ clock, persistObservation, provider });

    const olderRequest = service.observeSource(providerContentId);
    await vi.waitFor(() => expect(resolvers).toHaveLength(1));
    const newerRequest = service.observeSource(providerContentId);
    await vi.waitFor(() => expect(resolvers).toHaveLength(2));

    resolvers[1]({
      type: "unavailable",
      reason: "region_blocked",
      track: { ...track, isRegionAllowed: false },
    });
    const newerResult = await newerRequest;
    resolvers[0]({ type: "available", reason: "available", track });
    const olderResult = await olderRequest;

    expect(newerResult.applied).toBe(true);
    expect(olderResult.applied).toBe(false);
    expect(stored).toMatchObject({
      confirmationReason: "region_blocked",
      observedAt: newerAt,
      revision: 1,
    });
    expect(effects).toBe(1);
  });
});
