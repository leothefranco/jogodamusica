import { z } from "zod";
import { createGamePostHandler } from "@/server/http/game-create-handler";
import { getFixture } from "../../fixture.e2e";
import {
  handlePublicGameRequest,
  parsePublicGameBody,
} from "@/server/http/public-game-handler";
import { matchDecisionInputSchema } from "@/domain/game/validation";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const fixture = await getFixture();
  const { service } = fixture;
  const path = (await params).path ?? [];
  if (!path.length)
    return createGamePostHandler({
      createSession: service.createSession,
      enforceRateLimit: async () => {},
    })(request);
  return handlePublicGameRequest(async () => {
    if (path[0] === "recover") {
      fixture.recoverRender();
      return Response.json({ recovered: true });
    }
    if (path[0] === "availability") {
      const input = await parsePublicGameBody(
        request,
        z.object({ count: z.number().int().min(0).max(128) }),
      );
      fixture.setPlayableCount(input.count);
      return Response.json({ updated: true });
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
  const fixture = await getFixture();
  const { service } = fixture;
  const path = (await params).path ?? [];
  if (path[0] === "diagnostics") return Response.json(fixture.diagnostics());
  return handlePublicGameRequest(async () =>
    Response.json(await service.getState((await params).path![0])),
  );
}
