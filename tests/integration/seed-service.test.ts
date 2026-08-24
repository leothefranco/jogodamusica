import { describe, expect, it } from "vitest";

import {
  seedDatabase,
  type AdminSeed,
  type SeedAdapter,
} from "@/db/seed-service";

describe("seedDatabase", () => {
  it("é idempotente para o administrador", async () => {
    const admins = new Map<string, AdminSeed>();
    const adapter: SeedAdapter = {
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

    expect([...admins.values()]).toEqual([admin]);
  });

  it("não cria registros antes do primeiro usuário Auth", async () => {
    let adminCalls = 0;
    const adapter: SeedAdapter = {
      async upsertAdmin() {
        adminCalls += 1;
      },
    };

    await seedDatabase(adapter, null);

    expect(adminCalls).toBe(0);
  });
});
