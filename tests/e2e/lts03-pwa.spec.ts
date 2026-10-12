import { expect, test } from "playwright/test";

test("manifests HTTP preservam identidades pública e administrativa", async ({
  page,
  request,
}) => {
  const publicResponse = await request.get("/manifest.webmanifest");
  const adminResponse = await request.get("/admin/manifest.webmanifest");
  expect(publicResponse.ok()).toBe(true);
  expect(adminResponse.ok()).toBe(true);
  const publicManifest = await publicResponse.json();
  const adminManifest = await adminResponse.json();
  expect(publicManifest).not.toHaveProperty("id");
  expect(publicManifest).toMatchObject({
    name: "Last Track Standing",
    start_url: "/",
    scope: "/",
  });
  expect(adminManifest).toMatchObject({
    name: "Last Track Standing Admin",
    id: "/admin",
    start_url: "/admin",
    scope: "/admin",
  });
  expect(adminManifest.icons[0].src).not.toBe(publicManifest.icons[0].src);
  await page.goto("/offline");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest",
  );
  await page.goto("/admin/login");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/admin/manifest.webmanifest",
  );
});

for (const app of [
  {
    path: "/offline",
    label: "Instalar aplicativo",
    name: "Last Track Standing",
  },
  {
    path: "/admin/login",
    label: "Instalar aplicativo administrativo",
    name: "Last Track Standing Admin",
  },
]) {
  test(`oferta ${app.path} usa a marca e responde ao prompt do navegador`, async ({
    page,
  }) => {
    await page.goto(app.path);
    // Browser-event stub checks the offer only; this is not a native installation.
    await expect(async () => {
      await page.evaluate(() => {
        const promptEvent = Object.assign(new Event("beforeinstallprompt"), {
          prompt: async () => {},
          userChoice: Promise.resolve({ outcome: "accepted" }),
        });
        window.dispatchEvent(promptEvent);
      });
      await expect(
        page.getByRole("complementary", { name: app.label }),
      ).toBeVisible();
    }).toPass();
    const offer = page.getByRole("complementary", { name: app.label });
    await expect(offer).toContainText(`Instale o ${app.name}`);
    await offer
      .getByRole("button", { name: "Instalar aplicativo", exact: true })
      .click();
    await expect(offer).toHaveCount(0);
  });
}

test("fechar a oferta preserva o adiamento em novas visitas", async ({
  page,
}) => {
  await page.goto("/offline");
  await expect(async () => {
    await page.evaluate(() => {
      window.dispatchEvent(
        Object.assign(new Event("beforeinstallprompt"), {
          prompt: async () => {},
          userChoice: Promise.resolve({ outcome: "dismissed" }),
        }),
      );
    });
    await expect(
      page.getByRole("complementary", {
        name: "Instalar aplicativo",
        exact: true,
      }),
    ).toBeVisible();
  }).toPass();
  await page
    .getByRole("button", { name: "Fechar instrução de instalação" })
    .click();
  await page.reload();
  await page.evaluate(() => {
    window.dispatchEvent(
      Object.assign(new Event("beforeinstallprompt"), {
        prompt: async () => {},
        userChoice: Promise.resolve({ outcome: "dismissed" }),
      }),
    );
  });
  await expect(
    page.getByRole("complementary", {
      name: "Instalar aplicativo",
      exact: true,
    }),
  ).toHaveCount(0);
});

test("Safari iOS emulado mostra instruções públicas e administrativas distintas", async ({
  browser,
}) => {
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  for (const path of ["/offline", "/admin/login"]) {
    await page.goto(new URL(path, test.info().project.use.baseURL).href);
    const offer = page.getByRole("complementary", {
      name: path.startsWith("/admin")
        ? "Instalar aplicativo administrativo"
        : "Instalar aplicativo",
      exact: true,
    });
    await expect(offer).toContainText("Adicionar à Tela de");
    await expect(
      offer.getByRole("button", { name: "Instalar aplicativo", exact: true }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  }
  await context.close();
});

test("admin sem sessão continua protegido após atualização visual", async ({
  page,
  request,
}) => {
  await page.goto("/admin/temas");
  await expect(page).toHaveURL(/\/admin\/login/);
  const response = await request.get("/api/admin/youtube/search?q=teste");
  expect(response.status()).toBe(401);
});
