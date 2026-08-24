import { z } from "zod";

const publicSupabaseInputSchema = z.object({
  url: z.string().url(),
  publishableKey: z.string().min(1),
});

const databaseUrlSchema = z
  .string()
  .url()
  .refine(
    (value) => ["postgres:", "postgresql:"].includes(new URL(value).protocol),
    "DATABASE_URL precisa usar o protocolo postgres ou postgresql.",
  );

export const serverEnvSchema = z.object({
  DATABASE_URL: databaseUrlSchema,
});

export const rateLimitEnvSchema = z.object({
  RATE_LIMIT_KEY_SECRET: z.string().min(32),
});

export const youtubePlaylistImportEnvSchema = z.object({
  YOUTUBE_PLAYLIST_IMPORT_MAX_ITEMS: z.coerce
    .number()
    .int()
    .min(1)
    .max(1_000)
    .default(1_000),
});

export const youtubeEnvSchema = youtubePlaylistImportEnvSchema.extend({
  YOUTUBE_API_KEY: z.string().trim().min(1),
});

export const seedEnvSchema = z.object({
  SEED_ADMIN_USER_ID: z.string().uuid().optional(),
  SEED_ADMIN_DISPLAY_NAME: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .default("Administrador"),
});

export type PublicSupabaseEnv = z.infer<typeof publicSupabaseInputSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type RateLimitEnv = z.infer<typeof rateLimitEnvSchema>;
export type YouTubeEnv = z.infer<typeof youtubeEnvSchema>;
export type YouTubePlaylistImportEnv = z.infer<
  typeof youtubePlaylistImportEnvSchema
>;
export type SeedEnv = z.infer<typeof seedEnvSchema>;

export function parsePublicSupabaseEnv(input: {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
}): PublicSupabaseEnv {
  return publicSupabaseInputSchema.parse({
    url: input.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey:
      input.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      input.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}
