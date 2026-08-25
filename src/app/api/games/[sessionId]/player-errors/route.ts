import {
  gameParamsSchema,
  playbackErrorInputSchema,
} from "@/domain/game/validation";
import {
  handlePublicGameRequest,
  parsePublicGameBody,
  parsePublicGameValue,
} from "@/server/http/public-game-handler";
import { reportGamePlaybackError } from "@/server/services/game-service";
import { enforcePublicRateLimit } from "@/server/services/rate-limit";

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  return handlePublicGameRequest("game_player_error", async () => {
    const { sessionId } = parsePublicGameValue(
      await context.params,
      gameParamsSchema,
    );
    await enforcePublicRateLimit(
      request,
      "player-error",
      { limit: 20, windowMs: 10 * 60_000 },
      sessionId,
    );
    const input = await parsePublicGameBody(request, playbackErrorInputSchema);
    await reportGamePlaybackError({ sessionId, ...input });
    return new Response(null, { status: 204 });
  });
}
