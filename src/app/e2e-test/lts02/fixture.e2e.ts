import "server-only";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import type { GameState, GameSong } from "@/domain/game/state";
import { createGameService } from "@/server/services/game-service";
import { createPublicThemeService } from "@/server/services/public-theme-service";
import type { GameDecisionRepository } from "@/server/repositories/game-repository-contract";

export const themeId = "10000000-0000-4000-8000-000000000002";
const theme = {
  id: themeId,
  name: "Noites de música",
  slug: "noites-de-musica",
  description: "Quatro faixas para ouvir, comparar e escolher juntos.",
  coverUrl: null,
  thumbnailUrls: Array.from(
    { length: 4 },
    (_, index) => `/e2e-test/lts02/thumbnail/${index}`,
  ),
  activeSongCount: 4,
};
const tracks: GameSong[] = [
  "Luzes da cidade",
  "Último trem",
  "Depois da meia-noite",
  "Até o amanhecer",
].map((title, index) => ({
  songId: `30000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  title,
  artist: ["Aurora", "Linha Azul", "Horizonte", "Estação"][index],
  thumbnailUrl: theme.thumbnailUrls[index],
  provider: "youtube",
  providerContentId: `video${String(index + 1).padStart(6, "0")}`,
  startTimeSeconds: 0,
  previewDurationSeconds: 30,
}));
const catalog = createPublicThemeService({
  listPlayableThemes: async () => [theme],
  findPlayableThemeBySlug: async (slug) => (slug === theme.slug ? theme : null),
});

function createHarness() {
  const states = new Map<string, GameState>();
  let queue = Promise.resolve();
  const service = createGameService({
    now: () => new Date(),
    random: () => 0,
    getGameState: async (id) => structuredClone(states.get(id) ?? null),
    async withGameCreationTransaction(requestedThemeId, operation) {
      return operation({
        async getThemeWithActiveSongs() {
          return requestedThemeId === themeId
            ? { id: themeId, isActive: true, songs: tracks }
            : null;
        },
        async createGame(plan) {
          const id = randomUUID();
          const matches = plan.matches.map((match) => ({
            ...match,
            id: randomUUID(),
            sessionId: id,
          }));
          states.set(id, {
            theme,
            session: { ...plan.session, id },
            songs: plan.songs.map((song) => ({ ...song, sessionId: id })),
            matches,
            currentMatch:
              matches.find((match) => match.status === "ready") ?? null,
            progress: {
              completedMatches: 0,
              totalMatches: matches.length,
              currentRound: 1,
              roundCount: Math.log2(plan.session.bracketSize),
            },
          });
          return id;
        },
      });
    },
    async withGameDecisionTransaction(id, operation) {
      const previous = queue;
      let release = () => {};
      queue = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      const stored = states.get(id);
      const state = stored ? structuredClone(stored) : null;
      const repository: GameDecisionRepository = {
        async loadDecisionContext(matchId) {
          const match =
            state?.matches.find((match) => match.id === matchId) ?? null;
          return {
            session: state?.session ?? null,
            match,
            roundMatches:
              state?.matches.filter(
                (candidate) => candidate.roundNumber === match?.roundNumber,
              ) ?? [],
          };
        },
        async applyTransition(transition, completedAt) {
          if (!state) throw new Error("Missing fixture session");
          const match = state.matches.find(
            (match) => match.id === transition.completedMatch.matchId,
          )!;
          Object.assign(match, {
            status: "completed",
            winnerSongId: transition.completedMatch.winnerSongId,
            completedAt,
          });
          if (transition.nextRound) {
            const next = transition.nextRound;
            state.matches
              .filter((match) => match.roundNumber === next.roundNumber)
              .forEach((match, index) =>
                Object.assign(match, next.pairs[index], { status: "ready" }),
              );
          }
          Object.assign(state.session, transition.session);
          if (state.session.status === "completed")
            state.session.completedAt = completedAt;
          state.currentMatch =
            state.matches.find((match) => match.status === "ready") ?? null;
          state.progress.completedMatches = state.matches.filter(
            (match) => match.status === "completed",
          ).length;
          state.progress.currentRound = state.session.currentRound;
        },
      };
      try {
        const result = await operation(repository);
        if (state) states.set(id, state);
        return result;
      } finally {
        release();
      }
    },
  });
  return { service, catalog };
}
const fixtureGlobal = globalThis as typeof globalThis & {
  lts02Harnesses?: Map<string, ReturnType<typeof createHarness>>;
};
export async function getFixture() {
  const requestHeaders = await headers();
  const namespace = requestHeaders.get("x-lts02-fixture");
  if (
    process.env.E2E_TEST_MODE !== "1" ||
    requestHeaders.get("x-e2e-test") !== "lts02" ||
    !namespace ||
    !/^[a-z0-9-]{1,64}$/.test(namespace)
  )
    notFound();
  const fixtures = (fixtureGlobal.lts02Harnesses ??= new Map());
  let fixture = fixtures.get(namespace);
  if (!fixture) {
    fixture = createHarness();
    fixtures.set(namespace, fixture);
  }
  return fixture;
}
