import "server-only";

import type { ResolvedProviderTrack } from "@/domain/music/provider";
import type { SourceAvailabilityObservation } from "@/domain/music/source-availability";
import type { SourceAvailabilitySource } from "@/server/repositories/source-availability-repository";
import {
  createSourceAvailabilityService,
  type SourceAvailabilityServiceDependencies,
} from "@/server/services/source-availability-service";

const observedAt = new Date("2026-01-01T00:00:00.000Z");
const songId = "20000000-0000-4000-8000-000000000020";
const track: ResolvedProviderTrack = {
  providerContentId: "dQw4w9WgXcQ",
  sourceTitle: "Fonte E2E",
  sourceChannel: "Canal E2E",
  thumbnailUrl: "https://example.com/thumb.jpg",
  durationSeconds: 180,
  isEmbeddable: true,
  isRegionAllowed: true,
};

type FixtureRecord = {
  flow: string[];
  providerCallCount: number;
  source: SourceAvailabilitySource | null;
};

const fixtureGlobal = globalThis as typeof globalThis & {
  sourceAvailabilityFixtureStore?: Map<string, FixtureRecord>;
};
const fixtureStore =
  fixtureGlobal.sourceAvailabilityFixtureStore ??
  (fixtureGlobal.sourceAvailabilityFixtureStore = new Map());

function getFixtureRecord(fixtureId: string) {
  const current = fixtureStore.get(fixtureId);
  if (current) return current;

  const created: FixtureRecord = {
    flow: [],
    providerCallCount: 0,
    source: null,
  };
  fixtureStore.set(fixtureId, created);
  return created;
}

export function readSourceAvailabilityFixture(fixtureId: string) {
  const record = getFixtureRecord(fixtureId);
  return {
    flow: [...record.flow],
    now: observedAt,
    providerCallCount: record.providerCallCount,
    source: record.source,
  };
}

export function createSourceAvailabilityFixtureService(fixtureId: string) {
  const record = getFixtureRecord(fixtureId);
  const dependencies: SourceAvailabilityServiceDependencies = {
    clock: () => observedAt,
    findSource: async (providerContentId, region) => {
      record.flow.push("read");
      const source = record.source;
      if (
        source?.providerContentId !== providerContentId ||
        source.observation?.region !== region
      ) {
        return null;
      }
      return source;
    },
    metrics: { record() {} },
    persistObservation: async ({
      providerContentId,
      observation,
      track: observedTrack,
    }: {
      providerContentId: string;
      observation: SourceAvailabilityObservation;
      track: ResolvedProviderTrack | null;
    }) => {
      record.flow.push("persist");
      record.source = {
        songId,
        providerContentId,
        observation,
        track: observedTrack,
      };
      return {
        songId,
        observation,
        applied: true,
        track: observedTrack,
      };
    },
    provider: {
      observe: async () => {
        record.providerCallCount += 1;
        record.flow.push("provider");
        return { type: "available", reason: "available", track };
      },
    },
  };

  const service = createSourceAvailabilityService(dependencies);
  return {
    observe: () => service.observeSource(track.providerContentId),
  };
}
