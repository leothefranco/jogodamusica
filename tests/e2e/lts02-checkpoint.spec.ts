import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { expect, test } from "playwright/test";

// Only external boundaries are simulated: YouTube SDK, image delivery and DB.
// Creation, bracket transitions, snapshots and projections use product services.
test.use({
  serviceWorkers: "block",
  viewport: { width: 390, height: 844 },
  contextOptions: { reducedMotion: "reduce" },
});
test("C/Encore: quatro músicas, três decisões e repetição preservada", async ({
  page,
}, testInfo) => {
  await page.context().setExtraHTTPHeaders({
    "x-e2e-test": "lts02",
    "x-lts02-fixture": randomUUID(),
  });
  const sdkSource = readFileSync("tests/e2e/two-players.spec.ts", "utf8");
  const sdk = sdkSource.match(
    /await page\.addInitScript\((\(\) => \{[\s\S]*?)\r?\n  \}\);/,
  );
  if (!sdk) throw new Error("External SDK fixture unavailable");
  await page.addInitScript({
    content: ts.transpile(`(${sdk[1]}\n})()`, {
      target: ts.ScriptTarget.ES2020,
    }),
  });
  await page.route("**/e2e-test/lts02/thumbnail/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#445664"/></svg>',
    }),
  );
  await page.route("**/api/resultados/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1600"><rect width="900" height="1600" fill="#101216"/></svg>',
    }),
  );
  let decisions = 0;
  await page.route("**/api/games{,/**}", async (route) => {
    if (route.request().url().endsWith("/decision")) decisions++;
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
  await page.goto("/e2e-test/lts02");
  const encore = page.locator('img[src$="encore-mobile.webp"]');
  await expect(encore).toBeVisible();
  await expect(encore).toHaveJSProperty("complete", true);
  await page.screenshot({
    path: testInfo.outputPath("home-390.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 960 });
  await page.screenshot({
    path: testInfo.outputPath("home-1280.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("link", { name: /Noites de música/ }).click();
  const four = page.getByRole("radio", { name: /4 músicas/ });
  await expect(four).not.toBeChecked();
  await four.check();
  await expect(
    page.getByRole("button", { name: "Iniciar partida", exact: true }),
  ).toBeEnabled();
  await page.screenshot({
    path: testInfo.outputPath("tema-390.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Iniciar partida", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Votar na música A" }),
  ).toBeVisible();
  const sessionId = new URL(page.url()).pathname.split("/").at(-1)!;
  const layout = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    scrollHeight: document.documentElement.scrollHeight,
    scrollWidth: document.documentElement.scrollWidth,
    players: Array.from(document.querySelectorAll(".game-player-host")).map(
      (element) => {
        const rect = element.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      },
    ),
    votes: Array.from(document.querySelectorAll(".game-vote")).map(
      (element) => element.getBoundingClientRect().height,
    ),
  }));
  expect(layout.scrollHeight).toBeLessThanOrEqual(845);
  expect(layout.scrollWidth).toBeLessThanOrEqual(390);
  expect(layout.players).toHaveLength(2);
  for (const player of layout.players) {
    expect(player.width).toBeGreaterThanOrEqual(200);
    expect(player.height).toBeGreaterThanOrEqual(200);
  }
  for (const height of layout.votes) expect(height).toBeGreaterThanOrEqual(48);
  await testInfo.attach("layout-390", {
    body: JSON.stringify(layout, null, 2),
    contentType: "application/json",
  });
  await page.evaluate(() => {
    window.__youtubeTest.emitState(0, 1);
    window.__youtubeTest.emitState(1, 1);
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.__youtubeTest.calls.filter(
            (call) => call.player === 0 && call.method === "pause",
          ).length,
      ),
    )
    .toBeGreaterThan(0);

  await page.screenshot({
    path: testInfo.outputPath("jogo-390.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Votar na música A" }).click();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  expect(decisions).toBe(0);
  for (let index = 0; index < 3; index++) {
    await page.getByRole("button", { name: "Votar na música A" }).click();
    await page
      .getByRole("button", { name: "Confirmar voto", exact: true })
      .click();
    if (index === 1) {
      await expect(
        page.getByRole("heading", { name: "Grande final" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Ir para a final" }).click();
    }
  }
  await expect(
    page.getByRole("heading", { name: "Chaveamento completo" }),
  ).toBeVisible();
  expect(decisions).toBe(3);
  await expect(page.locator("article")).toHaveCount(3);
  const completed = await (
    await page.request.get(`/e2e-test/lts02/api/${sessionId}`)
  ).json();
  expect(completed.session.status).toBe("completed");
  expect(completed.songs).toHaveLength(4);
  expect(completed.progress.completedMatches).toBe(3);
  const champion = completed.songs.find(
    (song: { songId: string }) =>
      song.songId === completed.session.championSongId,
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    champion.title,
  );
  await expect(
    page.getByRole("link", { name: "Baixar imagem" }),
  ).toHaveAttribute("href", `/api/resultados/${sessionId}/imagem?download=1`);
  await page.screenshot({
    path: testInfo.outputPath("resultado-390.png"),
    fullPage: true,
  });
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    champion.title,
  );
  await page.getByRole("link", { name: "Jogar novamente" }).click();
  await four.check();
  await page
    .getByRole("button", { name: "Iniciar partida", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Votar na música A" }),
  ).toBeVisible();
  expect(new URL(page.url()).pathname.split("/").at(-1)).not.toBe(sessionId);
  expect(
    await (await page.request.get(`/e2e-test/lts02/api/${sessionId}`)).json(),
  ).toEqual(completed);
});
