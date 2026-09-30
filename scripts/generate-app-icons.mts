import { writeFile } from "node:fs/promises";
import sharp from "sharp";
import { brandColors, brandPaths } from "../src/lib/brand.js";

function iconSvg(admin: boolean, maskable = false) {
  const background = admin ? brandColors.surface : brandColors.background;
  // Administrative controls badge, separate from the unchanged mark and inside
  // the central 80%-diameter maskable safe circle. No platform-dependent fonts.
  const badge = admin
    ? `<rect x="184" y="376" width="144" height="40" rx="20" fill="${brandColors.text}"/><path d="M216 385v22m40-22v22m40-22v22" stroke="${background}" stroke-width="4"/><path d="M208 391h16m24 10h16m24-10h16" stroke="${background}" stroke-width="6"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="${maskable ? 0 : 112}" fill="${background}"/><path d="${brandPaths.symbol}" fill="${brandColors.brand}"/>${badge}</svg>`;
}

// The edited image_gen master is versioned; regeneration only resizes/compresses
// it, without another generative request or a crop of the C composition.
for (const [variant, size] of [
  ["mobile", 640],
  ["desktop", 1200],
] as const) {
  await sharp("public/brand/last-track-standing/encore-master.png")
    .resize(size, size, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82, effort: 6 })
    .toFile(`public/brand/last-track-standing/encore-${variant}.webp`);
}

for (const admin of [false, true]) {
  const prefix = admin ? "admin-" : "";
  const svg = iconSvg(admin);
  await writeFile(`public/icons/${prefix}icon.svg`, svg + "\n");
  if (!admin) await writeFile("src/app/icon.svg", svg + "\n");
  for (const size of [16, 32, 192, 512]) {
    await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toFile(`public/icons/${prefix}icon-${size}.png`);
  }
  for (const size of [192, 512]) {
    await sharp(Buffer.from(iconSvg(admin, true)))
      .resize(size, size)
      .png()
      .toFile(`public/icons/${prefix}icon-maskable-${size}.png`);
  }
  await sharp(Buffer.from(iconSvg(admin, true)))
    .resize(180, 180)
    .png()
    .toFile(`public/icons/${prefix}apple-icon.png`);
}
