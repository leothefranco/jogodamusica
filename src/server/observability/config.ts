import { z } from "zod";

export const rawRetentionDaysSchema = z.coerce.number().int().min(1).max(30);

const observabilityConfigSchema = z
  .object({
    environment: z.enum(["local", "preview", "production"]),
    exporter: z.enum(["structured", "none"]),
    rawRetentionDays: rawRetentionDaysSchema,
    releaseCommit: z
      .string()
      .regex(/^[0-9a-f]{7,64}$/)
      .optional(),
  })
  .strict();

export type ObservabilityConfig = z.infer<typeof observabilityConfigSchema>;

type ObservabilityEnvironmentInput = {
  OBSERVABILITY_ENVIRONMENT?: string;
  OBSERVABILITY_EXPORTER?: string;
  OBSERVABILITY_RAW_RETENTION_DAYS?: string;
  RELEASE_COMMIT?: string;
};

export function parseObservabilityConfig(
  input: ObservabilityEnvironmentInput,
): ObservabilityConfig {
  return observabilityConfigSchema.parse({
    environment: input.OBSERVABILITY_ENVIRONMENT || "local",
    exporter: input.OBSERVABILITY_EXPORTER || "structured",
    rawRetentionDays: input.OBSERVABILITY_RAW_RETENTION_DAYS || "30",
    ...(input.RELEASE_COMMIT ? { releaseCommit: input.RELEASE_COMMIT } : {}),
  });
}

export function getObservabilityRuntimeConfig(
  input?: ObservabilityEnvironmentInput,
): ObservabilityConfig {
  try {
    return parseObservabilityConfig(
      input ?? {
        OBSERVABILITY_ENVIRONMENT: process.env.OBSERVABILITY_ENVIRONMENT,
        OBSERVABILITY_EXPORTER: process.env.OBSERVABILITY_EXPORTER,
        OBSERVABILITY_RAW_RETENTION_DAYS:
          process.env.OBSERVABILITY_RAW_RETENTION_DAYS,
        RELEASE_COMMIT: process.env.RELEASE_COMMIT,
      },
    );
  } catch {
    return {
      environment: "local",
      exporter: "none",
      rawRetentionDays: 30,
    };
  }
}
