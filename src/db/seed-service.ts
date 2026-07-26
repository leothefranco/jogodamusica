export const demoThemeSeed = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "Tema de demonstração",
  slug: "tema-de-demonstracao",
  description:
    "Tema inativo criado pelo seed. Adicione músicas antes de publicá-lo.",
  defaultBracketSize: 4,
  isActive: false,
} as const;

export type AdminSeed = {
  userId: string;
  displayName: string;
  role: "admin";
  isActive: true;
};

export interface SeedAdapter {
  upsertTheme(theme: typeof demoThemeSeed): Promise<void>;
  upsertAdmin(admin: AdminSeed): Promise<void>;
}

export async function seedDatabase(
  adapter: SeedAdapter,
  admin: AdminSeed | null,
) {
  await adapter.upsertTheme(demoThemeSeed);

  if (admin) {
    await adapter.upsertAdmin(admin);
  }
}
