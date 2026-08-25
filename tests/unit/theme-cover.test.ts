import { describe, expect, it } from "vitest";

import { validateThemeCover } from "@/domain/music/theme-cover";

function imageFile(bytes: number[], type: string, name = "capa") {
  return new File([Uint8Array.from(bytes)], name, { type });
}

describe("imagem de capa do tema", () => {
  it("aceita JPEG válido e define uma extensão segura", async () => {
    const cover = await validateThemeCover(
      imageFile([0xff, 0xd8, 0xff, 0xdb], "image/jpeg", "capa.exe"),
    );

    expect(cover).toEqual({ contentType: "image/jpeg", extension: "jpg" });
  });

  it("rejeita arquivo que apenas declara ser uma imagem", async () => {
    await expect(
      validateThemeCover(
        imageFile([0x4d, 0x5a, 0x90, 0x00], "image/jpeg", "capa.jpg"),
      ),
    ).rejects.toMatchObject({ code: "INVALID_THEME_COVER" });
  });

  it("rejeita imagem acima de 5 MB", async () => {
    const oversized = new File(
      [new Uint8Array(5 * 1024 * 1024 + 1)],
      "capa.png",
      { type: "image/png" },
    );

    await expect(validateThemeCover(oversized)).rejects.toMatchObject({
      code: "THEME_COVER_TOO_LARGE",
    });
  });
});
