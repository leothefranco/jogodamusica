"use client";

import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { GameSong } from "@/domain/game/state";

export type PendingDecision =
  { type: "vote"; song: GameSong } | { type: "tiebreak" };

export type TiebreakRevealState = {
  winner: GameSong;
  isSpinning: boolean;
};

export function DecisionConfirmation({
  decision,
  busy,
  onCancel,
  onConfirm,
}: {
  decision: PendingDecision | null;
  busy: boolean;
  onCancel(): void;
  onConfirm(): void;
}) {
  if (!decision) return null;

  const isTiebreak = decision.type === "tiebreak";
  const title = isTiebreak ? "Confirmar desempate" : "Confirmar voto";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="decision-dialog-title"
      className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-5 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-2xl border border-white/12 bg-[#15101f] p-5 shadow-2xl">
        <h2 id="decision-dialog-title" className="text-xl font-black">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-white/65">
          {isTiebreak
            ? "O servidor sorteará uma vencedora definitiva entre as duas músicas."
            : `Confirmar voto em “${decision.song.title}”, de ${decision.song.artist}?`}{" "}
          Esta decisão não poderá ser desfeita.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={onConfirm} disabled={busy} autoFocus>
            {busy && (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            )}
            {isTiebreak ? "Sortear vencedora" : "Confirmar voto"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function TiebreakReveal({
  reveal,
}: {
  reveal: TiebreakRevealState | null;
}) {
  if (!reveal) return null;

  return (
    <div
      role="status"
      aria-label="Roleta de desempate"
      aria-live="assertive"
      className="fixed inset-0 z-50 grid place-items-center bg-[#08080f]/92 p-5 text-center backdrop-blur-md"
    >
      <div>
        <div
          className={`mx-auto grid size-24 place-items-center rounded-full border-4 border-white/20 bg-[conic-gradient(#c4b5fd_0_25%,#e879f9_0_50%,#c4b5fd_0_75%,#e879f9_0)] shadow-[0_0_45px_rgba(196,181,253,0.35)] ${reveal.isSpinning ? "animate-[spin_700ms_ease-in-out]" : ""}`}
          aria-hidden="true"
        >
          <span className="size-5 rounded-full bg-[#08080f] ring-2 ring-white/70" />
        </div>
        <p className="mt-5 text-sm font-bold tracking-[0.18em] text-violet-300 uppercase">
          {reveal.isSpinning ? "Roleta em movimento" : "Desempate concluído"}
        </p>
        {reveal.isSpinning ? (
          <p className="mt-2 text-lg font-bold text-white/70">
            Revelando a vencedora...
          </p>
        ) : (
          <>
            <p className="mt-2 text-3xl font-black">{reveal.winner.title}</p>
            <p className="mt-1 text-white/60">{reveal.winner.artist} avança</p>
          </>
        )}
      </div>
    </div>
  );
}
