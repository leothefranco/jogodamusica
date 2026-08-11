import {
  abandonGameInputSchema,
  gameParamsSchema,
} from "@/domain/game/validation";
import {
  handlePublicGameRequest,
  parsePublicGameBody,
  parsePublicGameValue,
} from "@/server/http/public-game-handler";
import {
  abandonGameSession,
  getGameState,
} from "@/server/services/game-service";
import { enforcePublicRateLimit } from "@/server/services/rate-limit";

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  return handlePublicGameRequest(async () => {
    const { sessionId } = parsePublicGameValue(
      await context.params,
      gameParamsSchema,
    );
    return Response.json(await getGameState(sessionId));
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  return handlePublicGameRequest(async () => {
    const { sessionId } = parsePublicGameValue(
      await context.params,
      gameParamsSchema,
    );
    await enforcePublicRateLimit(
      request,
      "game-abandon",
      { limit: 10, windowMs: 10 * 60_000 },
      sessionId,
    );
    await parsePublicGameBody(request, abandonGameInputSchema);
    await abandonGameSession(sessionId);
    return new Response(null, { status: 204 });
  });
}
