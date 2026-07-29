import { gameParamsSchema } from "@/domain/game/validation";
import {
  handlePublicGameRequest,
  parsePublicGameValue,
} from "@/server/http/public-game-handler";
import { getGameState } from "@/server/services/game-service";

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
