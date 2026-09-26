import { expect, test } from "playwright/test";

test.use({ serviceWorkers: "block" });

test("API e slugs ocultos preservam a allowlist e o estado genérico", async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({ "x-e2e-test": "authoritative-catalog" });
  const response = await page.request.get(
    "/e2e-test/authoritative-catalog/api?page=2&region=US&mode=legacy_guardrail",
    { headers: { "x-e2e-test": "authoritative-catalog" } },
  );
  const data = await response.json();
  expect(data.themes).toHaveLength(1);
  expect(data.themes[0]).toMatchObject({
    name: "Tema direto 64",
    activeSongCount: 64,
    supportedBracketSizes: [4, 8, 16, 32, 64],
  });
  expect(Object.keys(data.themes[0]).sort()).toEqual([
    "activeSongCount",
    "coverUrl",
    "description",
    "id",
    "modeGroups",
    "name",
    "slug",
    "supportedBracketSizes",
    "thumbnailUrls",
  ]);
  for (const slug of ["direto-3", "direto-128", "inexistente"]) {
    await page.goto(`/e2e-test/authoritative-catalog/tema/${slug}`);
    await expect(
      page.getByRole("heading", { name: "Não encontramos esta página" }),
    ).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Origem privada");
    await expect(page.locator("body")).not.toContainText("10000000-0000");
    await expect(page.getByRole("radio")).toHaveCount(0);
  }
});

for (const width of [390, 1280]) {
  test(`home autoritativa ${width}px → próxima página → Tema mantém modalidades e não inicia CAT06`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.setExtraHTTPHeaders({ "x-e2e-test": "authoritative-catalog" });
    const errors: string[] = [];
    const gameRequests: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/games**", (route) => {
      gameRequests.push(route.request().url());
      return route.abort();
    });
    await page.route(/\/tema\/[^/?]+(?:\?.*)?$/, async (route) => {
      const url = new URL(route.request().url());
      url.pathname = `/e2e-test/authoritative-catalog${url.pathname}`;
      await route.fulfill({
        response: await route.fetch({ url: url.toString() }),
      });
    });
    await page.route(/\/\?page=\d+.*$/, async (route) => {
      const url = new URL(route.request().url());
      url.pathname = "/e2e-test/authoritative-catalog";
      await route.fulfill({
        response: await route.fetch({ url: url.toString() }),
      });
    });
    await page.goto("/e2e-test/authoritative-catalog");
    await expect(
      page.getByRole("link", { name: "Próxima página de temas" }),
    ).toBeVisible();
    await expect(
      page.getByText("Nenhum tema disponível nesta página."),
    ).toBeVisible();
    await page.getByRole("link", { name: "Próxima página de temas" }).click();
    const card = page.getByRole("link", { name: /Tema direto 64/ });
    await expect(card).toContainText("64 músicas");
    await expect(card.locator("img")).toHaveCount(4);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: testInfo.outputPath("home-cat05.png"),
      fullPage: true,
    });
    await card.click();
    await expect(
      page.getByRole("heading", { name: "Tema direto 64", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Principais" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Rápidas" })).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(5);
    await expect(page.getByRole("radio", { name: /64 músicas/ })).toBeVisible();
    await expect(page.getByRole("radio", { name: /128 músicas/ })).toHaveCount(
      0,
    );
    await page.getByRole("radio", { name: /32 músicas/ }).check();
    await expect(
      page.getByRole("button", { name: "Iniciar partida" }),
    ).toBeEnabled();
    await page.screenshot({
      path: testInfo.outputPath("tema-cat05.png"),
      fullPage: true,
    });
    expect(gameRequests).toEqual([]);
    expect(errors).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  });
}
