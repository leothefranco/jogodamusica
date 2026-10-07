import { installLts02YouTube } from "./support/lts02-youtube";
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "playwright/test";
import { decodeGameState } from "../../src/domain/game/transport";

test.use({
  serviceWorkers: "block",
  contextOptions: { reducedMotion: "reduce" },
});

async function setup(
  page: Page,
  count = 4,
  longNames = false,
  catalogWindow = false,
) {
  await page.context().setExtraHTTPHeaders({
    "x-e2e-test": "lts02",
    "x-lts02-fixture": randomUUID(),
    "x-lts02-count": String(count),
    "x-lts02-long-names": longNames ? "1" : "0",
    "x-lts02-catalog": "authoritative",
    "x-lts02-catalog-window": catalogWindow ? "1" : "0",
  });
  await installLts02YouTube(page);
  await page.route("**/e2e-test/lts02/thumbnail/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#445664"/></svg>',
    }),
  );
  await page.route("**/api/resultados/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1600"/>',
    }),
  );
  const requests: unknown[] = [];
  await page.route("**/api/games{,/**}", async (route) => {
    if (route.request().method() === "POST")
      requests.push(route.request().postDataJSON());
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
  return requests;
}
async function start(page: Page, size = 4) {
  await page.goto("/e2e-test/lts02/tema/noites-de-musica");
  await page
    .getByRole("radio", { name: new RegExp(`\\b${size} músicas$`) })
    .check();
  await page
    .getByRole("button", { name: "Iniciar partida", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Votar na música A" }),
  ).toBeVisible();
  return new URL(page.url()).pathname.split("/").at(-1)!;
}
async function state(page: Page, id: string) {
  const response = await page.request.get(`/e2e-test/lts02/api/${id}`);
  expect(response.ok()).toBe(true);
  return decodeGameState(await response.json());
}

for (const count of [3, 4, 31, 32, 63, 64, 127, 128]) {
  test(`projeção autoritativa e escolha explícita no limite ${count}`, async ({
    page,
  }) => {
    await setup(page, count);
    if (count === 3) {
      await page.goto("/e2e-test/lts02");
      await expect(
        page.getByText("Ainda não há temas publicados. Volte em breve."),
      ).toBeVisible();
      const response = await page.goto("/e2e-test/lts02/tema/noites-de-musica");
      // Next streams the root loading boundary before notFound: HTTP 200 is expected.
      expect(response?.status()).toBe(200);
      await expect(
        page.getByRole("heading", { name: "Não encontramos esta página" }),
      ).toBeVisible();
      await expect
        .poll(() =>
          page
            .locator('meta[name="robots"]')
            .evaluateAll(
              (nodes) =>
                nodes.length > 0 &&
                nodes.every((node) =>
                  node.getAttribute("content")?.includes("noindex"),
                ),
            ),
        )
        .toBe(true);
      await expect(page.getByRole("radio")).toHaveCount(0);
      return;
    }
    await page.goto("/e2e-test/lts02/tema/noites-de-musica");
    const sizes = [4, 8, 16, 32, 64, 128].filter((size) => size <= count);
    const radios = page.getByRole("radio");
    expect(
      (
        await radios.evaluateAll((elements) =>
          elements.map((element) =>
            element instanceof HTMLInputElement ? element.value : "",
          ),
        )
      ).sort((a, b) => Number(a) - Number(b)),
    ).toEqual(sizes.map(String));
    await expect(page.locator('input[type="radio"]:checked')).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Escolha uma modalidade" }),
    ).toBeDisabled();
    if (count >= 32) {
      const primary = page.getByRole("heading", { name: "Principais" });
      const quick = page.getByRole("heading", { name: "Rápidas" });
      expect((await primary.boundingBox())!.y).toBeLessThan(
        (await quick.boundingBox())!.y,
      );
      if (count === 128)
        expect(
          (await page
            .getByRole("heading", { name: "Mais opções" })
            .boundingBox())!.y,
        ).toBeGreaterThan((await quick.boundingBox())!.y);
    }
  });
}

test("cancelar devolve foco; ativação duplicada registra uma decisão; reload mantém chave", async ({
  page,
}) => {
  const requests = await setup(page);
  const id = await start(page);
  const before = await state(page, id);
  const vote = page.getByRole("button", { name: "Votar na música A" });
  await vote.click();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(vote).toBeFocused();
  expect(await state(page, id)).toEqual(before);
  await vote.click();
  await page
    .getByRole("button", { name: "Confirmar voto", exact: true })
    .evaluate((element) => {
      if (!(element instanceof HTMLButtonElement))
        throw new Error("Expected button");
      element.click();
      element.click();
    });
  await expect
    .poll(async () => (await state(page, id)).progress.completedMatches)
    .toBe(1);
  expect(
    requests.filter(
      (request) =>
        typeof request === "object" && request !== null && "type" in request,
    ),
  ).toHaveLength(1);
  const after = await state(page, id);
  await page.reload();
  await expect(vote).toBeVisible();
  expect(await state(page, id)).toEqual(after);
});

test("Desempate persiste antes da revelação e reload não sorteia novamente", async ({
  page,
}) => {
  const requests = await setup(page);
  const id = await start(page);
  const before = await state(page, id);
  await page
    .getByRole("button", { name: "Sortear vencedora do confronto" })
    .click();
  await page
    .getByRole("button", { name: "Sortear vencedora", exact: true })
    .click();
  await expect(
    page.getByRole("status", { name: "Roleta de desempate" }),
  ).toBeVisible();
  const after = await state(page, id);
  expect(after.progress.completedMatches).toBe(1);
  const completed = after.matches.find(
    (match) => match.id === before.currentMatch?.id,
  )!;
  expect([
    before.currentMatch?.songAId,
    before.currentMatch?.songBId,
  ]).toContain(completed.winnerSongId);
  await expect(
    page.getByRole("status", { name: "Roleta de desempate" }),
  ).toContainText("Desempate concluído");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Votar na música A" }),
  ).toBeVisible();
  expect(await state(page, id)).toEqual(after);
  expect(
    requests.filter(
      (request) =>
        typeof request === "object" && request !== null && "type" in request,
    ),
  ).toEqual([{ type: "tiebreak" }]);
});

for (const size of [32, 64]) {
  test(`chave ${size}: tamanho real e transição de rodada com foco`, async ({
    page,
  }) => {
    await setup(page, size);
    const id = await start(page, size);
    const before = await state(page, id);
    expect(before.songs).toHaveLength(size);
    expect(before.matches).toHaveLength(size - 1);
    for (let index = 0; index < size / 2; index++) {
      await page.getByRole("button", { name: "Votar na música A" }).click();
      await page
        .getByRole("button", { name: "Confirmar voto", exact: true })
        .click();
    }
    const transition = page.getByRole("heading", { level: 1 });
    await expect(
      page.getByRole("button", { name: "Continuar", exact: true }),
    ).toBeVisible();
    await expect(transition).toBeFocused();
    const animations = await transition.evaluate(
      (element) => element.getAnimations().length,
    );
    expect(animations).toBe(0);
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await expect(page.locator(".game-theme-name")).toBeFocused();
    const after = await state(page, id);
    expect(after.progress.completedMatches).toBe(size / 2);
    expect(after.session.currentRound).toBe(2);
    await page.reload();
    expect(await state(page, id)).toEqual(after);
    // Complete the remaining bracket through the real service HTTP boundary;
    // first round and transition above remain browser interactions.
    let completed = after;
    while (completed.session.status === "active") {
      const match = completed.currentMatch!;
      const response = await page.request.post(
        `/e2e-test/lts02/api/${id}/matches/${match.id}/decision`,
        { data: { type: "vote", winnerSongId: match.songAId } },
      );
      expect(response.ok()).toBe(true);
      completed = decodeGameState(await response.json());
    }
    expect(completed.progress.completedMatches).toBe(size - 1);
    expect(
      completed.matches.every((match) => match.status === "completed"),
    ).toBe(true);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Chaveamento completo" }),
    ).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(size - 1);
    const champion = completed.songs.find(
      (song) => song.songId === completed.session.championSongId,
    )!;
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      champion.title,
    );
  });
}

test("erro de renderização recupera por nova leitura do segmento", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/e2e-test/lts02/erro/controlado");
  await expect(
    page.getByRole("heading", { name: "Não foi possível continuar" }),
  ).toBeVisible();
  await page.request.post("/e2e-test/lts02/api/recover");
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(
    page.getByRole("heading", { name: "Página recuperada" }),
  ).toBeVisible();
});

test("janela autoritativa vazia conserva continuação e página seguinte", async ({
  page,
}) => {
  await setup(page, 4, false, true);
  await page.route(/^http:\/\/localhost:3162\/\?page=/, async (route) => {
    const url = new URL(route.request().url());
    url.pathname = "/e2e-test/lts02";
    await route.fulfill({
      status: 307,
      headers: { location: url.pathname + url.search },
    });
  });
  await page.goto("/e2e-test/lts02");
  await expect(
    page.getByText("Nenhum tema disponível nesta página."),
  ).toBeVisible();
  const next = page.getByRole("link", { name: "Próxima página de temas" });
  await expect(next).toHaveAttribute("href", "/?page=2#temas");
  await next.click();
  await expect(
    page.getByRole("link", { name: /Noites de música/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Próxima página de temas" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Página anterior" }),
  ).toHaveAttribute("href", "/?page=1#temas");
});
test("movimento normal revela Desempate persistido e não altera a vencedora", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await setup(page);
  const id = await start(page);
  await page
    .getByRole("button", { name: "Sortear vencedora do confronto" })
    .click();
  await page
    .getByRole("button", { name: "Sortear vencedora", exact: true })
    .click();
  const reveal = page.getByRole("status", { name: "Roleta de desempate" });
  await expect(reveal).toContainText("Roleta em movimento");
  expect(
    await reveal.evaluate(
      (element) => element.getAnimations({ subtree: true }).length,
    ),
  ).toBeGreaterThan(0);
  const persisted = await state(page, id);
  expect(persisted.progress.completedMatches).toBe(1);
  await expect(reveal).toContainText("Desempate concluído");
  expect(await state(page, id)).toEqual(persisted);
  await expect(reveal).toHaveCount(0);
});
