import {
  observabilityEventSchema,
  type ObservabilityEvent,
} from "@/server/observability/schema";
import { rawRetentionDaysSchema } from "@/server/observability/config";

export interface ObservabilityExporter {
  readonly rawRetentionDays: number;
  export(candidate: unknown): void;
}

type ExporterOptions = {
  rawRetentionDays: number;
};

export function createInMemoryObservabilityExporter(
  options: ExporterOptions,
): ObservabilityExporter & { readonly events: ObservabilityEvent[] } {
  const events: ObservabilityEvent[] = [];
  const rawRetentionDays = rawRetentionDaysSchema.parse(
    options.rawRetentionDays,
  );

  return {
    rawRetentionDays,
    events,
    export(candidate) {
      events.push(observabilityEventSchema.parse(candidate));
    },
  };
}

export function createStructuredObservabilityExporter(
  options: ExporterOptions & { write(serializedEvent: string): void },
): ObservabilityExporter {
  const rawRetentionDays = rawRetentionDaysSchema.parse(
    options.rawRetentionDays,
  );

  return {
    rawRetentionDays,
    export(candidate) {
      const event = observabilityEventSchema.parse(candidate);
      options.write(JSON.stringify(event));
    },
  };
}
