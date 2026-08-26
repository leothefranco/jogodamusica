import {
  parseObservabilityConfig,
  rateLimitEnvSchema,
  seedEnvSchema,
  serverEnvSchema,
  youtubeEnvSchema,
  youtubePlaylistImportEnvSchema,
  type ObservabilityEnvironmentInput,
} from "@/lib/env-schema";
import { z } from "zod";

let cachedServerEnv: ReturnType<typeof serverEnvSchema.parse> | undefined;

type ObservabilityConfigDiagnostic = (
  message: "[observability-config-error]",
  details: {
    code: "INVALID_OBSERVABILITY_CONFIG";
    fields: string[];
  },
) => void;

export function getObservabilityEnv(
  input: ObservabilityEnvironmentInput = {
    OBSERVABILITY_ENVIRONMENT: process.env.OBSERVABILITY_ENVIRONMENT,
    OBSERVABILITY_EXPORTER: process.env.OBSERVABILITY_EXPORTER,
    OBSERVABILITY_RAW_RETENTION_DAYS:
      process.env.OBSERVABILITY_RAW_RETENTION_DAYS,
    RELEASE_COMMIT: process.env.RELEASE_COMMIT,
    VERCEL_ENV: process.env.VERCEL_ENV,
    NODE_ENV: process.env.NODE_ENV,
  },
  reportDiagnostic: ObservabilityConfigDiagnostic = (message, details) =>
    console.error(message, details),
) {
  try {
    return parseObservabilityConfig(input);
  } catch (error) {
    const fields =
      error instanceof z.ZodError
        ? [
            ...new Set(
              error.issues.map((issue) => String(issue.path[0] ?? "unknown")),
            ),
          ].sort()
        : ["unknown"];
    reportDiagnostic("[observability-config-error]", {
      code: "INVALID_OBSERVABILITY_CONFIG",
      fields,
    });
    throw new Error("Configuração de observabilidade inválida.");
  }
}

export function getServerEnv() {
  cachedServerEnv ??= serverEnvSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
  });

  return cachedServerEnv;
}

export function getRateLimitEnv() {
  return rateLimitEnvSchema.parse({
    RATE_LIMIT_KEY_SECRET: process.env.RATE_LIMIT_KEY_SECRET,
  });
}

export function getSeedEnv() {
  return seedEnvSchema.parse({
    SEED_ADMIN_USER_ID: process.env.SEED_ADMIN_USER_ID || undefined,
    SEED_ADMIN_DISPLAY_NAME: process.env.SEED_ADMIN_DISPLAY_NAME || undefined,
  });
}

export function getYouTubeEnv() {
  return youtubeEnvSchema.parse({
    YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
    YOUTUBE_PLAYLIST_IMPORT_MAX_ITEMS:
      process.env.YOUTUBE_PLAYLIST_IMPORT_MAX_ITEMS,
  });
}

export function getYouTubePlaylistImportEnv() {
  return youtubePlaylistImportEnvSchema.parse({
    YOUTUBE_PLAYLIST_IMPORT_MAX_ITEMS:
      process.env.YOUTUBE_PLAYLIST_IMPORT_MAX_ITEMS,
  });
}
