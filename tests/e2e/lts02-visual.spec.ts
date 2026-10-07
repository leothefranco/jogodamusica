import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "playwright/test";
import { installLts02YouTube } from "./support/lts02-youtube";
import { decodeGameState } from "../../src/domain/game/transport";

test.use({
  serviceWorkers: "block",
  contextOptions: { reducedMotion: "reduce" },
});
async function setup(page: Page, longNames = false) {
  await page.context().setExtraHTTPHeaders({
    "x-e2e-test": "lts02",
    "x-lts02-fixture": randomUUID(),
    "x-lts02-count": "64",
    "x-lts02-long-names": longNames ? "1" : "0",
    "x-lts02-catalog": "authoritative",
  });
  await installLts02YouTube(page);
  await page.route("**/e2e-test/lts02/thumbnail/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#445664"/></svg>',
    }),
  );
  await page.route("**/api/games{,/**}", async (route) => {
    const url = new URL(route.request().url());
    url.pathname = url.pathname.replace("/api/games", "/e2e-test/lts02/api");
    await route.fulfill({
      response: await route.fetch({ url: url.toString() }),
    });
  });
  await page.route(/\/(tema|jogo|resultado)\//, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/e2e-test/")) return route.continue();
    await route.fulfill({
      status: 307,
      headers: { location: `/e2e-test/lts02${url.pathname}${url.search}` },
    });
  });
}
async function noHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual((await page.viewportSize())!.width);
}
async function start(page: Page) {
  await page.goto("/e2e-test/lts02/tema/noites-de-musica");
  await page.getByRole("radio", { name: /\b4 músicas$/ }).check();
  await page
    .getByRole("button", { name: "Iniciar partida", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Votar na música A" }),
  ).toBeVisible();
  return new URL(page.url()).pathname.split("/").at(-1)!;
}
for (const width of [320, 360, 390, 768, 1280]) {
  test(`Home Tema confronto e nomes longos em ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await setup(page, true);
    await page.goto("/e2e-test/lts02");
    await noHorizontalOverflow(page);
    const encore = page.locator('img[src$="encore-mobile.webp"]');
    await expect(encore).toHaveJSProperty("complete", true);
    expect(
      await encore.evaluate((element) =>
        element instanceof HTMLImageElement ? element.currentSrc : "",
      ),
    ).toContain(width >= 768 ? "encore-desktop.webp" : "encore-mobile.webp");
    const cta = page
      .getByRole("link", { name: "Escolher tema", exact: true })
      .last();
    expect(
      await cta.evaluate((element) => getComputedStyle(element).borderRadius),
    ).toBe("12px");
    await page.screenshot({
      path: info.outputPath(`home-${width}.png`),
      fullPage: true,
    });
    await page.goto("/e2e-test/lts02/tema/noites-de-musica");
    await noHorizontalOverflow(page);
    await expect(page.locator('input[type="radio"]:checked')).toHaveCount(0);
    await page.screenshot({
      path: info.outputPath(`tema-${width}.png`),
      fullPage: true,
    });
    await page.getByRole("radio", { name: /\b4 músicas$/ }).check();
    await page
      .getByRole("button", { name: "Iniciar partida", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Votar na música A" }),
    ).toBeVisible();
    await noHorizontalOverflow(page);
    for (const player of await page.locator(".game-player-host").all()) {
      const rect = (await player.boundingBox())!;
      expect(rect.width).toBeGreaterThanOrEqual(200);
      expect(rect.height).toBeGreaterThanOrEqual(200);
    }
    await page.screenshot({
      path: info.outputPath(`confronto-${width}.png`),
      fullPage: true,
    });
  });
}
test("paisagem e reflow CSS 200% mantêm ações acessíveis; não equivale a zoom nativo", async ({
  page,
}, info) => {
  await setup(page, true);
  await page.setViewportSize({ width: 844, height: 390 });
  await start(page);
  await noHorizontalOverflow(page);
  await page.getByRole("button", { name: "Votar na música A" }).click();
  await expect(
    page.getByRole("dialog", { name: "Confirmar voto" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.screenshot({
    path: info.outputPath("paisagem.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 960 });
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  await noHorizontalOverflow(page);
  await page.getByRole("button", { name: "Votar na música B" }).click();
  await expect(
    page.getByRole("dialog", { name: "Confirmar voto" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  const geometry = await page.locator(".game-song-card").evaluateAll((cards) =>
    cards.map((card) => {
      const bounds = card.getBoundingClientRect();
      const controls = Array.from(
        card.querySelectorAll(".game-player-host,.game-vote"),
      ).map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height,
        };
      });
      return { left: bounds.left, right: bounds.right, controls };
    }),
  );
  for (const card of geometry)
    for (const control of card.controls) {
      expect(control.left).toBeGreaterThanOrEqual(card.left);
      expect(control.right).toBeLessThanOrEqual(card.right);
      expect(control.right).toBeLessThanOrEqual(1280);
    }
  await info.attach("reflow-css-200", {
    body: JSON.stringify(geometry, null, 2),
    contentType: "application/json",
  });
  await page.screenshot({
    path: info.outputPath("css-200.png"),
    fullPage: true,
  });
});
for (const state of ["loading", "offline", "404", "vazio", "continuacao"]) {
  test(`estado público ${state} usa apresentação real e recuperação`, async ({
    page,
  }, info) => {
    await setup(page);
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`/e2e-test/lts02/estado/${state}`);
    await noHorizontalOverflow(page);
    if (state === "loading")
      await expect(page.getByRole("status")).toHaveText("Carregando...");
    if (state === "offline")
      await expect(
        page.getByRole("link", { name: "Tentar novamente" }),
      ).toHaveAttribute("href", "/");
    if (state === "404")
      await expect(
        page.getByRole("link", { name: "Voltar ao início" }),
      ).toHaveAttribute("href", "/");
    if (state === "vazio")
      await expect(
        page.getByText("Ainda não há temas publicados. Volte em breve."),
      ).toBeVisible();
    if (state === "continuacao") {
      await expect(
        page.getByText("Nenhum tema disponível nesta página."),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Próxima página de temas" }),
      ).toHaveAttribute("href", "/?page=2#temas");
    }
    await page.screenshot({
      path: info.outputPath(`estado-${state}.png`),
      fullPage: true,
    });
  });
}
test("vídeo indisponível permite recarregar sem registrar decisão", async ({
  page,
}) => {
  await setup(page);
  await page.route("**/player-errors", (route) =>
    route.fulfill({ status: 204 }),
  );
  const id = await start(page);
  const response = await page.request.get(`/e2e-test/lts02/api/${id}`);
  const before = decodeGameState(await response.json());
  await expect
    .poll(() => page.evaluate(() => window.__youtubeTest.playerVars.length))
    .toBe(2);
  await page.evaluate(() => window.__youtubeTest.emitError(0, 101));
  await expect(
    page.getByRole("article").first().getByRole("alert"),
  ).toContainText("Tente novamente");
  await expect(
    page.getByRole("button", { name: "Votar na música A" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Recarregar os vídeos" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Recarregar os vídeos" }).click();
  await expect(
    page.getByRole("button", { name: "Votar na música A" }),
  ).toBeVisible();
  expect(
    decodeGameState(
      await (await page.request.get(`/e2e-test/lts02/api/${id}`)).json(),
    ),
  ).toEqual(before);
  await expect(page.locator('.game-player-feedback[role="alert"]')).toHaveCount(
    0,
  );
});
test("CTA por Tab mostra foco e contraste medidos", async ({ page }, info) => {
  await setup(page);
  await page.goto("/e2e-test/lts02");
  const cta = page
    .getByRole("link", { name: "Escolher tema", exact: true })
    .last();
  for (
    let index = 0;
    index < 12 &&
    !(await cta.evaluate((element) => element === document.activeElement));
    index++
  )
    await page.keyboard.press("Tab");
  await expect(cta).toBeFocused();
  const colors = await cta.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      outline: style.outlineColor,
      outlineWidth: style.outlineWidth,
      offset: style.outlineOffset,
      text: style.color,
      background: style.backgroundColor,
      page: getComputedStyle(document.querySelector("main")!).backgroundColor,
    };
  });
  function luminance(color: string) {
    const channels = (color.match(/\d+/g) ?? [])
      .slice(0, 3)
      .map(Number)
      .map((value) => {
        const channel = value / 255;
        return channel <= 0.04045
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4;
      });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  }
  function contrast(a: string, b: string) {
    const values = [luminance(a), luminance(b)].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
  }
  expect(colors.outlineWidth).toBe("3px");
  expect(contrast(colors.outline, colors.page)).toBeGreaterThanOrEqual(3);
  expect(contrast(colors.text, colors.background)).toBeGreaterThanOrEqual(4.5);
  await info.attach("focus-contrast", {
    body: JSON.stringify(
      {
        colors,
        outlineContrast: contrast(colors.outline, colors.page),
        textContrast: contrast(colors.text, colors.background),
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
  await page.screenshot({
    path: info.outputPath("cta-tab.png"),
    fullPage: true,
  });
});
