import {
  matchDecisionInputSchema,
  matchDecisionParamsSchema,
} from "@/domain/game/validation";
import {
  handlePublicGameRequest,
  parsePublicGameBody,
  parsePublicGameValue,
} from "@/server/http/public-game-handler";
import { decideMatch } from "@/server/services/game-service";

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string; matchId: string }> },
) {
  return handlePublicGameRequest(async () => {
    const { sessionId, matchId } = parsePublicGameValue(
      await context.params,
      matchDecisionParamsSchema,
    );
    const decision = await parsePublicGameBody(
      request,
      matchDecisionInputSchema,
    );
    return Response.json(await decideMatch({ sessionId, matchId, decision }));
  });
}
