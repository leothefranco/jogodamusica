import { createGamePostHandler } from "@/server/http/game-create-handler";
import { catalogFixture } from "../fixture.e2e";

export async function POST(request: Request) {
  const fixture = await catalogFixture();
  return createGamePostHandler({
    createSession: fixture.games.createSession,
    // The real rate limiter is covered with disposable SQL in the route test.
    enforceRateLimit: async () => {},
  })(request);
}
