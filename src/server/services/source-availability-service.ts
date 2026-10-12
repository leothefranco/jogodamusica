import "server-only";
import { drainCatalogInvalidations } from "@/server/services/catalog-invalidation-service";
import { getDatabase } from "@/db";
import {
  assertCatalogHealthWriteAllowed,
  catalogHealthWriteMode,
  type CatalogHealthWriteMode,
} from "@/server/repositories/catalog-health-mode";

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
  afterCommit?: () => Promise<unknown>;
  assertWriteAllowed?: () => Promise<CatalogHealthWriteMode>;
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
    async observeSource(
      providerContentId: string,
      context?: { themeId: string },
    ) {
      const mode = dependencies.assertWriteAllowed
        ? await dependencies.assertWriteAllowed()
        : catalogHealthWriteMode();
      const current = await dependencies.findSource(
        providerContentId,
        SOURCE_AVAILABILITY_POLICY.region,
      );
      const attemptedAt = dependencies.clock();
      const result = await dependencies.provider.observe(
        providerContentId,
        SOURCE_AVAILABILITY_POLICY.region,
      );
      const candidate = applySourceAvailabilityResult({
        current: current?.observation ?? null,
        observedAt: attemptedAt,
        result,
      });
      const persisted = await dependencies.persistObservation({
        expectedWriteMode: mode,
        providerContentId,
        track: result.type === "transient_error" ? null : result.track,
        observation: candidate,
        normalizedResult: result,
        ...(context ? { contextThemeId: context.themeId } : {}),
      });
      const decisionAt = dependencies.clock();
      if (mode === "enabled" && persisted.applied) {
        try {
          await dependencies.afterCommit?.();
        } catch {
          /* Failed delivery keeps backlog; health is already committed. */
        }
      }
      const availability = deriveEffectiveSourceAvailability(
        persisted.observation,
        decisionAt,
      );

      try {
        dependencies.metrics.record({
          metric: "source_availability_observation",
          count: 1,
          effectiveState: availability.state,
          policyVersion: persisted.observation.policyVersion,
          ageBand: getSourceAvailabilityAgeBand(
            persisted.observation,
            decisionAt,
          ),
          resultCode: resultCode(result),
        });
      } catch {
        /* Telemetry cannot change a committed observation. */
      }

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
  afterCommit: drainCatalogInvalidations,
  assertWriteAllowed: () => assertCatalogHealthWriteAllowed(getDatabase()),
  clock: () => new Date(),
  findSource: findSourceAvailabilityByProviderContentId,
  metrics: sourceAvailabilityMetrics,
  persistObservation: persistSourceAvailabilityObservation,
  provider: createYouTubeProvider(),
});

export const observeSourceAvailability =
  sourceAvailabilityService.observeSource;
