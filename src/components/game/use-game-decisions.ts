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

const TIEBREAK_SPIN_DURATION_MS = 2_500;
const TIEBREAK_RESULT_HOLD_MS = 700;
const TIEBREAK_SWITCH_INTERVAL_MS = 180;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function wait(durationMs: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, durationMs));
}

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
  const decidingRef = useRef(false);
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
    if (!currentMatch || !pendingDecision || decidingRef.current) return;

    const decision: MatchDecision =
      pendingDecision.type === "vote"
        ? { type: "vote", winnerSongId: pendingDecision.song.songId }
        : { type: "tiebreak" };

    decidingRef.current = true;
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
        let switchTimer: number | null = null;

        if (!reducedMotion) {
          setTiebreakReveal({
            participants,
            winner,
            activeSongId: participants[activeParticipantIndex].songId,
            isSpinning: true,
          });
          switchTimer = window.setInterval(() => {
            activeParticipantIndex = activeParticipantIndex === 0 ? 1 : 0;
            setTiebreakReveal({
              participants,
              winner,
              activeSongId: participants[activeParticipantIndex].songId,
              isSpinning: true,
            });
          }, TIEBREAK_SWITCH_INTERVAL_MS);
          await wait(TIEBREAK_SPIN_DURATION_MS);
          window.clearInterval(switchTimer);
        }

        setTiebreakReveal({
          participants,
          winner,
          activeSongId: winner.songId,
          isSpinning: false,
        });
        await wait(TIEBREAK_RESULT_HOLD_MS);
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
      decidingRef.current = false;
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
