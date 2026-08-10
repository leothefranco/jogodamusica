"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  createDecisionMachineState,
  transitionDecisionMachine,
  type DecisionMachineEvent,
} from "@/components/game/decision-machine";
import type { MatchDecision } from "@/domain/bracket";
import { decodeGameState } from "@/domain/game/transport";
import type { GameSong, GameState } from "@/domain/game/state";

const TIEBREAK_SPIN_DURATION_MS = 2_500;
const TIEBREAK_RESULT_HOLD_MS = 2_500;
const TIEBREAK_SWITCH_INTERVAL_MS = 180;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

async function submitMatchDecision(
  sessionId: string,
  matchId: string,
  decision: MatchDecision,
) {
  const response = await fetch(
    `/api/games/${sessionId}/matches/${matchId}/decision`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(decision),
    },
  );
  const payload: unknown = await response.json();
  if (!response.ok) {
    const error =
      typeof payload === "object" && payload !== null
        ? Reflect.get(payload, "error")
        : null;
    const message =
      typeof error === "object" && error !== null
        ? Reflect.get(error, "message")
        : null;
    throw new Error(
      typeof message === "string"
        ? message
        : "Não foi possível registrar a decisão.",
    );
  }
  return decodeGameState(payload);
}

export function useGameDecisions({
  gameState,
  pausePlayback,
  applyState,
}: {
  gameState: GameState;
  pausePlayback(): void;
  applyState(state: GameState): void;
}) {
  const [machine, setMachine] = useState(createDecisionMachineState);
  const machineRef = useRef(machine);
  const mountedRef = useRef(true);
  const timeoutIdsRef = useRef(new Set<number>());
  const switchTimerRef = useRef<number | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const currentMatch = gameState.currentMatch;
  const songs = gameState.songs;

  const send = useCallback((event: DecisionMachineEvent) => {
    if (!mountedRef.current) return false;
    const current = machineRef.current;
    const next = transitionDecisionMachine(current, event);
    if (next === current) return false;
    machineRef.current = next;
    setMachine(next);
    return true;
  }, []);

  const wait = useCallback(
    (durationMs: number) =>
      new Promise<void>((resolve) => {
        const timeoutId = window.setTimeout(() => {
          timeoutIdsRef.current.delete(timeoutId);
          resolve();
        }, durationMs);
        timeoutIdsRef.current.add(timeoutId);
      }),
    [],
  );

  const stopTiebreakSwitching = useCallback(() => {
    if (switchTimerRef.current === null) return;
    window.clearInterval(switchTimerRef.current);
    switchTimerRef.current = null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const timeoutIds = timeoutIdsRef.current;
    return () => {
      mountedRef.current = false;
      stopTiebreakSwitching();
      for (const timeoutId of timeoutIds) {
        window.clearTimeout(timeoutId);
      }
      timeoutIds.clear();
    };
  }, [stopTiebreakSwitching]);

  const requestVote = useCallback(
    (song: GameSong) => {
      if (!currentMatch) return;
      if (!send({ type: "request", decision: { type: "vote", song } })) return;
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      pausePlayback();
    },
    [currentMatch, pausePlayback, send],
  );

  const requestTiebreak = useCallback(() => {
    if (!currentMatch) return;
    if (!send({ type: "request", decision: { type: "tiebreak" } })) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    pausePlayback();
  }, [currentMatch, pausePlayback, send]);

  const confirmDecision = useCallback(async () => {
    const pendingDecision = machineRef.current.pendingDecision;
    if (!currentMatch || !pendingDecision || !send({ type: "submit" })) return;

    const decision: MatchDecision =
      pendingDecision.type === "vote"
        ? { type: "vote", winnerSongId: pendingDecision.song.songId }
        : { type: "tiebreak" };

    pausePlayback();
    try {
      const payload = await submitMatchDecision(
        gameState.session.id,
        currentMatch.id,
        decision,
      );
      if (decision.type === "tiebreak") {
        const completedMatch = payload.matches.find(
          (match) => match.id === currentMatch.id,
        );
        const winner = songs.find(
          (song) => song.songId === completedMatch?.winnerSongId,
        );
        const participantA = songs.find(
          (song) => song.songId === currentMatch.songAId,
        );
        const participantB = songs.find(
          (song) => song.songId === currentMatch.songBId,
        );
        if (!winner || !participantA || !participantB) {
          throw new Error("O servidor não informou a vencedora do desempate.");
        }
        const participants = [participantA, participantB] as const;
        const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;
        let activeParticipantIndex = 0;

        if (!send({ type: "revealStarted", participants, winner })) return;

        if (!reducedMotion) {
          switchTimerRef.current = window.setInterval(() => {
            activeParticipantIndex = activeParticipantIndex === 0 ? 1 : 0;
            send({
              type: "revealAdvanced",
              activeSongId: participants[activeParticipantIndex].songId,
            });
          }, TIEBREAK_SWITCH_INTERVAL_MS);
          await wait(TIEBREAK_SPIN_DURATION_MS);
          stopTiebreakSwitching();
        }

        send({ type: "revealSettled" });
        await wait(TIEBREAK_RESULT_HOLD_MS);
      }
      send({ type: "completed" });
      applyState(payload);
    } catch (caught) {
      send({
        type: "failed",
        message:
          caught instanceof Error
            ? caught.message
            : "Não foi possível registrar a decisão.",
      });
    }
  }, [
    applyState,
    currentMatch,
    gameState.session.id,
    pausePlayback,
    send,
    songs,
    stopTiebreakSwitching,
    wait,
  ]);

  const cancelDecision = useCallback(() => {
    const returnFocusTo = returnFocusRef.current;
    if (!send({ type: "cancel" })) return;
    queueMicrotask(() => returnFocusTo?.focus());
  }, [send]);

  return {
    clearMessage: () => send({ type: "clearMessage" }),
    confirmDecision,
    isDeciding: machine.phase === "submitting" || machine.phase === "revealing",
    message: machine.message,
    pendingDecision: machine.pendingDecision,
    requestTiebreak,
    requestVote,
    tiebreakReveal: machine.tiebreakReveal,
    cancelDecision,
  };
}
