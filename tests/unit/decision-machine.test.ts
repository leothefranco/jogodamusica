import { describe, expect, it } from "vitest";

import {
  createDecisionMachineState,
  transitionDecisionMachine,
} from "@/components/game/decision-machine";

describe("decisão do confronto", () => {
  const songA = {
    songId: "song-a",
    title: "Música A",
    artist: "Artista A",
    thumbnailUrl: "https://example.com/a.jpg",
    provider: "youtube" as const,
    providerContentId: "video-a",
    startTimeSeconds: 0,
    previewDurationSeconds: 30,
  };
  const songB = { ...songA, songId: "song-b", title: "Música B" };

  it("aceita uma única confirmação enquanto a decisão está em andamento", () => {
    const requested = transitionDecisionMachine(createDecisionMachineState(), {
      type: "request",
      decision: { type: "tiebreak" },
    });
    const submitting = transitionDecisionMachine(requested, {
      type: "submit",
    });

    expect(submitting).toMatchObject({
      phase: "submitting",
      pendingDecision: { type: "tiebreak" },
    });
    expect(transitionDecisionMachine(submitting, { type: "submit" })).toBe(
      submitting,
    );
  });

  it("preserva a decisão para nova tentativa quando a submissão falha", () => {
    const requested = transitionDecisionMachine(createDecisionMachineState(), {
      type: "request",
      decision: { type: "tiebreak" },
    });
    const submitting = transitionDecisionMachine(requested, {
      type: "submit",
    });

    expect(
      transitionDecisionMachine(submitting, {
        type: "failed",
        message: "Não foi possível registrar a decisão.",
      }),
    ).toMatchObject({
      phase: "confirming",
      pendingDecision: { type: "tiebreak" },
      message: "Não foi possível registrar a decisão.",
    });
  });

  it("revela o Desempate e volta ao estado inicial ao concluir", () => {
    const requested = transitionDecisionMachine(createDecisionMachineState(), {
      type: "request",
      decision: { type: "tiebreak" },
    });
    const submitting = transitionDecisionMachine(requested, {
      type: "submit",
    });
    const revealing = transitionDecisionMachine(submitting, {
      type: "revealStarted",
      participants: [songA, songB],
      winner: songB,
    });
    const settled = transitionDecisionMachine(revealing, {
      type: "revealSettled",
    });

    expect(revealing).toMatchObject({
      phase: "revealing",
      pendingDecision: null,
      tiebreakReveal: {
        activeSongId: "song-a",
        isSpinning: true,
        winner: songB,
      },
    });
    expect(settled.tiebreakReveal).toMatchObject({
      activeSongId: "song-b",
      isSpinning: false,
    });
    expect(transitionDecisionMachine(settled, { type: "completed" })).toEqual(
      createDecisionMachineState(),
    );
  });
});
