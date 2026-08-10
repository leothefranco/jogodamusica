import type { GameSong } from "@/domain/game/state";

export type PendingDecision =
  { type: "vote"; song: GameSong } | { type: "tiebreak" };

export type TiebreakRevealState = {
  participants: readonly [GameSong, GameSong];
  winner: GameSong;
  activeSongId: string;
  isSpinning: boolean;
};

export type DecisionMachineState = {
  phase: "idle" | "confirming" | "submitting" | "revealing";
  pendingDecision: PendingDecision | null;
  tiebreakReveal: TiebreakRevealState | null;
  message: string | null;
};

export type DecisionMachineEvent =
  | { type: "request"; decision: PendingDecision }
  | { type: "submit" }
  | { type: "failed"; message: string }
  | {
      type: "revealStarted";
      participants: readonly [GameSong, GameSong];
      winner: GameSong;
    }
  | { type: "revealAdvanced"; activeSongId: string }
  | { type: "revealSettled" }
  | { type: "completed" }
  | { type: "cancel" }
  | { type: "clearMessage" };

export function createDecisionMachineState(): DecisionMachineState {
  return {
    phase: "idle",
    pendingDecision: null,
    tiebreakReveal: null,
    message: null,
  };
}

export function transitionDecisionMachine(
  state: DecisionMachineState,
  event: DecisionMachineEvent,
): DecisionMachineState {
  if (event.type === "request") {
    if (state.phase !== "idle") return state;
    return {
      ...state,
      phase: "confirming",
      pendingDecision: event.decision,
      message: null,
    };
  }

  if (event.type === "submit") {
    if (state.phase !== "confirming" || !state.pendingDecision) return state;
    return { ...state, phase: "submitting", message: null };
  }

  if (event.type === "failed") {
    if (state.phase !== "submitting") return state;
    return {
      ...state,
      phase: state.pendingDecision ? "confirming" : "idle",
      message: event.message,
    };
  }

  if (event.type === "revealStarted") {
    if (state.phase !== "submitting") return state;
    return {
      ...state,
      phase: "revealing",
      pendingDecision: null,
      tiebreakReveal: {
        participants: event.participants,
        winner: event.winner,
        activeSongId: event.participants[0].songId,
        isSpinning: true,
      },
    };
  }

  if (event.type === "revealAdvanced") {
    if (state.phase !== "revealing" || !state.tiebreakReveal?.isSpinning) {
      return state;
    }
    return {
      ...state,
      tiebreakReveal: {
        ...state.tiebreakReveal,
        activeSongId: event.activeSongId,
      },
    };
  }

  if (event.type === "revealSettled") {
    if (state.phase !== "revealing" || !state.tiebreakReveal) return state;
    return {
      ...state,
      tiebreakReveal: {
        ...state.tiebreakReveal,
        activeSongId: state.tiebreakReveal.winner.songId,
        isSpinning: false,
      },
    };
  }

  if (event.type === "completed") {
    if (state.phase !== "submitting" && state.phase !== "revealing") {
      return state;
    }
    return createDecisionMachineState();
  }

  if (event.type === "cancel") {
    if (state.phase !== "confirming") return state;
    return createDecisionMachineState();
  }

  if (event.type === "clearMessage") {
    if (!state.message) return state;
    return { ...state, message: null };
  }

  return state;
}
