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
import { enforcePublicRateLimit } from "@/server/services/rate-limit";

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string; matchId: string }> },
) {
  return handlePublicGameRequest(async () => {
    const { sessionId, matchId } = parsePublicGameValue(
      await context.params,
      matchDecisionParamsSchema,
    );
    await enforcePublicRateLimit(
      request,
      "game-decision",
      { limit: 90, windowMs: 60_000 },
      sessionId,
    );
    const decision = await parsePublicGameBody(
      request,
      matchDecisionInputSchema,
    );
    return Response.json(await decideMatch({ sessionId, matchId, decision }));
  });
}
