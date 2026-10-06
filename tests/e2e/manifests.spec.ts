import { expect, test } from "playwright/test";

test("GET /manifest.webmanifest preserva o contrato público", async ({
  request,
}) => {
  const response = await request.get("/manifest.webmanifest");

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe(
    "application/manifest+json; charset=utf-8",
  );
  expect(response.headers()["cache-control"]).toBe(
    "public, max-age=0, must-revalidate",
  );
  await expect(response.json()).resolves.toEqual({
    name: "Last Track Standing",
    short_name: "Last Track",
    description:
      "Compare músicas em confrontos eliminatórios e descubra a campeã do grupo.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#101216",
    theme_color: "#101216",
    lang: "pt-BR",
    orientation: "any",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  });
});

test("GET /admin/manifest.webmanifest preserva o contrato administrativo", async ({
  request,
}) => {
  const response = await request.get("/admin/manifest.webmanifest");

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe(
    "application/manifest+json; charset=utf-8",
  );
  expect(response.headers()["cache-control"]).toBe(
    "public, max-age=0, must-revalidate",
  );
  await expect(response.json()).resolves.toEqual({
    id: "/admin",
    name: "Last Track Standing Admin",
    short_name: "LTS Admin",
    description: "Administre temas e músicas do Last Track Standing.",
    start_url: "/admin",
    scope: "/admin",
    display: "standalone",
    background_color: "#101216",
    theme_color: "#181C22",
    lang: "pt-BR",
    orientation: "any",
    icons: [
      {
        src: "/icons/admin-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/admin-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/admin-icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/admin-icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  });
});
