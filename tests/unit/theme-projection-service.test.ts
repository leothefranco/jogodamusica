import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { createThemeProjectionRebuildService } from "@/server/services/theme-projection-service";
vi.mock("@/server/auth/session", () => ({ requireAdmin: vi.fn() }));
const actor = {
  userId: "30000000-0000-4000-8000-000000000071",
  email: "qa@example.test",
  displayName: "QA",
  role: "admin" as const,
};
const themeId = "10000000-0000-4000-8000-000000000071";
describe("rebuild administrativo do Tema", () => {
  it("não acessa dados sem autorização", async () => {
    const rebuild = vi.fn();
    const run = createThemeProjectionRebuildService({
      authorize: async () => {
        throw new AppError("FORBIDDEN", "Negado", 403);
      },
      rebuild,
    });
    await expect(run({ themeId })).rejects.toMatchObject({ status: 403 });
    expect(rebuild).not.toHaveBeenCalled();
  });
  it("rejeita valores derivados enviados pelo cliente", async () => {
    const rebuild = vi.fn();
    const run = createThemeProjectionRebuildService({
      authorize: async () => actor,
      rebuild,
    });
    await expect(run({ themeId, playableCount: 64 })).rejects.toMatchObject({
      code: "INVALID_REQUEST",
      status: 400,
    });
    expect(rebuild).not.toHaveBeenCalled();
  });
  it.each(["created", "unchanged", "corrected"] as const)(
    "retorna %s do backend usando apenas Tema e ator autorizados",
    async (status) => {
      const rebuild = vi.fn().mockResolvedValue({ status, changedFields: [] });
      const run = createThemeProjectionRebuildService({
        authorize: async () => actor,
        rebuild,
      });
      expect(await run({ themeId })).toEqual({ status, changedFields: [] });
      expect(rebuild).toHaveBeenCalledExactlyOnceWith(themeId, actor.userId);
    },
  );
});
