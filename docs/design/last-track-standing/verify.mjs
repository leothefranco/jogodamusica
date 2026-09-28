import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
const root = import.meta.dirname;
const context = { window: {} };
vm.runInNewContext(
  await fs.readFile(path.join(root, "catalog.js"), "utf8"),
  context,
);
const screens = context.window.screens;
const browser = await chromium.launch({ headless: true });
const issues = [];
let count = 0;
for (const key of ["a", "b", "c"]) {
  for (const device of ["desktop", "mobile"]) {
    const page = await browser.newPage({
      viewport:
        device === "desktop"
          ? { width: 1280, height: 960 }
          : { width: 390, height: 844 },
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await fs.mkdir(path.join(root, "exports", key, device), {
      recursive: true,
    });
    for (const screen of screens) {
      await page.goto(
        `http://127.0.0.1:4178/screen.html?identity=${key}&screen=${screen.id}`,
        { waitUntil: "networkidle" },
      );
      await page.evaluate(() => document.fonts.ready);
      const layout = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        broken: [...document.images]
          .filter((i) => !i.complete || i.naturalWidth === 0)
          .map((i) => i.src),
        heading: !!document.querySelector("h1"),
        players: [...document.querySelectorAll(".player")].map((p) => ({
          width: p.clientWidth,
          height: p.clientHeight,
        })),
      }));
      if (
        layout.overflow ||
        layout.broken.length ||
        !layout.heading ||
        errors.length
      )
        issues.push({
          key,
          device,
          screen: screen.id,
          ...layout,
          errors: [...errors],
        });
      if (screen.id === "story")
        await page.locator(".story").screenshot({
          path: path.join(root, "exports", key, device, screen.id + ".png"),
        });
      else
        await page.screenshot({
          path: path.join(root, "exports", key, device, screen.id + ".png"),
          fullPage: true,
        });
      count++;
    }
    await page.close();
    console.log(`Exported ${key}/${device}: ${screens.length} screens`);
  }
}
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
await page.goto("http://127.0.0.1:4178/?compare=1", {
  waitUntil: "networkidle",
});
await page.screenshot({
  path: path.join(root, "comparison.png"),
  fullPage: true,
});
await page.getByRole("button", { name: "C / Encore" }).click();
await page.getByRole("button", { name: "Comparar as 3" }).click();
await page.locator("[data-screen=theme]").click();
const frame = page.frameLocator("iframe");
if (!(await frame.locator("#start-game").isDisabled()))
  issues.push({ interaction: "Start must be disabled before mode choice" });
await frame.locator('input[value="16"]').check();
if (await frame.locator("#start-game").isDisabled())
  issues.push({ interaction: "Start must enable after mode choice" });
await frame.locator("#start-game").click();
await frame.getByRole("button", { name: "Votar na música A" }).click();
await frame.getByRole("button", { name: "Cancelar", exact: true }).click();
await frame
  .getByRole("button", { name: "Sortear vencedora", exact: false })
  .click();
await frame
  .getByRole("dialog")
  .getByRole("button", { name: "Sortear vencedora" })
  .click();
await frame.getByRole("heading", { name: "A sorte escolheu." }).waitFor();
await page.locator("[data-screen=import-preview]").click();
await frame.locator(".preview-row input:checked").first().uncheck();
if (
  (await frame.locator("#import-selected").textContent()) !==
  "Importar 2 músicas →"
)
  issues.push({ interaction: "Import count not updated" });
await page.getByRole("button", { name: "Mobile", exact: true }).click();
await page.locator("[data-screen=home]").click();
await page.screenshot({
  path: path.join(root, "gallery-mobile.png"),
  fullPage: true,
});
await fs.writeFile(
  path.join(root, "verification.json"),
  JSON.stringify(
    {
      date: new Date().toISOString(),
      screens: screens.length,
      identities: 3,
      viewports: ["1280×960", "390×844"],
      exports: count,
      issues,
      interactions: [
        "identity switch",
        "comparison toggle",
        "mode selection",
        "vote cancel",
        "tiebreak confirmation",
        "playlist selection",
        "mobile switch",
      ],
    },
    null,
    2,
  ),
);
await browser.close();
console.log(JSON.stringify({ exports: count, issues }));
if (issues.length) process.exitCode = 1;
