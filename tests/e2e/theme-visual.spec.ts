import { expect, test, type Page, type Route } from "playwright/test";

const validImage = `
  <svg xmlns="http://www.w3.org/2000/svg" width="160" height="90" viewBox="0 0 160 90">
    <rect width="160" height="90" fill="#8b5cf6" />
  </svg>
`;

const visualTestIds = ["home-visual", "detail-visual"] as const;

function imageRequest(route: Route) {
  const url = new URL(route.request().url());
  return {
    name: url.pathname.split("/").at(-1) ?? "",
    surface: url.searchParams.get("surface") ?? "",
  };
}

async function fulfillValidImage(route: Route) {
  await route.fulfill({
    status: 200,
    contentType: "image/svg+xml",
    body: validImage,
  });
}

async function expectThumbnailFallback(page: Page, count = 4) {
  for (const testId of visualTestIds) {
    const visual = page.getByTestId(testId);
    await expect(
      visual.locator('[data-theme-visual="thumbnails"] img'),
    ).toHaveCount(count);
    await expect(visual.locator('img[src*="cover.png"]')).toHaveCount(0);
  }
}

async function visualBoxes(page: Page) {
  return Promise.all(
    visualTestIds.map(async (testId) => {
      const visual = page.getByTestId(testId).locator("[data-theme-visual]");
      await expect(visual).toBeVisible();
      const box = await visual.boundingBox();
      expect(box).not.toBeNull();
      return box!;
    }),
  );
}

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-e2e-test": "theme-visual" });
});

const invalidCoverResponses = [
  {
    label: "404",
    fulfill: (route: Route) => route.fulfill({ status: 404 }),
  },
  {
    label: "HTML com status 200",
    fulfill: (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!doctype html><title>não é imagem</title>",
      }),
  },
  {
    label: "bytes indecodificáveis",
    fulfill: (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "image/png",
        body: "isto não é um PNG decodificável",
      }),
  },
] as const;

for (const invalidCover of invalidCoverResponses) {
  test(`capa ${invalidCover.label} cai para thumbnails válidas nas duas composições`, async ({
    page,
  }) => {
    await page.route("**/e2e-images/**", async (route) => {
      const { name } = imageRequest(route);
      if (name === "cover.png") {
        await invalidCover.fulfill(route);
        return;
      }
      await fulfillValidImage(route);
    });

    await page.goto("/e2e-test/theme-visual");
    await expectThumbnailFallback(page);
  });
}

test("capa decodificável mantém precedência sem solicitar thumbnails", async ({
  page,
}) => {
  const requestedImages: string[] = [];
  await page.route("**/e2e-images/**", async (route) => {
    requestedImages.push(route.request().url());
    await fulfillValidImage(route);
  });

  await page.goto("/e2e-test/theme-visual");

  for (const testId of visualTestIds) {
    const visual = page.getByTestId(testId);
    await expect(visual.locator('[data-theme-visual="cover"] img')).toHaveCount(
      1,
    );
    expect(
      await visual.locator("img").evaluate((image: HTMLImageElement) => ({
        complete: image.complete,
        naturalWidth: image.naturalWidth,
      })),
    ).toEqual({ complete: true, naturalWidth: 160 });
  }

  expect(
    requestedImages.filter((requestUrl) =>
      new URL(requestUrl).pathname.includes("/thumb-"),
    ),
  ).toEqual([]);
});

test("falhas parciais em ordens diferentes preservam o mesmo conjunto editorial", async ({
  page,
}) => {
  const requestedImages: string[] = [];
  const failedAt: string[] = [];

  await page.route("**/e2e-images/**", async (route) => {
    const { name, surface } = imageRequest(route);
    requestedImages.push(`${surface}:${name}`);

    if (name === "cover.png") {
      await route.fulfill({ status: 404 });
      return;
    }

    if (name === "thumb-2.png" || name === "thumb-4.png") {
      const isFirstFailure =
        (surface === "home" && name === "thumb-2.png") ||
        (surface === "detail" && name === "thumb-4.png");
      await new Promise((resolve) =>
        setTimeout(resolve, isFirstFailure ? 30 : 140),
      );
      failedAt.push(`${surface}:${name}`);
      await route.fulfill({ status: 404 });
      return;
    }

    await fulfillValidImage(route);
  });

  await page.goto("/e2e-test/theme-visual");
  await expectThumbnailFallback(page, 2);

  for (const testId of visualTestIds) {
    const remainingNames = await page
      .getByTestId(testId)
      .locator("img")
      .evaluateAll((images) =>
        images.map((image) =>
          new URL((image as HTMLImageElement).src).pathname.split("/").at(-1),
        ),
      );
    expect(remainingNames).toEqual(["thumb-1.png", "thumb-3.png"]);
  }

  expect(failedAt.indexOf("home:thumb-2.png")).toBeLessThan(
    failedAt.indexOf("home:thumb-4.png"),
  );
  expect(failedAt.indexOf("detail:thumb-4.png")).toBeLessThan(
    failedAt.indexOf("detail:thumb-2.png"),
  );
  expect(
    requestedImages.filter((request) => request.endsWith("thumb-5.png")),
  ).toEqual([]);
  expect(
    requestedImages.filter((request) => request === "home:thumb-2.png"),
  ).toHaveLength(1);
  expect(
    requestedImages.filter((request) => request === "detail:thumb-2.png"),
  ).toHaveLength(1);
});

test("falha de todas as imagens termina no placeholder editorial", async ({
  page,
}) => {
  await page.route("**/e2e-images/**", (route) =>
    route.fulfill({ status: 404 }),
  );

  await page.goto("/e2e-test/theme-visual");

  for (const testId of visualTestIds) {
    const visual = page.getByTestId(testId);
    await expect(
      visual.locator('[data-theme-visual="placeholder"]'),
    ).toContainText("Jogo da Música");
    await expect(visual.locator("img")).toHaveCount(0);
  }
});

test("detecta a capa que falhou antes da hidratação", async ({ page }) => {
  let failedCovers = 0;
  let lastCoverFailureAt = 0;
  let firstScriptContinuedAt = Number.POSITIVE_INFINITY;
  let releaseScripts!: () => void;
  const coversFailed = new Promise<void>((resolve) => {
    releaseScripts = resolve;
  });

  await page.route(/\/_next\/static\/.*\.js(?:\?.*)?$/, async (route) => {
    await coversFailed;
    firstScriptContinuedAt = Math.min(firstScriptContinuedAt, Date.now());
    await route.continue();
  });
  await page.route("**/e2e-images/**", async (route) => {
    const { name } = imageRequest(route);
    if (name === "cover.png") {
      await route.fulfill({ status: 404 });
      failedCovers += 1;
      lastCoverFailureAt = Date.now();
      if (failedCovers === visualTestIds.length) releaseScripts();
      return;
    }
    await fulfillValidImage(route);
  });

  await page.goto("/e2e-test/theme-visual");

  expect(failedCovers).toBe(2);
  expect(firstScriptContinuedAt).toBeGreaterThanOrEqual(lastCoverFailureAt);
  await expectThumbnailFallback(page);
});

test("imagem ainda carregando permanece ativa sem timeout", async ({
  page,
}) => {
  let coverRequests = 0;
  let thumbnailRequests = 0;
  let releaseCovers!: () => void;
  const coverGate = new Promise<void>((resolve) => {
    releaseCovers = resolve;
  });

  await page.route("**/e2e-images/**", async (route) => {
    const { name } = imageRequest(route);
    if (name === "cover.png") {
      coverRequests += 1;
      await coverGate;
      await fulfillValidImage(route);
      return;
    }
    thumbnailRequests += 1;
    await fulfillValidImage(route);
  });

  try {
    await page.goto("/e2e-test/theme-visual", {
      waitUntil: "domcontentloaded",
    });
    await expect.poll(() => coverRequests).toBe(2);
    await expect(page.locator('[data-theme-visual="cover"]')).toHaveCount(2);
    await page.waitForTimeout(700);
    await expect(page.locator('[data-theme-visual="cover"]')).toHaveCount(2);
    expect(thumbnailRequests).toBe(0);
  } finally {
    releaseCovers();
  }

  await page.waitForLoadState("load");
  expect(thumbnailRequests).toBe(0);
});

for (const viewport of [
  { label: "mobile", width: 390, height: 844 },
  { label: "desktop", width: 1280, height: 800 },
] as const) {
  test(`mantém dimensões, overflow e CTA estáveis no ${viewport.label}`, async ({
    page,
  }) => {
    let coverRequests = 0;
    let releaseCoverFailures!: () => void;
    const coverGate = new Promise<void>((resolve) => {
      releaseCoverFailures = resolve;
    });

    await page.setViewportSize(viewport);
    await page.route("**/e2e-images/**", async (route) => {
      const { name } = imageRequest(route);
      if (name === "cover.png") {
        coverRequests += 1;
        await coverGate;
        await route.fulfill({ status: 404 });
        return;
      }
      await fulfillValidImage(route);
    });

    try {
      await page.goto("/e2e-test/theme-visual", {
        waitUntil: "domcontentloaded",
      });
      await expect.poll(() => coverRequests).toBe(2);
      const before = await visualBoxes(page);

      releaseCoverFailures();
      await expectThumbnailFallback(page);
      const after = await visualBoxes(page);

      for (let index = 0; index < before.length; index += 1) {
        expect(Math.abs(before[index].width - after[index].width)).toBeLessThan(
          1,
        );
        expect(
          Math.abs(before[index].height - after[index].height),
        ).toBeLessThan(1);
        expect(after[index].width / after[index].height).toBeCloseTo(16 / 9, 1);
      }
    } finally {
      releaseCoverFailures();
    }

    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);

    const detailVisual = page
      .getByTestId("detail-visual")
      .locator("[data-theme-visual]");
    const cta = page.getByTestId("detail-cta");
    const [visualBox, ctaBox] = await Promise.all([
      detailVisual.boundingBox(),
      cta.boundingBox(),
    ]);
    expect(visualBox).not.toBeNull();
    expect(ctaBox).not.toBeNull();
    expect(visualBox!.y + visualBox!.height).toBeLessThanOrEqual(ctaBox!.y);

    await cta.scrollIntoViewIfNeeded();
    expect(
      await cta.evaluate((button) => {
        const box = button.getBoundingClientRect();
        const topElement = document.elementFromPoint(
          box.left + box.width / 2,
          box.top + box.height / 2,
        );
        return topElement === button || button.contains(topElement);
      }),
    ).toBe(true);
  });
}

test("mantém conteúdo servidor e espaço visual sem JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
    extraHTTPHeaders: { "x-e2e-test": "theme-visual" },
  });
  const page = await context.newPage();
  await page.route("**/e2e-images/**", fulfillValidImage);

  await page.goto("/e2e-test/theme-visual");

  await expect(
    page.getByRole("link", { name: "Tema E2E da home", exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "Tema E2E do detalhe" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Começar jogo" }),
  ).toBeVisible();
  const boxes = await visualBoxes(page);
  for (const box of boxes) {
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
    expect(box.width / box.height).toBeCloseTo(16 / 9, 1);
  }
  expect(
    await page
      .locator("[data-theme-visual] img")
      .evaluateAll((images) =>
        images.every(
          (image) =>
            image.getAttribute("alt") === "" &&
            (image as HTMLImageElement).tabIndex === -1,
        ),
      ),
  ).toBe(true);

  await context.close();
});

test("fallback não depende de movimento e respeita preferência reduzida", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/e2e-images/**", async (route) => {
    const { name } = imageRequest(route);
    if (name === "cover.png") {
      await route.fulfill({ status: 404 });
      return;
    }
    await fulfillValidImage(route);
  });

  await page.goto("/e2e-test/theme-visual");
  await expectThumbnailFallback(page);

  const longestTransitionMs = await page
    .locator(".theme-thumbnail-card")
    .first()
    .evaluate((card) => {
      const durations = getComputedStyle(card).transitionDuration.split(",");
      return Math.max(
        ...durations.map((duration) => {
          const value = Number.parseFloat(duration);
          return duration.trim().endsWith("ms") ? value : value * 1_000;
        }),
      );
    });
  expect(longestTransitionMs).toBeLessThanOrEqual(0.011);
});
