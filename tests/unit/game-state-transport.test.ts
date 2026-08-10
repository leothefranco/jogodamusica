import { describe, expect, it } from "vitest";

import { decodeGameState } from "@/domain/game/transport";

const transportedState = {
  theme: { name: "Clássicos", slug: "classicos" },
  session: {
    id: "session-1",
    themeId: "theme-1",
    bracketSize: 4,
    status: "active",
    currentRound: 1,
    championSongId: null,
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: null,
  },
  songs: [],
  matches: [],
  currentMatch: null,
  progress: {
    completedMatches: 0,
    totalMatches: 3,
    currentRound: 1,
    roundCount: 2,
  },
};

describe("transporte do estado da partida", () => {
  it("valida a resposta e recupera datas serializadas", () => {
    const state = decodeGameState(transportedState);

    expect(state.session.startedAt).toEqual(
      new Date("2026-01-01T00:00:00.000Z"),
    );
  });

  it("rejeita respostas sem o contrato público completo", () => {
    expect(() =>
      decodeGameState({ session: transportedState.session }),
    ).toThrow();
  });
});
