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
