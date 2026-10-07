import { createGamePostHandler } from "@/server/http/game-create-handler";
import { createGameSession } from "@/server/services/game-service";
import { enforcePublicRateLimit } from "@/server/services/rate-limit";

export const POST = createGamePostHandler({
  createSession: createGameSession,
  enforceRateLimit: enforcePublicRateLimit,
});
