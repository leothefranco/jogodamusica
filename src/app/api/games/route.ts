import { createGameInputSchema } from "@/domain/game/validation";
import {
  handlePublicGameRequest,
  parsePublicGameBody,
} from "@/server/http/public-game-handler";
import { createGameSession } from "@/server/services/game-service";
import { enforcePublicRateLimit } from "@/server/services/rate-limit";

export async function POST(request: Request) {
  return handlePublicGameRequest("game_create", async () => {
    await enforcePublicRateLimit(request, "game-create", {
      limit: 20,
      windowMs: 60 * 60_000,
    });
    const input = await parsePublicGameBody(request, createGameInputSchema);
    const result = await createGameSession(input);

    return Response.json(
      { ...result, url: `/jogo/${result.sessionId}` },
      { status: 201 },
    );
  });
}
