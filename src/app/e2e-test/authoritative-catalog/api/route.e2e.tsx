import { catalogFixture } from "../fixture.e2e";
import { parsePublicCatalogPage } from "@/server/services/public-theme-service";

export async function GET(request: Request) {
  const page = parsePublicCatalogPage(
    new URL(request.url).searchParams.get("page") ?? undefined,
  );
  return Response.json(await (await catalogFixture()).listPage(page), {
    headers: { "Cache-Control": "no-store" },
  });
}
