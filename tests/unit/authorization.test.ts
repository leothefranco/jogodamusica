import { describe, expect, it } from "vitest";

import type { AdminProfile } from "@/db/schema";
import { resolveAdminUser } from "@/server/auth/authorization";

const activeProfile: AdminProfile = {
  userId: "10000000-0000-4000-8000-000000000010",
  displayName: "Admin de teste",
  role: "admin",
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

describe("resolveAdminUser", () => {
  it("autoriza um perfil ativo correspondente às claims", () => {
    expect(
      resolveAdminUser(
        {
          sub: activeProfile.userId,
          email: "admin@example.com",
        },
        activeProfile,
      ),
    ).toEqual({
      userId: activeProfile.userId,
      email: "admin@example.com",
      displayName: "Admin de teste",
      role: "admin",
    });
  });

  it("rejeita perfil ausente, inativo ou de outro usuário", () => {
    expect(resolveAdminUser({ sub: activeProfile.userId }, null)).toBeNull();
    expect(
      resolveAdminUser(
        { sub: activeProfile.userId },
        { ...activeProfile, isActive: false },
      ),
    ).toBeNull();
    expect(
      resolveAdminUser(
        { sub: "20000000-0000-4000-8000-000000000020" },
        activeProfile,
      ),
    ).toBeNull();
  });
});
