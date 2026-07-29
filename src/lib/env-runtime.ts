import {
  seedEnvSchema,
  serverEnvSchema,
  youtubeEnvSchema,
  youtubePlaylistImportEnvSchema,
} from "@/lib/env-schema";

let cachedServerEnv: ReturnType<typeof serverEnvSchema.parse> | undefined;

export function getServerEnv() {
  cachedServerEnv ??= serverEnvSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
  });

  return cachedServerEnv;
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
