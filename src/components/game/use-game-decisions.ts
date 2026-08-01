"use client";

import { useCallback, useRef, useState } from "react";

import type {
  PendingDecision,
  TiebreakRevealState,
} from "@/components/game/decision-overlays";
import type { MatchDecision } from "@/domain/bracket";
import type {
  GameSong,
  GameState,
  PersistedGameMatch,
} from "@/domain/game/state";

const TIEBREAK_SPIN_DURATION_MS = 700;

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
  const payload = (await response.json()) as GameState & {
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(
      payload.error?.message ?? "Não foi possível registrar a decisão.",
    );
  }
  return payload;
}

export function useGameDecisions({
  sessionId,
  currentMatch,
  songs,
  canDecide,
  pausePlayback,
  applyState,
}: {
  sessionId: string;
  currentMatch: PersistedGameMatch | null;
  songs: readonly GameSong[];
  canDecide: boolean;
  pausePlayback(): void;
  applyState(state: GameState): void;
}) {
  const [pendingDecision, setPendingDecision] =
    useState<PendingDecision | null>(null);
  const [tiebreakReveal, setTiebreakReveal] =
    useState<TiebreakRevealState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isDeciding, setIsDeciding] = useState(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const requestVote = useCallback(
    (song: GameSong) => {
      if (!currentMatch || !canDecide) return;
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      pausePlayback();
      setPendingDecision({ type: "vote", song });
    },
    [canDecide, currentMatch, pausePlayback],
  );

  const requestTiebreak = useCallback(() => {
    if (!currentMatch || !canDecide) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    pausePlayback();
    setPendingDecision({ type: "tiebreak" });
  }, [canDecide, currentMatch, pausePlayback]);

  const confirmDecision = useCallback(async () => {
    if (!currentMatch || !pendingDecision) return;

    const decision: MatchDecision =
      pendingDecision.type === "vote"
        ? { type: "vote", winnerSongId: pendingDecision.song.songId }
        : { type: "tiebreak" };

    setIsDeciding(true);
    setMessage(null);
    pausePlayback();
    try {
      const payload = await submitMatchDecision(
        sessionId,
        currentMatch.id,
        decision,
      );
      setPendingDecision(null);
      if (decision.type === "tiebreak") {
        const completedMatch = payload.matches.find(
          (match) => match.id === currentMatch.id,
        );
        const winner = songs.find(
          (song) => song.songId === completedMatch?.winnerSongId,
        );
        if (!winner) {
          throw new Error("O servidor não informou a vencedora do desempate.");
        }
        setTiebreakReveal({ winner, isSpinning: true });
        await new Promise((resolve) =>
          setTimeout(resolve, TIEBREAK_SPIN_DURATION_MS),
        );
        setTiebreakReveal({ winner, isSpinning: false });
        await new Promise((resolve) =>
          setTimeout(resolve, TIEBREAK_SPIN_DURATION_MS),
        );
        setTiebreakReveal(null);
      }
      applyState(payload);
    } catch (caught) {
      setMessage(
        caught instanceof Error
          ? caught.message
          : "Não foi possível registrar a decisão.",
      );
    } finally {
      setIsDeciding(false);
    }
  }, [
    applyState,
    currentMatch,
    pausePlayback,
    pendingDecision,
    sessionId,
    songs,
  ]);

  const cancelDecision = useCallback(() => {
    const returnFocusTo = returnFocusRef.current;
    setPendingDecision(null);
    queueMicrotask(() => returnFocusTo?.focus());
  }, []);

  return {
    clearMessage: () => setMessage(null),
    confirmDecision,
    isDeciding,
    message,
    pendingDecision,
    requestTiebreak,
    requestVote,
    tiebreakReveal,
    cancelDecision,
  };
}
