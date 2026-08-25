import { expect, test } from "playwright/test";

test("bloqueia envio duplicado, recupera erro e reutiliza a referência no retry", async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({ "x-e2e-test": "theme-form" });
  await page.goto("/e2e-test/theme-form");

  await page.getByLabel("Nome").fill("Clássicos");
  await page.getByLabel("Slug").fill("classicos");
  await page.getByLabel("Imagem de capa").setInputFiles({
    name: "capa.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xdb]),
  });

  const submit = page.locator('button[type="submit"]');
  await page.locator("form").evaluate((form: HTMLFormElement) => {
    form.requestSubmit();
    form.requestSubmit();
    form.requestSubmit();
  });
  await expect(submit).toBeDisabled();
  await expect(page.getByLabel("Imagem de capa")).toBeDisabled();
  await expect(page.getByTestId("upload-count")).toHaveText("1");

  await expect(
    page.getByRole("alert").filter({ hasText: "Falha recuperável" }),
  ).toContainText("Falha recuperável");
  await expect(submit).toBeEnabled();
  await expect(page.getByTestId("action-count")).toHaveText("1");

  await submit.click();
  await expect(page).toHaveURL(/\/e2e-test\/theme-form\?created=1$/);
  await expect(page.getByRole("status")).toHaveText("Tema criado");
  await expect(page.getByTestId("upload-count")).toHaveText("1");
  await expect(page.getByTestId("action-count")).toHaveText("2");
});
