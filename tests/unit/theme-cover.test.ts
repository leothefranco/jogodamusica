import { describe, expect, it } from "vitest";

import {
  parseManagedThemeCoverReference,
  validateManagedThemeCoverMetadata,
  validateThemeCover,
} from "@/domain/music/theme-cover";

const userId = "10000000-0000-4000-8000-000000000001";
const validObjectKey = `${userId}/30000000-0000-4000-8000-000000000003.jpg`;

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

describe("referência gerenciada de capa", () => {
  it.each([
    [
      "bucket alheio",
      {
        bucket: "outro-bucket",
        objectKey: validObjectKey,
      },
    ],
    [
      "prefixo alheio",
      {
        bucket: "theme-covers",
        objectKey:
          "90000000-0000-4000-8000-000000000009/30000000-0000-4000-8000-000000000003.jpg",
      },
    ],
    [
      "UUID não aleatório",
      {
        bucket: "theme-covers",
        objectKey: `${userId}/30000000-0000-1000-8000-000000000003.jpg`,
      },
    ],
    [
      "extensão não permitida",
      {
        bucket: "theme-covers",
        objectKey: `${userId}/30000000-0000-4000-8000-000000000003.gif`,
      },
    ],
  ])("rejeita %s", (_label, reference) => {
    expect(() =>
      parseManagedThemeCoverReference(JSON.stringify(reference), userId),
    ).toThrowError(
      expect.objectContaining({ code: "INVALID_THEME_COVER_REFERENCE" }),
    );
  });

  it.each([
    [
      {
        contentType: "image/gif",
        size: 4,
        signatureBytes: Uint8Array.from([0x47, 0x49, 0x46]),
      },
      "tipo",
    ],
    [
      {
        contentType: "image/png",
        size: 4,
        signatureBytes: Uint8Array.from([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        ]),
      },
      "extensão",
    ],
    [
      {
        contentType: "image/jpeg",
        size: 5 * 1024 * 1024 + 1,
        signatureBytes: Uint8Array.from([0xff, 0xd8, 0xff]),
      },
      "tamanho",
    ],
  ])("rejeita metadados incompatíveis por %s", (metadata) => {
    expect(() =>
      validateManagedThemeCoverMetadata(
        { bucket: "theme-covers", objectKey: validObjectKey },
        metadata,
      ),
    ).toThrowError(
      expect.objectContaining({ code: "INVALID_THEME_COVER_METADATA" }),
    );
  });

  it("rejeita bytes arbitrários mesmo quando MIME, extensão e tamanho são válidos", () => {
    const metadata = {
      contentType: "image/jpeg",
      size: 4,
      signatureBytes: Uint8Array.from([0x4d, 0x5a, 0x90, 0x00]),
    };

    expect(() =>
      validateManagedThemeCoverMetadata(
        { bucket: "theme-covers", objectKey: validObjectKey },
        metadata,
      ),
    ).toThrowError(
      expect.objectContaining({ code: "INVALID_THEME_COVER_METADATA" }),
    );
  });
});
