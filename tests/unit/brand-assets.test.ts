import { statSync } from "node:fs";
import sharp from "sharp";
import { expect, it } from "vitest";

it.each([
  { variant: "mobile", size: 640, maxBytes: 100_000 },
  { variant: "desktop", size: 1200, maxBytes: 250_000 },
])(
  "entrega arte C $variant otimizada, sem recortar a composição",
  async ({ variant, size, maxBytes }) => {
    const path = `public/brand/last-track-standing/encore-${variant}.webp`;
    const metadata = await sharp(path).metadata();
    expect(metadata).toMatchObject({
      width: size,
      height: size,
      format: "webp",
    });
    expect(statSync(path).size).toBeLessThan(maxBytes);
  },
);
