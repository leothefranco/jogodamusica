import { getFixture } from "../../fixture.e2e";
import {
  handlePublicGameRequest,
  parsePublicGameBody,
} from "@/server/http/public-game-handler";
import {
  createGameInputSchema,
  matchDecisionInputSchema,
} from "@/domain/game/validation";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { service } = await getFixture();
  return handlePublicGameRequest(async () => {
    const path = (await params).path ?? [];
    if (!path.length) {
      const input = await parsePublicGameBody(request, createGameInputSchema);
      const { sessionId } = await service.createSession(input);
      return Response.json(
        { sessionId, url: `/jogo/${sessionId}` },
        { status: 201 },
      );
    }
    const decision = await parsePublicGameBody(
      request,
      matchDecisionInputSchema,
    );
    return Response.json(
      await service.decide({ sessionId: path[0], matchId: path[2], decision }),
    );
  });
}
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { service } = await getFixture();
  return handlePublicGameRequest(async () =>
    Response.json(await service.getState((await params).path![0])),
  );
}
