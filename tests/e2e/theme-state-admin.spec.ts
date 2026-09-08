import { expect, test } from "playwright/test";

test("editor percorre publicação, saúde, recuperação e retirada sem perder intenção", async ({
  page,
}) => {
  const fixture = crypto.randomUUID();
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    if (/youtube|googleapis|supabase/.test(request.url()))
      externalRequests.push(request.url());
  });
  await page.setExtraHTTPHeaders({ "x-e2e-test": "theme-state" });
  await page.goto(`/e2e-test/theme-state?fixture=${fixture}`);
  const state = page.getByRole("region", { name: "Estado do Tema" });
  await expect(state.getByText("Rascunho", { exact: true })).toBeVisible();
  await expect(state.getByText("3 jogáveis", { exact: false })).toBeVisible();
  await page
    .getByRole("button", { name: "Publicar tema", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Confirme mais 1 Entrada jogável",
  );
  await page.getByRole("button", { name: "Confirmar quarta Entrada" }).click();
  await page
    .getByRole("button", { name: "Publicar tema", exact: true })
    .click();
  await expect(state.getByText("Saudável", { exact: true })).toBeVisible();
  await expect(state.getByText("Publicado", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Avançar para tolerância" }).click();
  await expect(state.getByText("Degradado", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Expirar confirmação" }).click();
  await expect(
    state.getByText("Suspenso: verificação pendente", { exact: true }),
  ).toBeVisible();
  await expect(state.getByText("Publicado", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Confirmar recuperação" }).click();
  await expect(state.getByText("Saudável", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Confirmar indisponibilidade" })
    .click();
  await expect(
    state.getByText("Suspenso: Entradas saudáveis insuficientes", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(state.getByText("Oculto", { exact: true })).toBeVisible();
  const calls = await page.getByTestId("provider-call-count").textContent();
  await page.reload();
  await expect(page.getByTestId("provider-call-count")).toHaveText(calls!);
  await page.getByRole("button", { name: "Confirmar recuperação" }).click();
  await page.getByRole("button", { name: "Retirar última Entrada" }).click();
  await expect(state.getByText("Publicado", { exact: true })).toBeVisible();
  await expect(page.getByTestId("last-event-cause")).toHaveText("editorial");
  await page.getByRole("button", { name: "Voltar a rascunho" }).click();
  await expect(
    state.getByText("Rascunho editorial", { exact: true }),
  ).toBeVisible();
  expect(externalRequests).toEqual([]);
});

for (const size of [32, 64]) {
  test(`perda de ${size} distingue saúde de curadoria e preserva published`, async ({
    page,
  }) => {
    await page.setExtraHTTPHeaders({ "x-e2e-test": "theme-state" });
    await page.goto(`/e2e-test/theme-state?fixture=${crypto.randomUUID()}`);
    await page
      .getByRole("button", { name: `Preparar ${size} Entradas` })
      .click();
    await page
      .getByRole("button", { name: "Publicar tema", exact: true })
      .click();
    const primary = page.getByRole("region", {
      name: "Modalidades principais",
      exact: true,
    });
    const state = page.getByRole("region", { name: "Estado do Tema" });
    await expect(
      primary.getByText(`${size} músicas`, { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Confirmar indisponibilidade" })
      .click();
    await expect(
      primary.getByText(`${size} músicas`, { exact: true }),
    ).toHaveCount(0);
    await expect(state.getByText("Degradado", { exact: true })).toBeVisible();
    await expect(state).toContainText(
      `Modalidades principais indisponíveis por saúde: ${size}`,
    );
    await expect(page.getByTestId("last-event-cause")).toHaveText("health");
    await page.getByRole("button", { name: "Confirmar recuperação" }).click();
    await expect(
      primary.getByText(`${size} músicas`, { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Retirar última Entrada" }).click();
    await expect(
      primary.getByText(`${size} músicas`, { exact: true }),
    ).toHaveCount(0);
    await expect(state.getByText("Saudável", { exact: true })).toBeVisible();
    await expect(state.getByText("Publicado", { exact: true })).toBeVisible();
    await expect(page.getByTestId("last-event-cause")).toHaveText("editorial");
    await expect(state).not.toContainText("indisponíveis por saúde");
  });
}

test("128 aparece somente na seção estendida", async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-e2e-test": "theme-state" });
  await page.goto(`/e2e-test/theme-state?fixture=${crypto.randomUUID()}`);
  await page.getByRole("button", { name: "Preparar 128 Entradas" }).click();
  await expect(
    page.getByRole("region", { name: "Modalidade estendida", exact: true }),
  ).toHaveText("Estendida: 128 músicas");
  await expect(
    page.getByRole("region", { name: "Modalidades rápidas", exact: true }),
  ).toContainText("16 músicas");
  await expect(
    page.getByRole("region", { name: "Modalidades principais", exact: true }),
  ).toContainText("64 músicas");
});
