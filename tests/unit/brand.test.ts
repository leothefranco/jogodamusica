import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { BrandMark } from "@/components/brand-mark";
import { brandColors } from "@/lib/brand";

describe("símbolo Last Track Standing", () => {
  it("separa marca, lados, superfícies, texto, foco e estados", () => {
    expect(brandColors).toEqual({
      brand: "#D4FF46",
      background: "#101216",
      surface: "#181C22",
      text: "#F5F3ED",
      muted: "#B8BEC8",
      sideA: "#38BDF8",
      sideB: "#FF923D",
      focus: "#F5F3ED",
      success: "#6EE7B7",
      error: "#FF8792",
    });
    const css = readFileSync("src/app/globals.css", "utf8");
    for (const declaration of [
      "--brand: #d4ff46",
      "--duel-a: #38bdf8",
      "--duel-b: #ff923d",
      "--app-focus: #f5f3ed",
      "--app-success: #6ee7b7",
      "--app-error: #ff8792",
      "--primary: var(--brand)",
      "--ring: var(--app-focus)",
      "--destructive: var(--app-error)",
    ])
      expect(css.toLowerCase()).toContain(declaration + ";");
  });

  it.each([16, 32, 192, 512])(
    "preserva o desenho 01 verde em %i px",
    async (size) => {
      const approved = readFileSync(
        "docs/design/last-track-standing/icons/svg/icon-01.svg",
      );
      const actual = renderToStaticMarkup(
        createElement(BrandMark, { size: 512 }),
      );
      const raster = (svg: Buffer) =>
        sharp(svg).resize(size, size).ensureAlpha().raw().toBuffer();

      expect(
        (await raster(Buffer.from(actual))).equals(await raster(approved)),
      ).toBe(true);
    },
  );
});
