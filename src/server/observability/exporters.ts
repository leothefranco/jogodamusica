import { rawRetentionDaysSchema } from "@/lib/env-schema";
import {
  observabilityEventSchema,
  type ObservabilityEvent,
} from "@/server/observability/schema";

export interface ObservabilityExporter {
  export(candidate: unknown): void;
}

export type ObservabilityRetentionDeclaration = {
  configuredRawRetentionDays: number;
  enforcement: "external_collector";
  collectorVerification: "required_before_rollout";
};

type RetentionDeclaredExporter = ObservabilityExporter & {
  readonly retention: ObservabilityRetentionDeclaration;
};

type ExporterOptions = {
  rawRetentionDays: number;
};

function createRetentionDeclaration(
  configuredRawRetentionDays: number,
): ObservabilityRetentionDeclaration {
  return {
    configuredRawRetentionDays,
    enforcement: "external_collector",
    collectorVerification: "required_before_rollout",
  };
}

export function createInMemoryObservabilityExporter(
  options: ExporterOptions,
): RetentionDeclaredExporter & { readonly events: ObservabilityEvent[] } {
  const events: ObservabilityEvent[] = [];
  const rawRetentionDays = rawRetentionDaysSchema.parse(
    options.rawRetentionDays,
  );

  return {
    retention: createRetentionDeclaration(rawRetentionDays),
    events,
    export(candidate) {
      events.push(observabilityEventSchema.parse(candidate));
    },
  };
}

export function createStructuredObservabilityExporter(
  options: ExporterOptions & { write(serializedEvent: string): void },
): RetentionDeclaredExporter {
  const rawRetentionDays = rawRetentionDaysSchema.parse(
    options.rawRetentionDays,
  );

  return {
    retention: createRetentionDeclaration(rawRetentionDays),
    export(candidate) {
      const event = observabilityEventSchema.parse(candidate);
      options.write(JSON.stringify(event));
    },
  };
}
