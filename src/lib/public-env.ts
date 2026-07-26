import {
  parsePublicSupabaseEnv,
  type PublicSupabaseEnv,
} from "@/lib/env-schema";

export function getOptionalPublicSupabaseEnv(): PublicSupabaseEnv | null {
  const input = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };

  try {
    return parsePublicSupabaseEnv(input);
  } catch {
    return null;
  }
}

export function getPublicSupabaseEnv(): PublicSupabaseEnv {
  const config = getOptionalPublicSupabaseEnv();

  if (!config) {
    throw new Error(
      "As variáveis públicas do Supabase não foram configuradas.",
    );
  }

  return config;
}
