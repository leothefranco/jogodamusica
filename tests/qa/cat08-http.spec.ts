import { expect, test } from "playwright/test";

test("Next real propaga saúde, invalida destinos e recupera ambos os Temas", async ({
  page,
  request,
}) => {
  const externalRequests: string[] = [];
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame())
      console.log("[cat08-navigation]", frame.url());
  });
  page.on("pageerror", (error) =>
    console.log("[cat08-pageerror]", error.message),
  );
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      /googleapis\.com$|(^|\.)youtube\.com$|youtube-nocookie\.com$/.test(
        url.hostname,
      )
    )
      externalRequests.push(url.hostname);
  });
  const route = "/e2e-test/global-health";
  // The installed Next not-found guide specifies HTTP 200 for streamed
  // responses under loading.tsx. Verify denial in the rendered UI.
  await page.goto(route);
  await expect(
    page.getByRole("heading", {
      name: "Não encontramos esta página",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Indisponibilizar Fonte" }),
  ).toHaveCount(0);
  await expect(page.getByTestId("provider-count")).toHaveCount(0);
  await page.setExtraHTTPHeaders({ "x-e2e-test": "cat08-global-health" });
  await page.goto(route);
  await expect(page.getByTestId("provider-count")).toHaveText("0");
  for (const index of [0, 1])
    await expect(page.getByTestId(`theme-state-${index}`)).toHaveText(
      "published visible healthy 4",
    );
  // Warm actual routes in the same client router before the Server Action.
  for (const index of [0, 1]) {
    await page
      .getByRole("link", { name: `Tema ${index}`, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/tema/cat08-${index}$`));
    await expect(
      page.getByRole("heading", { name: `CAT08 Tema ${index}`, exact: true }),
    ).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/e2e-test\/global-health$/);
    await expect(
      page.getByRole("button", { name: "Indisponibilizar Fonte" }),
    ).toBeVisible();
  }
  await page.getByRole("link", { name: "Catálogo", exact: true }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3182/");
  for (const index of [0, 1])
    await expect(
      page.locator(`a[href="/tema/cat08-${index}"]`).first(),
    ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/e2e-test\/global-health$/);
  await page.getByRole("button", { name: "Indisponibilizar Fonte" }).click();
  for (const index of [0, 1])
    await expect(page.getByTestId(`theme-state-${index}`)).toHaveText(
      "published hidden suspended_insufficient_healthy_entries 3",
    );
  for (const index of [0, 1])
    await expect(page.getByTestId(`projection-state-${index}`)).toHaveText(
      "published hidden suspended_insufficient_healthy_entries 3",
    );
  await expect(page.getByTestId("provider-count")).toHaveText("1");
  await expect(page.getByTestId("outbox-total")).toHaveText("2");
  await expect(page.getByTestId("outbox-pending")).toHaveText("0");
  await page.getByRole("link", { name: "Catálogo", exact: true }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3182/");
  for (const index of [0, 1]) {
    await expect(page.locator(`a[href="/tema/cat08-${index}"]`)).toHaveCount(0);
    const denied = await request.get(`/tema/cat08-${index}`);
    expect([200, 404]).toContain(denied.status());
    const deniedHtml = await denied.text();
    expect(deniedHtml).toContain("Não encontramos esta página");
    expect(deniedHtml).toContain("noindex");
    expect(deniedHtml).not.toContain(`CAT08 Tema ${index}`);
  }
  await page.goBack();
  await expect(page).toHaveURL(/\/e2e-test\/global-health$/);
  await page.getByRole("button", { name: "Recuperar Fonte" }).click();
  for (const index of [0, 1])
    await expect(page.getByTestId(`theme-state-${index}`)).toHaveText(
      "published visible healthy 4",
    );
  for (const index of [0, 1])
    await expect(page.getByTestId(`projection-state-${index}`)).toHaveText(
      "published visible healthy 4",
    );
  await expect(page.getByTestId("provider-count")).toHaveText("2");
  await expect(page.getByTestId("outbox-total")).toHaveText("4");
  await expect(page.getByTestId("outbox-pending")).toHaveText("0");
  await page.getByRole("link", { name: "Catálogo", exact: true }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3182/");
  for (const index of [0, 1]) {
    const link = page.locator(`a[href="/tema/cat08-${index}"]`).first();
    await expect(link).toBeVisible();
    expect((await request.get(`/tema/cat08-${index}`)).status()).toBe(200);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/tema/cat08-${index}$`));
    await expect(
      page.getByRole("heading", { name: `CAT08 Tema ${index}`, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Não encontramos esta página",
        exact: true,
      }),
    ).toHaveCount(0);
    await page.goBack();
    await expect(page).toHaveURL("http://127.0.0.1:3182/");
  }
  expect(externalRequests).toEqual([]);
});

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) {
    await testInfo.attach("failure-url", {
      body: page.url(),
      contentType: "text/plain",
    });
    await testInfo.attach("failure-dom", {
      body: await page.content(),
      contentType: "text/html",
    });
    await testInfo.attach("failure-screen", {
      body: await page.screenshot(),
      contentType: "image/png",
    });
  }
});
