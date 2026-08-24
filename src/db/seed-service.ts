export type AdminSeed = {
  userId: string;
  displayName: string;
  role: "admin";
  isActive: true;
};

export interface SeedAdapter {
  upsertAdmin(admin: AdminSeed): Promise<void>;
}

export async function seedDatabase(
  adapter: SeedAdapter,
  admin: AdminSeed | null,
) {
  if (admin) {
    await adapter.upsertAdmin(admin);
  }
}
