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

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  return handlePublicGameRequest(async () => {
    const { sessionId } = parsePublicGameValue(
      await context.params,
      gameParamsSchema,
    );
    const input = await parsePublicGameBody(request, playbackErrorInputSchema);
    await reportGamePlaybackError({ sessionId, ...input });
    return new Response(null, { status: 204 });
  });
}
