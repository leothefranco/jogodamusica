import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import sharp from "sharp";

function readPngSize(path: string) {
  const bytes = readFileSync(new URL(path, import.meta.url));
  expect(bytes.subarray(1, 4).toString("ascii")).toBe("PNG");
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

describe("ícones das PWAs", () => {
  it.each([16, 32, 192, 512])(
    "reproduz o símbolo aprovado no ícone público de %i px",
    async (size) => {
      const reference = await sharp(
        "docs/design/last-track-standing/icons/svg/icon-01.svg",
      )
        .resize(size, size)
        .ensureAlpha()
        .raw()
        .toBuffer();
      const actual = await sharp(`public/icons/icon-${size}.png`)
        .ensureAlpha()
        .raw()
        .toBuffer();
      expect(actual.equals(reference)).toBe(true);
    },
  );

  it.each(["", "admin-"])(
    "entrega Apple e maskable seguros (%s)",
    async (prefix) => {
      expect(readPngSize(`../../public/icons/${prefix}apple-icon.png`)).toEqual(
        { width: 180, height: 180 },
      );
      for (const size of [192, 512]) {
        const { data, info } = await sharp(
          `public/icons/${prefix}icon-maskable-${size}.png`,
        )
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        expect([info.width, info.height]).toEqual([size, size]);
        const background = prefix ? [24, 28, 34] : [16, 18, 22];
        let unsafePixels = 0;
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const offset = (y * size + x) * 4;
            if (data[offset + 3] !== 255) unsafePixels++;
            if (
              Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) > size * 0.4 &&
              background.some(
                (channel, index) => data[offset + index] !== channel,
              )
            )
              unsafePixels++;
          }
        }
        expect(unsafePixels).toBe(0);
      }
    },
  );

  it("entrega os tamanhos instaláveis para o admin", () => {
    expect(readPngSize("../../public/icons/admin-icon-192.png")).toEqual({
      width: 192,
      height: 192,
    });
    expect(readPngSize("../../public/icons/admin-icon-512.png")).toEqual({
      width: 512,
      height: 512,
    });
  });

  it("mantém identidades visuais diferentes", () => {
    const publicIcon = readFileSync(
      new URL("../../public/icons/icon-512.png", import.meta.url),
    );
    const adminIcon = readFileSync(
      new URL("../../public/icons/admin-icon-512.png", import.meta.url),
    );

    expect(adminIcon.equals(publicIcon)).toBe(false);
  });
});
