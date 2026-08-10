import { describe, expect, it } from "vitest";

import {
  createResultShareCard,
  getResultShareTitleFontSize,
} from "@/domain/game/result-share-card";
import type { GameState } from "@/domain/game/state";

function completedState(overrides?: {
  status?: GameState["session"]["status"];
  thumbnailUrl?: string;
  title?: string;
}): GameState {
  return {
    theme: { name: "Anos 2000", slug: "anos-2000" },
    session: {
      id: "10000000-0000-4000-8000-000000000001",
      themeId: "20000000-0000-4000-8000-000000000002",
      bracketSize: 4,
      status: overrides?.status ?? "completed",
      currentRound: 2,
      championSongId: "song-a",
      startedAt: new Date("2026-08-02T10:00:00Z"),
      completedAt: new Date("2026-08-02T10:15:00Z"),
    },
    songs: [
      {
        sessionId: "10000000-0000-4000-8000-000000000001",
        seed: 1,
        songId: "song-a",
        title: overrides?.title ?? "A música campeã",
        artist: "Artista",
        thumbnailUrl:
          overrides?.thumbnailUrl ??
          "https://i.ytimg.com/vi/example/hqdefault.jpg",
        provider: "youtube",
        providerContentId: "example0001",
        startTimeSeconds: 0,
        previewDurationSeconds: 30,
      },
    ],
    matches: [],
    currentMatch: null,
    progress: {
      completedMatches: 3,
      totalMatches: 3,
      currentRound: 2,
      roundCount: 2,
    },
  };
}

describe("createResultShareCard", () => {
  it("monta os dados públicos da campeã e o link do resultado", () => {
    expect(
      createResultShareCard(completedState(), "https://jogodamusica.com.br"),
    ).toMatchObject({
      artist: "Artista",
      resultUrl:
        "https://jogodamusica.com.br/resultado/10000000-0000-4000-8000-000000000001",
      siteLabel: "jogodamusica.com.br",
      themeName: "Anos 2000",
      thumbnailUrl: "https://i.ytimg.com/vi/example/hqdefault.jpg",
      title: "A música campeã",
    });
  });

  it("não cria a arte antes da partida terminar", () => {
    expect(
      createResultShareCard(
        completedState({ status: "active" }),
        "https://jogodamusica.com.br",
      ),
    ).toBeNull();
  });

  it("descarta capas de origens não autorizadas", () => {
    expect(
      createResultShareCard(
        completedState({ thumbnailUrl: "https://example.com/private.png" }),
        "https://jogodamusica.com.br",
      )?.thumbnailUrl,
    ).toBeNull();
  });
});

describe("getResultShareTitleFontSize", () => {
  it("reduz títulos longos para preservar o layout vertical", () => {
    expect(getResultShareTitleFontSize("Curta")).toBe(96);
    expect(getResultShareTitleFontSize("x".repeat(30))).toBe(82);
    expect(getResultShareTitleFontSize("x".repeat(45))).toBe(70);
    expect(getResultShareTitleFontSize("x".repeat(70))).toBe(58);
  });
});
