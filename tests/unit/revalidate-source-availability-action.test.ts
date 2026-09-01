import { beforeEach, describe, expect, it, vi } from "vitest";

const actionMocks = vi.hoisted(() => {
  const order: string[] = [];
  return {
    order,
    redirect: vi.fn((path: string) => {
      order.push("redirect");
      throw Object.assign(new Error("NEXT_REDIRECT"), { path });
    }),
    requireAdmin: vi.fn(async () => {
      order.push("auth");
    }),
    revalidatePath: vi.fn(() => {
      order.push("revalidate-path");
    }),
    revalidateSourceAvailability: vi.fn(async () => {
      order.push("observe-persist");
      return { state: "available_fresh", playable: true, degraded: false };
    }),
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: actionMocks.revalidatePath,
}));
vi.mock("next/navigation", () => ({
  redirect: actionMocks.redirect,
}));
vi.mock("@/server/auth/session", () => ({
  requireAdmin: actionMocks.requireAdmin,
}));
vi.mock("@/server/services/theme-content-service", () => ({
  attachResolvedTrack: vi.fn(),
  deleteTheme: vi.fn(),
  removeThemeSong: vi.fn(),
  revalidateSourceAvailability: actionMocks.revalidateSourceAvailability,
  setThemePublication: vi.fn(),
  updateTheme: vi.fn(),
  updateThemeSong: vi.fn(),
}));

import { revalidateSourceAvailabilityAction } from "@/app/admin/(protected)/temas/actions";

describe("action de revalidação de Fonte", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actionMocks.order.length = 0;
  });

  it("reautentica, revalida/persiste e só então recarrega o editor", async () => {
    const themeId = "10000000-0000-4000-8000-000000000010";
    const songId = "20000000-0000-4000-8000-000000000020";

    await expect(
      revalidateSourceAvailabilityAction(themeId, songId),
    ).rejects.toMatchObject({
      path: `/admin/temas/${themeId}?message=Disponibilidade revalidada`,
    });

    expect(actionMocks.revalidateSourceAvailability).toHaveBeenCalledWith(
      themeId,
      songId,
    );
    expect(actionMocks.revalidatePath).toHaveBeenCalledOnce();
    expect(actionMocks.revalidatePath).toHaveBeenCalledWith(
      `/admin/temas/${themeId}`,
    );
    expect(actionMocks.order).toEqual([
      "auth",
      "observe-persist",
      "revalidate-path",
      "redirect",
    ]);
  });

  it("rejeita identificadores não confiáveis antes do serviço", async () => {
    await expect(
      revalidateSourceAvailabilityAction("tema-inválido", "song-inválido"),
    ).rejects.toMatchObject({
      path: "/admin/temas?error=Identificadores%20inv%C3%A1lidos",
    });

    expect(actionMocks.revalidateSourceAvailability).not.toHaveBeenCalled();
    expect(actionMocks.revalidatePath).not.toHaveBeenCalled();
    expect(actionMocks.order).toEqual(["auth", "redirect"]);
  });
});
