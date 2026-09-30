import { expect, test } from "playwright/test";

test.use({ serviceWorkers: "block" });

for (const width of [320, 360, 390, 1280]) {
  test(`marca, metadata e instalação legíveis em ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.setExtraHTTPHeaders({ "x-e2e-test": "home-visual" });
    await page.route("**/e2e-images/**", (route) =>
      route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" fill="#526779"/></svg>',
      }),
    );
    await page.goto("/e2e-test/home-visual");
    await expect(page).toHaveTitle("Last Track Standing");
    await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
    await expect(
      page.getByRole("link", { name: "Last Track Standing — início" }),
    ).toBeVisible();
    await expect(
      page.locator('meta[name="apple-mobile-web-app-title"]'),
    ).toHaveAttribute("content", "Last Track");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: testInfo.outputPath("home.png"),
      fullPage: true,
    });

    await page.goto("/admin/login");
    await expect(page).toHaveTitle("Last Track Standing Admin");
    await expect(
      page.locator('meta[name="apple-mobile-web-app-title"]'),
    ).toHaveAttribute("content", "LTS Admin");
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
      "href",
      "/icons/admin-apple-icon.png",
    );
    await expect(
      page
        .getByRole("link", { name: "Last Track Standing", exact: true })
        .last(),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: testInfo.outputPath("admin.png"),
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
    await expect(page.getByRole("complementary")).toContainText(
      "Instale o Last Track Standing Admin",
    );
    await page.screenshot({
      path: testInfo.outputPath("admin-install.png"),
      fullPage: true,
    });
  });
}

test("launcher: simulação local medida com nomes e ícones servidos pelos manifests", async ({
  page,
  request,
}, testInfo) => {
  const manifests = await Promise.all(
    ["/manifest.webmanifest", "/admin/manifest.webmanifest"].map(
      async (path) => {
        const response = await request.get(path);
        expect(response.status()).toBe(200);
        return response.json();
      },
    ),
  );
  expect(manifests.map((manifest) => manifest.short_name)).toEqual([
    "Last Track",
    "LTS Admin",
  ]);
  await page.goto("/offline");
  await page.setViewportSize({ width: 390, height: 844 });
  // This is an explicitly labelled asset/launcher preview, not production UI or
  // evidence of installation/update on a real operating system (LTS03).
  await page.setContent(
    '<html lang="pt-BR"><head><title>Prévia local de launcher</title><style>body{margin:24px;background:#101216;color:#f5f3ed;font:14px Arial}h1{font-size:20px}section{display:flex;gap:24px;margin-top:32px}figure{margin:0;width:120px;text-align:center}img{width:64px;height:64px}figcaption{margin-top:12px;white-space:nowrap}</style></head><body><h1>Simulação local de legibilidade</h1><p>Ícones de 64px, escala 100%. Não é instalação no sistema operacional.</p><section></section></body></html>',
  );
  await page.evaluate((apps) => {
    for (const app of apps) {
      const figure = document.createElement("figure");
      const icon = document.createElement("img");
      icon.src = app.icons.find(
        (icon: { sizes: string; purpose?: string }) =>
          icon.sizes === "192x192" && icon.purpose !== "maskable",
      ).src;
      icon.alt = app.name;
      const label = document.createElement("figcaption");
      label.textContent = app.short_name;
      figure.append(icon, label);
      document.querySelector("section")!.append(figure);
    }
  }, manifests);
  for (const icon of await page.locator("img").all()) {
    await expect
      .poll(() =>
        icon.evaluate(
          (image: HTMLImageElement) => image.complete && image.naturalWidth,
        ),
      )
      .toBe(192);
  }
  for (const label of await page.locator("figcaption").all()) {
    expect(
      await label.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: testInfo.outputPath("launcher-simulation.png"),
  });
  await testInfo.attach("manifest-values", {
    body: JSON.stringify(manifests),
    contentType: "application/json",
  });
});

test("preview local dos assets C e tamanhos reais de ícones", async ({
  page,
}, testInfo) => {
  await page.goto("/offline");
  await page.setViewportSize({ width: 1280, height: 960 });
  await page.setContent(
    '<html lang="pt-BR"><head><title>Inventário visual LTS01</title><style>body{background:#101216;color:#f5f3ed;font:16px Arial;margin:24px}section{display:flex;align-items:center;gap:24px}figure{margin:16px 0}figcaption{margin-top:8px}</style></head><body><h1>Assets C / Encore — prévia local, não tela do produto</h1><section id="icons"></section><section><figure><img src="/brand/last-track-standing/encore-mobile.webp" width="320" height="320"/><figcaption>Mobile 640×640, exibido a 320px</figcaption></figure><figure><img src="/brand/last-track-standing/encore-desktop.webp" width="560" height="560"/><figcaption>Desktop 1200×1200, exibido a 560px</figcaption></figure></section></body></html>',
  );
  await page.evaluate(() => {
    for (const size of [16, 32, 192]) {
      for (const prefix of ["", "admin-"]) {
        const image = document.createElement("img");
        image.src = `/icons/${prefix}icon-${size}.png`;
        image.width = size;
        image.height = size;
        image.alt = `${prefix || "public-"}${size}px`;
        document.querySelector("#icons")!.append(image);
      }
    }
  });
  for (const icon of await page.locator("img").all()) {
    await expect
      .poll(() =>
        icon.evaluate(
          (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
        ),
      )
      .toBe(true);
  }
  await page.screenshot({
    path: testInfo.outputPath("assets-preview.png"),
    fullPage: true,
  });
});
