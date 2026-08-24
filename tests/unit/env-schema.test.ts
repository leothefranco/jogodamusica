import { describe, expect, it } from "vitest";

import {
  parsePublicSupabaseEnv,
  rateLimitEnvSchema,
  seedEnvSchema,
  serverEnvSchema,
  youtubeEnvSchema,
  youtubePlaylistImportEnvSchema,
} from "@/lib/env-schema";

describe("environment schemas", () => {
  it("prefere a chave publishable atual", () => {
    expect(
      parsePublicSupabaseEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_current",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "legacy-anon-key",
      }),
    ).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "sb_publishable_current",
    });
  });

  it("aceita a chave anon como compatibilidade", () => {
    expect(
      parsePublicSupabaseEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "legacy-anon-key",
      }).publishableKey,
    ).toBe("legacy-anon-key");
  });

  it("rejeita conexão que não seja PostgreSQL", () => {
    expect(() =>
      serverEnvSchema.parse({ DATABASE_URL: "https://example.com" }),
    ).toThrow();
  });

  it("exige um segredo forte para anonimizar chaves de rate limit", () => {
    expect(() =>
      rateLimitEnvSchema.parse({ RATE_LIMIT_KEY_SECRET: "curto" }),
    ).toThrow();
    expect(
      rateLimitEnvSchema.parse({
        RATE_LIMIT_KEY_SECRET: "segredo-com-pelo-menos-32-caracteres-seguros",
      }).RATE_LIMIT_KEY_SECRET,
    ).toBe("segredo-com-pelo-menos-32-caracteres-seguros");
  });

  it("aplica o nome padrão do administrador do seed", () => {
    expect(seedEnvSchema.parse({}).SEED_ADMIN_DISPLAY_NAME).toBe(
      "Administrador",
    );
  });

  it("aplica o teto máximo de 1.000 posições por playlist", () => {
    expect(
      youtubeEnvSchema.parse({ YOUTUBE_API_KEY: "key" })
        .YOUTUBE_PLAYLIST_IMPORT_MAX_ITEMS,
    ).toBe(1_000);
  });

  it("lê o teto da playlist sem exigir a chave do YouTube", () => {
    expect(
      youtubePlaylistImportEnvSchema.parse({})
        .YOUTUBE_PLAYLIST_IMPORT_MAX_ITEMS,
    ).toBe(1_000);
  });
});
