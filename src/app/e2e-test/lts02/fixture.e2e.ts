import "server-only";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import type { GameState, GameSong } from "@/domain/game/state";
import { createGameService } from "@/server/services/game-service";
import {
  createPublicThemeService,
  createAuthoritativePublicThemeService,
} from "@/server/services/public-theme-service";
import type { GameDecisionRepository } from "@/server/repositories/game-repository-contract";

export const themeId = "10000000-0000-4000-8000-000000000002";
type FixtureData = {
  playableCount: number;
  states: Map<string, GameState>;
  queue: Promise<void>;
  renderFailure: boolean;
};
function createHarness(
  count: number,
  longNames: boolean,
  authoritative: boolean,
  catalogWindow: boolean,
  data: FixtureData,
) {
  const theme = {
    id: themeId,
    name: longNames
      ? "Canções que atravessam gerações e acompanham nossas noites de música, encontros e memórias compartilhadas"
      : "Noites de música",
    slug: "noites-de-musica",
    description: "Faixas para ouvir, comparar e escolher juntos.",
    coverUrl: null,
    thumbnailUrls: Array.from(
      { length: Math.min(count, 4) },
      (_, index) => `/e2e-test/lts02/thumbnail/${index}`,
    ),
    activeSongCount: count,
  };
  const tracks: GameSong[] = Array.from({ length: count }, (_, index) => ({
    songId: `30000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    title: longNames
      ? `Canção ${index + 1} — O último encontro depois da meia-noite entre as luzes da cidade e os caminhos do amanhecer`
      : ([
          "Luzes da cidade",
          "Último trem",
          "Depois da meia-noite",
          "Até o amanhecer",
        ][index] ?? `Música ${index + 1}`),
    artist: longNames
      ? "Orquestra das lembranças e do horizonte que nunca termina"
      : (["Aurora", "Linha Azul", "Horizonte", "Estação"][index] ??
        `Artista ${index + 1}`),
    thumbnailUrl: `/e2e-test/lts02/thumbnail/${index % 4}`,
    provider: "youtube",
    providerContentId: `video${String(index + 1).padStart(6, "0")}`,
    startTimeSeconds: 0,
    previewDurationSeconds: 30,
  }));
  const catalog = authoritative
    ? createAuthoritativePublicThemeService({
        clock: () => new Date(),
        queryThemes: async ({ slug, page = 1 }) => {
          const record = {
            ...theme,
            editorialState: "published" as const,
            counts: {
              availableFresh: data.playableCount,
              availableGrace: 0,
              unknown: 0,
              unavailable: 0,
            },
          };
          if (slug && slug !== theme.slug) return [];
          if (catalogWindow && !slug && page === 1)
            return [
              ...Array.from({ length: 200 }, (_, index) => ({
                ...record,
                id: `70000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
                name: `A oculto ${String(index).padStart(3, "0")}`,
                counts: { ...record.counts, availableFresh: 3 },
              })),
              record,
            ];
          return [record];
        },
      })
    : createPublicThemeService({
        listPlayableThemes: async () => [theme],
        findPlayableThemeBySlug: async (slug) =>
          slug === theme.slug ? theme : null,
      });
  const { states } = data;
  const service = createGameService({
    now: () => new Date(),
    random: () => 0,
    getGameState: async (id) => structuredClone(states.get(id) ?? null),
    async withGameCreationTransaction(requestedThemeId, operation) {
      return operation({
        creationContext: {
          authoritative,
          now: new Date(),
          policy: { version: 1, region: "BR" },
        },
        async getThemeWithActiveSongs() {
          return requestedThemeId === themeId
            ? {
                id: themeId,
                isActive: true,
                songs: tracks.slice(0, data.playableCount),
              }
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
      const previous = data.queue;
      let release = () => {};
      data.queue = new Promise<void>((resolve) => {
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
  return {
    service,
    catalog,
    setPlayableCount: (next: number) => {
      if (!Number.isInteger(next) || next < 0 || next > count)
        throw new Error("Invalid fixture availability");
      data.playableCount = next;
    },
    diagnostics: () => ({
      sessions: states.size,
      snapshots: [...states.values()].reduce(
        (sum, state) => sum + state.songs.length,
        0,
      ),
      matches: [...states.values()].reduce(
        (sum, state) => sum + state.matches.length,
        0,
      ),
    }),
    hasRenderFailure: () => data.renderFailure,
    recoverRender: () => {
      data.renderFailure = false;
    },
  };
}
const fixtureGlobal = globalThis as typeof globalThis & {
  lts02Harnesses?: Map<string, FixtureData>;
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
  const count = Number(requestHeaders.get("x-lts02-count") ?? "4");
  if (!Number.isInteger(count) || count < 0 || count > 128) notFound();
  const longNames = requestHeaders.get("x-lts02-long-names") === "1";
  const authoritative =
    requestHeaders.get("x-lts02-catalog") === "authoritative";
  const catalogWindow = requestHeaders.get("x-lts02-catalog-window") === "1";
  const key = `${namespace}:${count}:${longNames}:${authoritative}:${catalogWindow}`;
  const fixtures = (fixtureGlobal.lts02Harnesses ??= new Map());
  let data = fixtures.get(key);
  if (!data) {
    data = {
      playableCount: count,
      states: new Map(),
      queue: Promise.resolve(),
      renderFailure: true,
    };
    fixtures.set(key, data);
  }
  // Cache data only: SSR and route bundles must construct their own service/errors.
  return createHarness(count, longNames, authoritative, catalogWindow, data);
}
