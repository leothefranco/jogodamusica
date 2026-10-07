import { expect, test } from "playwright/test";
test.use({ serviceWorkers: "block" });
for (const size of [32, 64]) {
  test(`home autoritativa → Tema → escolha explícita → sessão ${size} persistida`, async ({
    page,
  }) => {
    await page.setExtraHTTPHeaders({ "x-e2e-test": "authoritative-catalog" });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route(/\/(tema|jogo)\/[^/?]+(?:\?.*)?$/, async (route) => {
      const url = new URL(route.request().url());
      url.pathname = `/e2e-test/authoritative-catalog${url.pathname}`;
      await route.fulfill({
        response: await route.fetch({ url: url.toString() }),
      });
    });
    await page.route("**/api/games", async (route) => {
      const url = new URL(route.request().url());
      url.pathname = "/e2e-test/authoritative-catalog/games";
      await route.fulfill({
        response: await route.fetch({ url: url.toString() }),
      });
    });
    await page.goto("/e2e-test/authoritative-catalog?page=2");
    await page.getByRole("link", { name: /Tema direto 64/ }).click();
    await expect(
      page.getByRole("heading", { name: "Principais" }),
    ).toBeVisible();
    await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Escolha uma modalidade" }),
    ).toBeDisabled();
    await page
      .getByRole("radio", { name: new RegExp(`${size} músicas`) })
      .check();
    const response = page.waitForResponse(
      (r) => r.url().endsWith("/api/games") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Iniciar partida" }).click();
    expect((await response).status()).toBe(201);
    await expect(
      page.getByRole("heading", { name: "Partida criada" }),
    ).toBeVisible();
    await expect(page.getByTestId("bracket-size")).toHaveText(String(size));
    await expect(page.getByTestId("snapshot-count")).toHaveText(String(size));
    await expect(page.getByTestId("match-count")).toHaveText(String(size - 1));
    await expect(page.getByTestId("snapshot-distinct")).toHaveText(
      String(size),
    );
    await page.reload();
    await expect(page.getByTestId("snapshot-count")).toHaveText(String(size));
    expect(errors).toEqual([]);
  });
}
