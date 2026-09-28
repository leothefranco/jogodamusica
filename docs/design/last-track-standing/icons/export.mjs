import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { chromium } from "playwright";
const root = import.meta.dirname;
const ctx = { window: {} };
vm.runInNewContext(await fs.readFile(path.join(root, "icons.js"), "utf8"), ctx);
const { iconOptions, iconSvg } = ctx.window;
await fs.mkdir(path.join(root, "svg"), { recursive: true });
await fs.mkdir(path.join(root, "png"), { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 512, height: 512 },
  deviceScaleFactor: 1,
});
const issues = [];
page.on("pageerror", (e) => issues.push(String(e)));
for (const option of iconOptions) {
  for (const mode of ["color", "lime", "white"]) {
    const suffix = mode === "color" ? "" : `-${mode}`;
    await fs.writeFile(
      path.join(root, "svg", `icon-${option.id}${suffix}.svg`),
      iconSvg(option.id, { size: 512, mode }),
    );
    await fs.writeFile(
      path.join(root, "svg", `mark-${option.id}${suffix}.svg`),
      iconSvg(option.id, { size: 512, mode, tile: false }),
    );
    for (const size of mode === "color" ? [16, 32, 64, 128, 512] : [512]) {
      await page.setViewportSize({ width: size, height: size });
      await page.setContent(
        `<html><head><style>html,body{margin:0;background:transparent}svg{display:block}</style></head><body>${iconSvg(option.id, { size, mode })}</body></html>`,
      );
      await page.screenshot({
        path: path.join(root, "png", `icon-${option.id}${suffix}-${size}.png`),
        omitBackground: true,
      });
    }
  }
}
await fs
  .copyFile(
    path.join(root, "../../../../src/app/icon.svg"),
    path.join(root, "svg", "original.svg"),
  )
  .catch(async () => {
    await fs.writeFile(
      path.join(root, "svg", "original.svg"),
      iconSvg("original", { size: 512 }),
    );
  });
await page.setViewportSize({ width: 1440, height: 1100 });
await page.goto("http://127.0.0.1:4178/icons/board.html", {
  waitUntil: "networkidle",
});
await page.evaluate(() => document.fonts.ready);
await page.screenshot({
  path: path.join(root, "comparison.png"),
  fullPage: true,
});
await page.screenshot({
  path: path.join(root, "comparison.jpg"),
  type: "jpeg",
  quality: 88,
  fullPage: true,
});
await page.goto("http://127.0.0.1:4178/icons/", { waitUntil: "networkidle" });
// The simple static server does not resolve directory indexes; use the explicit file.
await page.goto("http://127.0.0.1:4178/icons/index.html", {
  waitUntil: "networkidle",
});
for (const option of iconOptions) {
  await page.locator(`[data-icon="${option.id}"]`).click();
  if (
    !(await page.locator("#selected-title").textContent()).startsWith(option.id)
  )
    issues.push(`Selection failed: ${option.id}`);
}
for (const mode of ["white", "lime", "color"]) {
  await page.locator(`[data-mode="${mode}"]`).click();
  const href = await page.locator("#download-svg").getAttribute("href");
  const response = await page.request.get(
    "http://127.0.0.1:4178/icons/" + href,
  );
  if (!response.ok()) issues.push(`Download failed: ${href}`);
}
for (const width of [1440, 390, 320]) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("http://127.0.0.1:4178/icons/index.html?icon=02", {
    waitUntil: "networkidle",
  });
  if (
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    )
  )
    issues.push(`Horizontal overflow: ${width}`);
  if (width === 390)
    await page.screenshot({
      path: path.join(root, "mobile.png"),
      fullPage: true,
    });
}
await page.setViewportSize({ width: 1440, height: 1100 });
await page.goto("http://127.0.0.1:4178/icons/index.html?icon=02", {
  waitUntil: "networkidle",
});
await page
  .locator("#application")
  .screenshot({ path: path.join(root, "application-02.png") });
await fs.writeFile(
  path.join(root, "verification.json"),
  JSON.stringify(
    {
      date: new Date().toISOString(),
      options: 6,
      svgFiles: 37,
      pngIconFiles: 42,
      widths: [1440, 390, 320],
      issues,
    },
    null,
    2,
  ),
);
await browser.close();
console.log(JSON.stringify({ options: 6, issues }));
if (issues.length) process.exitCode = 1;
