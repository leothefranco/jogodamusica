import { createGameInputSchema } from "@/domain/game/validation";
import {
  handlePublicGameRequest,
  parsePublicGameBody,
} from "@/server/http/public-game-handler";
import { createGameSession } from "@/server/services/game-service";

export async function POST(request: Request) {
  return handlePublicGameRequest(async () => {
    const input = await parsePublicGameBody(request, createGameInputSchema);
    const result = await createGameSession(input);

    return Response.json(
      { ...result, url: `/jogo/${result.sessionId}` },
      { status: 201 },
    );
  });
}
