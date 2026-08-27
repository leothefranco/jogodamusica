import "server-only";

import type { SourceAvailabilityProvider } from "@/domain/music/provider";
import {
  SOURCE_AVAILABILITY_POLICY,
  applySourceAvailabilityResult,
  deriveEffectiveSourceAvailability,
  getSourceAvailabilityAgeBand,
  type EffectiveSourceAvailabilityState,
  type SourceAvailabilityAgeBand,
  type SourceAvailabilityConfirmationReason,
  type SourceAvailabilityErrorCode,
} from "@/domain/music/source-availability";
import { createYouTubeProvider } from "@/server/providers/youtube/youtube-provider";
import {
  findSourceAvailabilityByProviderContentId,
  persistSourceAvailabilityObservation,
  type SourceAvailabilitySource,
} from "@/server/repositories/source-availability-repository";

export type SourceAvailabilityMetric = {
  metric: "source_availability_observation";
  count: 1;
  effectiveState: EffectiveSourceAvailabilityState;
  policyVersion: number;
  ageBand: SourceAvailabilityAgeBand;
  resultCode:
    SourceAvailabilityConfirmationReason | SourceAvailabilityErrorCode;
};

export type SourceAvailabilityMetrics = {
  record(event: SourceAvailabilityMetric): void;
};

export type SourceAvailabilityServiceDependencies = {
  clock: () => Date;
  findSource: (
    providerContentId: string,
    region: string,
  ) => Promise<SourceAvailabilitySource | null>;
  metrics: SourceAvailabilityMetrics;
  persistObservation: typeof persistSourceAvailabilityObservation;
  provider: SourceAvailabilityProvider;
};

function resultCode(
  result: Awaited<ReturnType<SourceAvailabilityProvider["observe"]>>,
) {
  return result.type === "transient_error" ? result.errorCode : result.reason;
}

export function createSourceAvailabilityService(
  dependencies: SourceAvailabilityServiceDependencies,
) {
  return {
    async observeSource(providerContentId: string) {
      const current = await dependencies.findSource(
        providerContentId,
        SOURCE_AVAILABILITY_POLICY.region,
      );
      const result = await dependencies.provider.observe(
        providerContentId,
        SOURCE_AVAILABILITY_POLICY.region,
      );
      const observedAt = dependencies.clock();
      const candidate = applySourceAvailabilityResult({
        current: current?.observation ?? null,
        observedAt,
        result,
      });
      const persisted = await dependencies.persistObservation({
        providerContentId,
        track: result.type === "transient_error" ? null : result.track,
        observation: candidate,
      });
      const availability = deriveEffectiveSourceAvailability(
        persisted.observation,
        observedAt,
      );

      dependencies.metrics.record({
        metric: "source_availability_observation",
        count: 1,
        effectiveState: availability.state,
        policyVersion: persisted.observation.policyVersion,
        ageBand: getSourceAvailabilityAgeBand(
          persisted.observation,
          observedAt,
        ),
        resultCode: resultCode(result),
      });

      return { ...persisted, availability, result };
    },
  };
}

const sourceAvailabilityMetrics: SourceAvailabilityMetrics = {
  record(event) {
    console.info("[source-availability]", event);
  },
};

const sourceAvailabilityService = createSourceAvailabilityService({
  clock: () => new Date(),
  findSource: findSourceAvailabilityByProviderContentId,
  metrics: sourceAvailabilityMetrics,
  persistObservation: persistSourceAvailabilityObservation,
  provider: createYouTubeProvider(),
});

export const observeSourceAvailability =
  sourceAvailabilityService.observeSource;
