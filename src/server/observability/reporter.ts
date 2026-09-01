import type { ObservabilityExporter } from "@/server/observability/exporters";
import { createStructuredObservabilityExporter } from "@/server/observability/exporters";
import { getObservabilityEnv } from "@/lib/env";
import { redactDiagnosticValue } from "@/server/observability/redaction";
import {
  observabilityEventSchema,
  type ObservabilityEnvironment,
  type ObservabilityEvent,
} from "@/server/observability/schema";

type GeneratedEnvelopeField =
  "schemaVersion" | "occurredAt" | "environment" | "releaseCommit";

export type ObservabilityEventInput = ObservabilityEvent extends infer Event
  ? Event extends ObservabilityEvent
    ? Omit<Event, GeneratedEnvelopeField>
    : never
  : never;

export interface ObservabilityReporter {
  report(input: ObservabilityEventInput): void;
}

export function createObservabilityReporter(dependencies: {
  environment: ObservabilityEnvironment;
  releaseCommit?: string;
  now(): Date;
  exporter: ObservabilityExporter;
}): ObservabilityReporter {
  return {
    report(input) {
      const candidate = {
        ...input,
        schemaVersion: 1,
        occurredAt: dependencies.now().toISOString(),
        environment: dependencies.environment,
        ...(dependencies.releaseCommit
          ? { releaseCommit: dependencies.releaseCommit }
          : {}),
      };
      const parsed = observabilityEventSchema.safeParse(
        redactDiagnosticValue(candidate),
      );
      if (!parsed.success) return;

      try {
        dependencies.exporter.export(parsed.data);
      } catch {
        // Telemetry is best effort and cannot change the business outcome.
      }
    },
  };
}

const runtimeConfig = getObservabilityEnv();
const defaultExporter: ObservabilityExporter =
  runtimeConfig.exporter === "structured"
    ? createStructuredObservabilityExporter({
        rawRetentionDays: runtimeConfig.rawRetentionDays,
        write: (serializedEvent) => console.info(serializedEvent),
      })
    : {
        export() {},
      };
const defaultReporter = createObservabilityReporter({
  environment: runtimeConfig.environment,
  releaseCommit: runtimeConfig.releaseCommit,
  now: () => new Date(),
  exporter: defaultExporter,
});

export function reportObservabilityEvent(input: ObservabilityEventInput): void {
  defaultReporter.report(input);
}
