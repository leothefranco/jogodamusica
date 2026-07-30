import { handlePublicGameRequest } from "@/server/http/public-game-handler";
import { getPublicThemes } from "@/server/services/public-theme-service";

export async function GET() {
  return handlePublicGameRequest(async () =>
    Response.json({ themes: await getPublicThemes() }),
  );
}
