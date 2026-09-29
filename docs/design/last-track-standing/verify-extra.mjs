import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
const root = import.meta.dirname,
  context = { window: {} };
vm.runInNewContext(
  await fs.readFile(path.join(root, "catalog.js"), "utf8"),
  context,
);
const browser = await chromium.launch({ headless: true }),
  issues = [];
const extras = ["install", "install-ios", "install-admin", "login-config"];
for (const key of ["a", "b", "c"])
  for (const device of ["desktop", "mobile"]) {
    const page = await browser.newPage({
      viewport:
        device === "desktop"
          ? { width: 1280, height: 960 }
          : { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    page.on("pageerror", (e) => issues.push({ key, device, error: String(e) }));
    for (const id of extras) {
      await page.goto(
        "http://127.0.0.1:4178/screen.html?identity=" + key + "&screen=" + id,
        { waitUntil: "networkidle" },
      );
      await page.evaluate(() => document.fonts.ready);
      const state = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        broken: [...document.images].some(
          (i) => !i.complete || !i.naturalWidth,
        ),
      }));
      if (state.overflow || state.broken)
        issues.push({ key, device, id, ...state });
      await page.screenshot({
        path: path.join(root, "exports", key, device, id + ".png"),
        fullPage: true,
      });
    }
    await page.close();
  }
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
await page.goto("http://127.0.0.1:4178/?compare=1", {
  waitUntil: "networkidle",
});
await page.screenshot({
  path: path.join(root, "comparison.png"),
  fullPage: true,
});
if ((await page.locator("iframe").count()) !== 3)
  issues.push({ gallery: "missing comparison frame" });
await page.goto("http://127.0.0.1:4178/screen.html?identity=c&screen=duel");
await page.getByRole("button", { name: "Votar na música B" }).click();
await page
  .getByRole("dialog")
  .getByRole("heading", { name: "Golden Hour" })
  .waitFor();
await page.getByRole("button", { name: "Cancelar", exact: true }).click();
await page.goto("http://127.0.0.1:4178/screen.html?screen=login-config");
if (!(await page.locator("button[type=submit]").isDisabled()))
  issues.push({ login: "unconfigured enabled" });
await page.goto("http://127.0.0.1:4178/overview.html", {
  waitUntil: "networkidle",
});
if ((await page.locator(".card").count()) !== 108)
  issues.push({ atlas: "incorrect card count" });
await page.goto("http://127.0.0.1:4178/comparison-board.html", {
  waitUntil: "networkidle",
});
await page.setViewportSize({ width: 1800, height: 1400 });
await page.screenshot({
  path: path.join(root, "identities-board.png"),
  fullPage: true,
});
const report = JSON.parse(
  await fs.readFile(path.join(root, "verification.json"), "utf8"),
);
report.screens = 36;
report.exports = 216;
report.issues.push(...issues);
report.interactions.push(
  "vote B confirmation",
  "unconfigured login disabled",
  "108 atlas links",
);
report.date = new Date().toISOString();
await fs.writeFile(
  path.join(root, "verification.json"),
  JSON.stringify(report, null, 2),
);
await browser.close();
console.log(JSON.stringify({ screens: 36, exports: 216, issues }));
if (issues.length) process.exitCode = 1;
