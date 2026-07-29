import { voteInputSchema, voteParamsSchema } from "@/domain/game/validation";
import {
  handlePublicGameRequest,
  parsePublicGameBody,
  parsePublicGameValue,
} from "@/server/http/public-game-handler";
import { voteForMatch } from "@/server/services/game-service";

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string; matchId: string }> },
) {
  return handlePublicGameRequest(async () => {
    const { sessionId, matchId } = parsePublicGameValue(
      await context.params,
      voteParamsSchema,
    );
    const input = await parsePublicGameBody(request, voteInputSchema);
    return Response.json(await voteForMatch({ sessionId, matchId, ...input }));
  });
}
