import { expect, test } from "playwright/test";

type CatalogAttempt = {
  request: { themeId: string; bracketSize: number };
  status: number;
  snapshotSongIds: string[];
};

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-e2e-test": "public-catalog" });
});

test("slug com três candidatas mostra somente o estado genérico", async ({
  page,
}) => {
  const playableResponse = await page.goto(
    "/e2e-test/public-catalog/tema-do-tracer",
  );
  expect(playableResponse?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Tema do tracer" }),
  ).toBeVisible();

  const response = await page.goto("/e2e-test/public-catalog/tema-legado-tres");

  expect(response).not.toBeNull();
  await expect(
    page.getByRole("heading", { name: "Esta faixa saiu do catálogo" }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText("3 músicas");
  await expect(page.locator("body")).not.toContainText(
    "10000000-0000-4000-8000-000000000003",
  );
  await expect(page.locator("body")).not.toContainText("theme_songs");
});

test("home → Tema → POST limita a modalidade ao snapshot atual", async ({
  page,
}) => {
  const attempts: CatalogAttempt[] = [];
  await page.route("**/api/games", async (route) => {
    const fixtureUrl = new URL(
      "/e2e-test/public-catalog/api",
      route.request().url(),
    );
    const response = await route.fetch({ url: fixtureUrl.toString() });
    const payload = (await response.json()) as {
      e2eSnapshotSongIds?: string[];
    };
    attempts.push({
      request: route.request().postDataJSON() as CatalogAttempt["request"],
      status: response.status(),
      snapshotSongIds: payload.e2eSnapshotSongIds ?? [],
    });
    await route.fulfill({ response, json: payload });
  });

  await page.goto("/e2e-test/public-catalog");
  await expect(page.getByText("Tema legado três")).toHaveCount(0);
  await page.getByRole("link", { name: /Tema do tracer/ }).click();

  await expect(page.getByRole("radio", { name: /4 músicas/ })).toBeVisible();
  await expect(page.getByRole("radio", { name: /8 músicas/ })).toBeVisible();
  await page.getByRole("radio", { name: /8 músicas/ }).check();
  await page.getByRole("button", { name: "Iniciar partida" }).click();

  await expect.poll(() => attempts).toHaveLength(1);
  expect(attempts[0]).toEqual({
    request: {
      themeId: "10000000-0000-4000-8000-000000000008",
      bracketSize: 8,
    },
    status: 409,
    snapshotSongIds: [],
  });
  await expect(
    page.getByRole("alert").filter({
      hasText: "não possui músicas ativas suficientes",
    }),
  ).toBeVisible();

  await page.getByRole("radio", { name: /4 músicas/ }).check();
  await page.getByRole("button", { name: "Iniciar partida" }).click();

  await expect.poll(() => attempts).toHaveLength(2);
  expect(attempts[1]).toMatchObject({
    request: {
      themeId: "10000000-0000-4000-8000-000000000008",
      bracketSize: 4,
    },
    status: 201,
  });
  expect(attempts[1].snapshotSongIds).toEqual([
    "20000000-0000-4000-8000-000000000001",
    "20000000-0000-4000-8000-000000000002",
    "20000000-0000-4000-8000-000000000003",
    "20000000-0000-4000-8000-000000000004",
  ]);
  await expect(page).toHaveURL(/\/e2e-test\/public-catalog\?created=1$/);
  await expect(
    page.getByText("Partida criada com quatro snapshots"),
  ).toBeVisible();
});
