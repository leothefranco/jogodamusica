import { expect, test } from "playwright/test";

test("revalida e recarrega a saúde da Fonte sem GET externo", async ({
  page,
}) => {
  const fixtureId = crypto.randomUUID();
  const providerRequests: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("googleapis.com/youtube") || url.includes("youtube.com")) {
      providerRequests.push(url);
    }
  });
  await page.setExtraHTTPHeaders({ "x-e2e-test": "source-availability" });

  await page.goto(`/e2e-test/source-availability?fixture=${fixtureId}`);
  await expect(page.getByText("Desconhecida", { exact: true })).toBeVisible();
  await expect(page.getByText("Nunca verificada no Brasil")).toBeVisible();
  await expect(page.getByTestId("provider-call-count")).toHaveText("0");

  await page.getByRole("button", { name: "Revalidar Fonte" }).click();

  await expect(page).toHaveURL(
    new RegExp(`\\?fixture=${fixtureId}&revalidated=1$`),
  );
  await expect(page.getByText("Disponível", { exact: true })).toBeVisible();
  await expect(page.getByText("Última tentativa")).toBeVisible();
  await expect(page.getByText("Última confirmação")).toBeVisible();
  await expect(page.getByText("Validade")).toBeVisible();
  await expect(page.getByTestId("provider-call-count")).toHaveText("1");
  await expect(page.getByTestId("fixture-flow")).toHaveText(
    "read → provider → persist",
  );

  await page.reload();

  await expect(page.getByText("Disponível", { exact: true })).toBeVisible();
  await expect(page.getByTestId("provider-call-count")).toHaveText("1");
  await expect(page.getByTestId("fixture-flow")).toHaveText(
    "read → provider → persist",
  );
  expect(providerRequests).toEqual([]);
});
