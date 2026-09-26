import { handlePublicGameRequest } from "@/server/http/public-game-handler";
import {
  getPublicCatalogPage,
  parsePublicCatalogPage,
} from "@/server/services/public-theme-service";

export async function GET(request?: Request) {
  return handlePublicGameRequest(async () => {
    const page = parsePublicCatalogPage(
      request
        ? (new URL(request.url).searchParams.get("page") ?? undefined)
        : undefined,
    );
    const result = await getPublicCatalogPage(page);
    return Response.json(
      {
        themes: result.themes,
        ...(result.nextPage ? { nextPage: result.nextPage } : {}),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  });
}
