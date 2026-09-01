import { describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/errors";
import { createThemeActionAdapter } from "@/server/actions/create-theme-action";
import { ThemeCreationError } from "@/server/services/create-theme-workflow";

const admin = {
  userId: "10000000-0000-4000-8000-000000000001",
  email: "admin@example.com",
  displayName: "Admin",
  role: "admin" as const,
};

describe("adapter da action de criação de tema", () => {
  it("reautentica antes do workflow e rejeita administrador inativo", async () => {
    const authenticate = vi
      .fn()
      .mockRejectedValue(
        new AppError(
          "ADMIN_SESSION_REQUIRED",
          "Sessão administrativa inválida.",
          401,
        ),
      );
    const createTheme = vi.fn();
    const action = createThemeActionAdapter({ authenticate, createTheme });

    await expect(action(new FormData())).rejects.toMatchObject({
      code: "ADMIN_SESSION_REQUIRED",
    });
    expect(authenticate).toHaveBeenCalledOnce();
    expect(createTheme).not.toHaveBeenCalled();
  });

  it("passa a identidade verificada e o FormData real ao workflow", async () => {
    const authenticate = vi.fn().mockResolvedValue(admin);
    const createTheme = vi.fn().mockResolvedValue({
      idempotent: false,
      themeId: "20000000-0000-4000-8000-000000000002",
    });
    const action = createThemeActionAdapter({ authenticate, createTheme });
    const formData = new FormData();
    formData.set("name", "Clássicos");

    await expect(action(formData)).resolves.toEqual({
      idempotent: false,
      themeId: "20000000-0000-4000-8000-000000000002",
    });
    expect(createTheme).toHaveBeenCalledWith(admin, formData);
  });

  it("informa quando a referência foi removida pela compensação", async () => {
    const createTheme = vi.fn().mockRejectedValue(
      new ThemeCreationError(
        new AppError("INVALID_THEME", "Revise os campos do tema.", 400, {
          name: ["Informe o nome."],
        }),
        "removed",
      ),
    );
    const action = createThemeActionAdapter({
      authenticate: vi.fn().mockResolvedValue(admin),
      createTheme,
    });

    await expect(action(new FormData())).resolves.toEqual({
      status: "error",
      message: "Revise os campos do tema.",
      fieldErrors: { name: ["Informe o nome."] },
      coverReferenceStatus: "removed",
    });
  });

  it("não classifica o campo oculto vazio como referência de capa", async () => {
    const createTheme = vi
      .fn()
      .mockRejectedValue(new AppError("INVALID_THEME", "Revise o tema.", 400));
    const action = createThemeActionAdapter({
      authenticate: vi.fn().mockResolvedValue(admin),
      createTheme,
    });
    const formData = new FormData();
    formData.set("coverReference", "");

    await expect(action(formData)).resolves.toEqual({
      status: "error",
      message: "Revise o tema.",
      fieldErrors: null,
    });
  });

  it.each([
    ["THEME_COVER_INSPECTION_FAILED", "reusable"],
    ["INVALID_THEME_COVER_REFERENCE", "rejected"],
    ["THEME_COVER_NOT_FOUND", "rejected"],
  ])("classifica a referência após %s", async (code, coverReferenceStatus) => {
    const createTheme = vi
      .fn()
      .mockRejectedValue(new AppError(code, "Falha ao validar a capa.", 400));
    const action = createThemeActionAdapter({
      authenticate: vi.fn().mockResolvedValue(admin),
      createTheme,
    });
    const formData = new FormData();
    formData.set("coverReference", "referência de teste");

    await expect(action(formData)).resolves.toMatchObject({
      status: "error",
      coverReferenceStatus,
    });
  });
});
