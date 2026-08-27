import { expect, test } from "playwright/test";

test("revalida e recarrega a saúde da Fonte sem GET externo", async ({
  page,
}) => {
  const providerRequests: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("googleapis.com/youtube") || url.includes("youtube.com")) {
      providerRequests.push(url);
    }
  });
  await page.setExtraHTTPHeaders({ "x-e2e-test": "source-availability" });

  await page.goto("/e2e-test/source-availability");
  await expect(page.getByText("Desconhecida", { exact: true })).toBeVisible();
  await expect(page.getByText("Nunca verificada no Brasil")).toBeVisible();

  await page.getByRole("button", { name: "Revalidar Fonte" }).click();

  await expect(page).toHaveURL(/\?revalidated=1$/);
  await expect(page.getByText("Disponível", { exact: true })).toBeVisible();
  await expect(page.getByText("Última tentativa")).toBeVisible();
  await expect(page.getByText("Última confirmação")).toBeVisible();
  await expect(page.getByText("Validade")).toBeVisible();
  expect(providerRequests).toEqual([]);
});
