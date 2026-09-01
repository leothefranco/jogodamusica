import { createGameInputSchema } from "@/domain/game/validation";
import type { GameSong } from "@/domain/game/state";
import {
  handlePublicGameRequest,
  parsePublicGameBody,
} from "@/server/http/public-game-handler";
import type { GameCreationRepository } from "@/server/repositories/game-repository-contract";
import { createGameService } from "@/server/services/game-service";

import { publicCatalogThemeId } from "../catalog-fixture.e2e";

const sessionId = "30000000-0000-4000-8000-000000000004";
const currentSongs: GameSong[] = Array.from({ length: 4 }, (_, index) => ({
  songId: `20000000-0000-4000-8000-00000000000${index + 1}`,
  title: `Faixa atual ${index + 1}`,
  artist: "Artista do tracer",
  thumbnailUrl: `https://i.ytimg.com/vi/tracer${index + 1}/hqdefault.jpg`,
  provider: "youtube",
  providerContentId: `tracer${index + 1}`,
  startTimeSeconds: 0,
  previewDurationSeconds: 30,
}));

export async function POST(request: Request) {
  if (request.headers.get("x-e2e-test") !== "public-catalog") {
    return new Response(null, { status: 404 });
  }

  const snapshotSongIds: string[] = [];
  const repository: GameCreationRepository = {
    async getThemeWithActiveSongs() {
      return {
        id: publicCatalogThemeId,
        isActive: true,
        songs: currentSongs,
      };
    },
    async createGame(plan) {
      snapshotSongIds.push(...plan.songs.map(({ songId }) => songId));
      return sessionId;
    },
  };
  const service = createGameService({
    async getGameState() {
      return null;
    },
    now: () => new Date("2026-08-27T12:00:00.000Z"),
    random: () => 0.999_999,
    async withGameCreationTransaction(themeId, operation) {
      if (themeId !== publicCatalogThemeId) {
        return operation({
          async getThemeWithActiveSongs() {
            return null;
          },
          async createGame() {
            throw new Error("Tema ausente não pode criar uma partida.");
          },
        });
      }
      return operation(repository);
    },
    async withGameDecisionTransaction<T>(): Promise<T> {
      throw new Error("O tracer de catálogo não decide confrontos.");
    },
  });

  return handlePublicGameRequest(async () => {
    const input = await parsePublicGameBody(request, createGameInputSchema);
    const result = await service.createSession(input);

    return Response.json(
      {
        ...result,
        url: "/e2e-test/public-catalog?created=1",
        e2eSnapshotSongIds: snapshotSongIds,
      },
      { status: 201 },
    );
  });
}
