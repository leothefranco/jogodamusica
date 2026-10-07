import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "playwright/test";
import { installLts02YouTube } from "./support/lts02-youtube";

test.use({
  serviceWorkers: "block",
  contextOptions: { reducedMotion: "reduce" },
});

async function setup(page: Page, busyResponse?: Promise<void>) {
  await page.context().setExtraHTTPHeaders({
    "x-e2e-test": "lts02",
    "x-lts02-fixture": randomUUID(),
    "x-lts02-count": "64",
    "x-lts02-catalog": "authoritative",
  });
  await installLts02YouTube(page);
  await page.route("**/e2e-test/lts02/thumbnail/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#445664"/></svg>',
    }),
  );
  const posts: { status: number; body: unknown }[] = [];
  await page.route("**/api/games", async (route) => {
    const url = new URL(route.request().url());
    url.pathname = "/e2e-test/lts02/api";
    if (busyResponse && posts.length === 0) {
      await busyResponse;
      const body = {
        error: {
          code: "CATALOG_BUSY",
          message: "O catálogo está sendo atualizado. Tente novamente.",
          fieldErrors: null,
        },
      };
      posts.push({ status: 409, body });
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
      return;
    }
    const response = await route.fetch({ url: url.toString() });
    posts.push({ status: response.status(), body: await response.json() });
    await route.fulfill({ response });
  });
  await page.route(/\/(tema|jogo)\//, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/e2e-test/")) return route.continue();
    await route.fulfill({
      status: 307,
      headers: { location: `/e2e-test/lts02${url.pathname}${url.search}` },
    });
  });
  return posts;
}

test("Tema obsoleto rejeita sem persistir, anuncia erro e exige atualizar e escolher novamente", async ({
  page,
}, testInfo) => {
  const posts = await setup(page);
  await page.goto("/e2e-test/lts02/tema/noites-de-musica");
  await expect(page.locator('input[type="radio"]:checked')).toHaveCount(0);
  await page.getByRole("radio", { name: "6 rodadas 64 músicas" }).check();
  const changed = await page.request.post("/e2e-test/lts02/api/availability", {
    data: { count: 16 },
  });
  expect(changed.ok()).toBe(true);
  await page
    .getByRole("button", { name: "Iniciar partida", exact: true })
    .click();
  const alert = page
    .getByRole("alert")
    .filter({ hasText: "Este tema não está disponível" });
  await expect(alert).toContainText(
    "Este tema não está disponível para esta modalidade.",
  );
  expect(posts).toHaveLength(1);
  expect(posts[0]).toMatchObject({
    status: 409,
    body: { error: { code: "INSUFFICIENT_ACTIVE_SONGS" } },
  });
  expect(
    await (await page.request.get("/e2e-test/lts02/api/diagnostics")).json(),
  ).toEqual({ sessions: 0, snapshots: 0, matches: 0 });
  await expect(alert).toBeFocused();
  await page.screenshot({
    path: testInfo.outputPath("stale-theme-error.png"),
    fullPage: true,
  });
  await expect(
    page.getByRole("button", { name: "Iniciar partida", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Atualizar modalidades" }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("O tema tem 16 músicas disponíveis.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(3);
  await expect(
    page.getByRole("radio", { name: "6 rodadas 64 músicas" }),
  ).toHaveCount(0);
  await expect(page.locator('input[type="radio"]:checked')).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Escolha uma modalidade" }),
  ).toBeDisabled();
  expect(posts).toHaveLength(1);
  await page.screenshot({
    path: testInfo.outputPath("updated-modes.png"),
    fullPage: true,
  });
  await page.getByRole("radio", { name: "4 rodadas 16 músicas" }).check();
  await page
    .getByRole("button", { name: "Iniciar partida", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Votar na música A" }),
  ).toBeVisible();
  expect(posts).toHaveLength(2);
  expect(posts[1].status).toBe(201);
  expect(
    await (await page.request.get("/e2e-test/lts02/api/diagnostics")).json(),
  ).toEqual({ sessions: 1, snapshots: 16, matches: 15 });
  await testInfo.attach("http-creation", {
    body: JSON.stringify(posts, null, 2),
    contentType: "application/json",
  });
});

test("catálogo ocupado mantém escolha, bloqueia durante loading e só tenta novamente por teclado", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let release = () => {};
  const responseReady = new Promise<void>((resolve) => {
    release = resolve;
  });
  const posts = await setup(page, responseReady);
  await page.goto("/e2e-test/lts02/tema/noites-de-musica");
  await page.getByRole("radio", { name: "5 rodadas 32 músicas" }).check();
  await page
    .getByRole("button", { name: "Iniciar partida", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Preparando chave..." }),
  ).toBeDisabled();
  for (const radio of await page.getByRole("radio").all())
    await expect(radio).toBeDisabled();
  await page.screenshot({
    path: testInfo.outputPath("loading-mobile.png"),
    fullPage: true,
  });
  release();
  const alert = page
    .getByRole("alert")
    .filter({ hasText: "O catálogo está sendo atualizado." });
  await expect(alert).toBeFocused();
  await expect(
    page.getByRole("radio", { name: "5 rodadas 32 músicas" }),
  ).toBeChecked();
  const retry = page.getByRole("button", {
    name: "Tentar novamente",
    exact: true,
  });
  await expect(retry).toBeEnabled();
  expect(posts).toHaveLength(1);
  expect(
    await (await page.request.get("/e2e-test/lts02/api/diagnostics")).json(),
  ).toEqual({ sessions: 0, snapshots: 0, matches: 0 });
  await page.screenshot({
    path: testInfo.outputPath("busy-mobile.png"),
    fullPage: true,
  });
  await retry.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Votar na música A" }),
  ).toBeVisible();
  expect(posts.map((post) => post.status)).toEqual([409, 201]);
  expect(
    await (await page.request.get("/e2e-test/lts02/api/diagnostics")).json(),
  ).toEqual({ sessions: 1, snapshots: 32, matches: 31 });
  await testInfo.attach("http-creation", {
    body: JSON.stringify(posts, null, 2),
    contentType: "application/json",
  });
});

test("tema que cai abaixo de quatro músicas desaparece após atualização deliberada", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const posts = await setup(page);
  await page.goto("/e2e-test/lts02/tema/noites-de-musica");
  await page.getByRole("radio", { name: "2 rodadas 4 músicas" }).check();
  expect(
    (
      await page.request.post("/e2e-test/lts02/api/availability", {
        data: { count: 3 },
      })
    ).ok(),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Iniciar partida", exact: true })
    .click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Este tema não está disponível" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Atualizar modalidades" }).click();
  await expect(
    page.getByRole("heading", { name: "Não encontramos esta página" }),
  ).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(0);
  expect(posts.map((post) => post.status)).toEqual([409]);
  expect(
    await (await page.request.get("/e2e-test/lts02/api/diagnostics")).json(),
  ).toEqual({ sessions: 0, snapshots: 0, matches: 0 });
  await page.screenshot({
    path: testInfo.outputPath("unavailable-theme-mobile.png"),
    fullPage: true,
  });
});
