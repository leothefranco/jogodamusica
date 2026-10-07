import "server-only";
import { createGameInputSchema } from "@/domain/game/validation";
import type { CreateGameInput } from "@/server/services/game-service";
import {
  handlePublicGameRequest,
  parsePublicGameBody,
} from "@/server/http/public-game-handler";

export function createGamePostHandler(dependencies: {
  createSession(input: CreateGameInput): Promise<{ sessionId: string }>;
  enforceRateLimit(
    request: Request,
    scope: string,
    options: { limit: number; windowMs: number },
  ): Promise<void>;
}) {
  return (request: Request) =>
    handlePublicGameRequest(async () => {
      await dependencies.enforceRateLimit(request, "game-create", {
        limit: 20,
        windowMs: 60 * 60_000,
      });
      const input = await parsePublicGameBody(request, createGameInputSchema);
      const result = await dependencies.createSession(input);
      return Response.json(
        { ...result, url: `/jogo/${result.sessionId}` },
        { status: 201 },
      );
    });
}
