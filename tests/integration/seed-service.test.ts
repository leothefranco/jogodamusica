import { describe, expect, it } from "vitest";

import {
  demoThemeSeed,
  seedDatabase,
  type AdminSeed,
  type SeedAdapter,
} from "@/db/seed-service";

describe("seedDatabase", () => {
  it("é idempotente para tema e administrador", async () => {
    const themes = new Map<string, typeof demoThemeSeed>();
    const admins = new Map<string, AdminSeed>();
    const adapter: SeedAdapter = {
      async upsertTheme(theme) {
        themes.set(theme.slug, theme);
      },
      async upsertAdmin(admin) {
        admins.set(admin.userId, admin);
      },
    };
    const admin: AdminSeed = {
      userId: "10000000-0000-4000-8000-000000000010",
      displayName: "Admin de teste",
      role: "admin",
      isActive: true,
    };

    await seedDatabase(adapter, admin);
    await seedDatabase(adapter, admin);

    expect([...themes.values()]).toEqual([demoThemeSeed]);
    expect([...admins.values()]).toEqual([admin]);
  });

  it("permite preparar apenas o tema antes do primeiro usuário Auth", async () => {
    let themeCalls = 0;
    let adminCalls = 0;
    const adapter: SeedAdapter = {
      async upsertTheme() {
        themeCalls += 1;
      },
      async upsertAdmin() {
        adminCalls += 1;
      },
    };

    await seedDatabase(adapter, null);

    expect(themeCalls).toBe(1);
    expect(adminCalls).toBe(0);
  });
});
