import { expect, test, type Locator } from "playwright/test";

// Keep every navigation/image request visible to the isolated HTTP fixtures.
test.use({ serviceWorkers: "block" });

const imageBody =
  '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" fill="#526779"/></svg>';

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-e2e-test": "ui-complete" });
  await page.route("**/api/**", (route) => route.abort());
  await page.route("**/e2e-images/**", (route) =>
    route.fulfill({ contentType: "image/svg+xml", body: imageBody }),
  );
  await page.route("**/api/resultados/*/imagem*", (route) =>
    route.fulfill({ contentType: "image/svg+xml", body: imageBody }),
  );
});

async function expectRadius(locator: Locator, min: number, max: number) {
  await expect(locator).toBeVisible();
  const radius = await locator.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).borderTopLeftRadius),
  );
  expect(radius).toBeGreaterThanOrEqual(min);
  expect(radius).toBeLessThanOrEqual(max);
}

for (const width of [390, 1280]) {
  test(`inventário real de controles administrativos em${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    const track = {
      provider: "youtube",
      providerContentId: "video-fixture",
      sourceTitle: "Música da fixture",
      sourceChannel: "Canal controlado",
      durationSeconds: 120,
      thumbnailUrl: "/e2e-images/thumb-1.png",
      isEmbeddable: true,
      embedUrl: "https://www.youtube.com/embed/video-fixture",
      watchUrl: "https://www.youtube.com/watch?v=video-fixture",
    };
    await page.route("**/embed/**", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<title>Player externo simulado</title>",
      }),
    );
    await page.route("**/api/admin/youtube/search?**", (route) =>
      route.fulfill({ json: { data: [track] } }),
    );
    await page.route("**/api/admin/youtube/playlists/preview", (route) =>
      route.fulfill({
        json: {
          data: {
            previewId: "preview-ui",
            playlistTitle: "Playlist controlada",
            positionsScanned: 1,
            uniqueVideoCount: 1,
            duplicateCount: 0,
            isTruncated: false,
            items: [
              {
                position: 1,
                providerContentId: track.providerContentId,
                status: "ready",
                track,
              },
            ],
          },
        },
      }),
    );
    await page.route("**/api/admin/youtube/playlists/import", (route) =>
      route.fulfill({
        status: 503,
        json: { error: { message: "Falha controlada na importação" } },
      }),
    );
    await page.goto("/e2e-test/ui-complete?screen=controls");
    await page
      .getByRole("textbox", { name: "Pesquisar no YouTube" })
      .fill("Música");
    await page.getByRole("button", { name: "Pesquisar", exact: true }).click();
    await page.getByRole("button", { name: /Música da fixture/ }).click();
    await expect(page.getByTitle("Prévia de Música da fixture")).toBeVisible();
    expect(
      await page
        .getByTitle("Prévia de Música da fixture")
        .evaluate(
          (element) => getComputedStyle(element.parentElement!).borderRadius,
        ),
    ).toBe("0px");
    await page
      .getByRole("textbox", { name: "URL ou ID da playlist" })
      .fill("playlist-fixture");
    await page.getByRole("button", { name: "Gerar prévia" }).click();
    await expect(
      page.getByRole("heading", { name: "Playlist controlada" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Desmarcar todos" }).click();
    await expect(
      page.getByRole("button", { name: "Confirmar importação" }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Selecionar prontos" }).click();
    await page.getByRole("button", { name: "Confirmar importação" }).click();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Falha controlada na importação" }),
    ).toBeVisible();
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("button", { name: "Remover fixture" }).click();
    await expect(page.getByRole("status")).toHaveText("Não enviado");
    const controls = page.locator(
      'main button, main input:not([type="hidden"]):not([type="checkbox"]), main textarea, main select',
    );
    for (const control of await controls.all())
      await expectRadius(control, 12, 14);
    const panels = page.locator("main .rounded-2xl");
    expect(await panels.count()).toBeGreaterThanOrEqual(6);
    for (const panel of await panels.all()) await expectRadius(panel, 18, 20);
    const field = page.getByRole("textbox", { name: "Título exibido" });
    await field.focus();
    await expect(field).toBeFocused();
    expect(
      await field.evaluate((element) => getComputedStyle(element).boxShadow),
    ).not.toBe("none");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({
      path: testInfo.outputPath("admin-controls.png"),
      fullPage: true,
    });
    await testInfo.attach("radii", {
      body: JSON.stringify(
        await controls.evaluateAll((elements) =>
          elements.map((element) => ({
            text: element.getAttribute("name") ?? element.textContent,
            radius: getComputedStyle(element).borderRadius,
          })),
        ),
      ),
      contentType: "application/json",
    });
  });

  test(`login, estados e instalação preservam superfícies em${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/admin/login");
    for (const control of await page
      .locator('input:not([type="hidden"]),button[type="submit"]')
      .all())
      await expectRadius(control, 12, 14);
    await page.screenshot({
      path: testInfo.outputPath("login.png"),
      fullPage: true,
    });
    await page.goto("/offline");
    await expectRadius(
      page.getByRole("link", { name: "Tentar novamente" }),
      12,
      14,
    );
    await page.screenshot({
      path: testInfo.outputPath("offline.png"),
      fullPage: true,
    });
    await page.evaluate(() => {
      const event = new Event("beforeinstallprompt", { cancelable: true });
      Object.defineProperty(event, "prompt", { value: async () => undefined });
      Object.defineProperty(event, "userChoice", {
        value: Promise.resolve({ outcome: "dismissed" }),
      });
      window.dispatchEvent(event);
    });
    const banner = page.getByRole("complementary", {
      name: "Instalar aplicativo",
      exact: true,
    });
    await expectRadius(banner, 18, 20);
    for (const button of await banner.getByRole("button").all())
      await expectRadius(button, 12, 14);
    await page.screenshot({
      path: testInfo.outputPath("pwa.png"),
      fullPage: true,
    });
    await banner
      .getByRole("button", { name: "Fechar instrução de instalação" })
      .click();
    await expect(banner).toHaveCount(0);
    await page.goto("/e2e-test/ui-complete?screen=theme");
    for (const label of await page.locator("label").all())
      await expectRadius(label, 12, 14);
    await expectRadius(
      page.getByRole("button", { name: "Escolha uma modalidade" }),
      12,
      14,
    );
    await page.getByRole("radio").check();
    await expect(
      page.getByRole("button", { name: "Iniciar partida" }),
    ).toBeEnabled();
    await page.screenshot({
      path: testInfo.outputPath("theme.png"),
      fullPage: true,
    });
    await expectRadius(page.locator("fieldset").locator(".."), 18, 20);
    await page.goto("/e2e-test/ui-complete-missing");
    await expect(
      page.getByRole("heading", { name: "Não encontramos esta página" }),
    ).toBeVisible();
    await expectRadius(
      page.getByRole("link", { name: "Voltar ao início" }),
      12,
      14,
    );
    await page.screenshot({
      path: testInfo.outputPath("not-found.png"),
      fullPage: true,
    });
  });
}

for (const width of [320, 360, 390, 1280, 1440]) {
  for (const count of [0, 1, 3, 4]) {
    test(`capas estáveis ${count} em${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 844 });
      const requests: string[] = [];
      await page.route("**/e2e-images/**", (route) => {
        requests.push(new URL(route.request().url()).pathname);
        return route.fulfill({ contentType: "image/svg+xml", body: imageBody });
      });
      await page.goto(`/e2e-test/ui-complete?count=${count}&duplicate=1`);
      const card = page.locator('a[href="/tema/ui-capas"]');
      const slots = card.locator("[data-theme-visual] > span");
      await expect(slots).toHaveCount(4);
      await expect(slots.locator("img")).toHaveCount(count);
      const srcs = await slots
        .locator("img")
        .evaluateAll((images) =>
          images.map((image) => image.getAttribute("src")),
        );
      expect(srcs).toEqual(
        Array.from(
          { length: count },
          (_, index) => `/e2e-images/thumb-${index + 1}.png`,
        ),
      );
      const boxes = await slots.evaluateAll((elements) =>
        elements.map((element) => element.getBoundingClientRect().toJSON()),
      );
      for (const [index, box] of boxes.entries()) {
        expect(box.width).toBeGreaterThanOrEqual(48);
        expect(box.width).toBeCloseTo(box.height, 0);
        if (index)
          expect(box.x - boxes[index - 1].right).toBeGreaterThanOrEqual(8);
        expect(box.y).toBeCloseTo(boxes[0].y, 0);
        await expectRadius(slots.nth(index), 8, 8);
      }
      const titleBox = await card.getByRole("heading").boundingBox();
      expect(titleBox!.y + titleBox!.height).toBeLessThanOrEqual(boxes[0].top);
      await expectRadius(card, 18, 20);
      expect(requests.some((path) => path.includes("cover"))).toBe(false);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      await card.focus();
      await expect(card).toBeFocused();
      await page.screenshot({
        path: testInfo.outputPath("catalog.png"),
        fullPage: true,
      });
      await testInfo.attach("slots", {
        body: JSON.stringify(boxes),
        contentType: "application/json",
      });
    });
  }
}

test("falha não move posições, repete músicas ou muda a precedência fora do catálogo", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let releaseFailure!: () => void;
  const failed = new Promise<void>((resolve) => {
    releaseFailure = resolve;
  });
  let failures = 0;
  await page.route("**/e2e-images/thumb-2.png", async (route) => {
    failures += 1;
    await failed;
    await route.fulfill({ status: 404 });
  });
  await page.goto("/e2e-test/ui-complete?count=4", {
    waitUntil: "domcontentloaded",
  });
  const slots = page.locator('[data-theme-visual="catalog"] > span');
  await expect(slots).toHaveCount(4);
  const before = await slots.evaluateAll((elements) =>
    elements.map((element) => element.getBoundingClientRect().toJSON()),
  );
  releaseFailure();
  await expect(slots.nth(1).locator("img")).toHaveCount(0);
  await expect(slots.locator("img")).toHaveCount(3);
  expect(
    await slots.evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().toJSON()),
    ),
  ).toEqual(before);
  expect(failures).toBe(1);
  await page.screenshot({
    path: testInfo.outputPath("catalog-failed-image.png"),
    fullPage: true,
  });
  await page.goto("/e2e-test/ui-complete?screen=theme&count=4");
  await expect(page.locator('[data-theme-visual="cover"] img')).toHaveAttribute(
    "src",
    "/e2e-images/cover.png",
  );
  await expect(page.locator("[data-theme-visual] img")).toHaveCount(1);
});

for (const width of [390, 1280]) {
  test(`resultado real preserva links e arredonda ações e painéis em${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/e2e-test/ui-complete?screen=result");
    await expect(
      page.getByRole("heading", { name: "Canção A", exact: true }),
    ).toBeVisible();
    const download = page.getByRole("link", { name: "Baixar imagem" });
    await expect(download).toHaveAttribute(
      "href",
      "/api/resultados/00000000-0000-4000-8000-000000000001/imagem?download=1",
    );
    await expect(
      page.getByRole("link", { name: "Jogar novamente" }),
    ).toHaveAttribute("href", "/tema/ui-capas");
    await expect(
      page.getByRole("link", { name: "Voltar ao início" }),
    ).toHaveAttribute("href", "/");
    await page.screenshot({
      path: testInfo.outputPath("result.png"),
      fullPage: true,
    });
    await expectRadius(download, 12, 14);
    await expectRadius(
      page.getByRole("region", { name: "Compartilhar a campeã" }),
      18,
      20,
    );
    for (const card of await page.getByRole("article").all())
      await expectRadius(card, 18, 20);
  });
}

test("miniaturas de recuperação fora do catálogo também usam raio de8px", async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({ "x-e2e-test": "theme-visual" });
  await page.route("**/e2e-images/cover.png*", (route) =>
    route.fulfill({ status: 404 }),
  );
  await page.goto("/e2e-test/theme-visual");
  const cards = page.locator('[data-theme-visual="thumbnails"] > span');
  await expect(cards).toHaveCount(8);
  for (const card of await cards.all()) await expectRadius(card, 8, 8);
});

test("catálogo conserva quatro posições quadradas sem sobreposição", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.setExtraHTTPHeaders({ "x-e2e-test": "home-visual" });
  await page.goto("/e2e-test/home-visual");
  const card = page.locator('a[href="/tema/classicos-do-rock"]');
  const slots = card.locator("[data-theme-visual] > span");
  await page.screenshot({
    path: testInfo.outputPath("catalog.png"),
    fullPage: true,
  });
  await expect(slots).toHaveCount(4);
  const boxes = await slots.evaluateAll((elements) =>
    elements.map((element) => element.getBoundingClientRect().toJSON()),
  );
  for (const [index, box] of boxes.entries()) {
    expect(box.width).toBeGreaterThanOrEqual(48);
    expect(box.width).toBeCloseTo(box.height, 0);
    if (index > 0) {
      expect(box.x - boxes[index - 1].right).toBeGreaterThanOrEqual(8);
      expect(box.y).toBeCloseTo(boxes[0].y, 0);
    }
  }
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
});

test("campos e ações do formulário real têm raio consistente", async ({
  page,
}, testInfo) => {
  await page.setExtraHTTPHeaders({ "x-e2e-test": "theme-form" });
  await page.goto("/e2e-test/theme-form");
  await page.screenshot({
    path: testInfo.outputPath("theme-form.png"),
    fullPage: true,
  });
  const controls = page.locator(
    'form input:not([type="hidden"]):not([type="checkbox"]), form textarea, form select, form button',
  );
  expect(await controls.count()).toBeGreaterThanOrEqual(5);
  for (const control of await controls.all()) {
    const radius = await control.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).borderTopLeftRadius),
    );
    expect(radius).toBeGreaterThanOrEqual(12);
    expect(radius).toBeLessThanOrEqual(14);
  }
});
