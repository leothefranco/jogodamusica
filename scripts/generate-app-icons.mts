import { writeFile } from "node:fs/promises";
import sharp from "sharp";
import { brandPaths } from "../src/lib/brand.js";
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#101216"/><path d="${brandPaths.blue}" fill="#38BDF8"/><path d="${brandPaths.orange}" fill="#FF923D"/></svg>`;
await writeFile("src/app/icon.svg", svg + "\n");
for (const size of [192, 512])
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(`public/icons/icon-${size}.png`);
