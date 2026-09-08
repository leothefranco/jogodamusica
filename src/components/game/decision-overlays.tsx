"use client";

import { Dialog } from "@base-ui/react/dialog";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import type {
  PendingDecision,
  TiebreakRevealState,
} from "@/components/game/decision-machine";
import type { GameSong } from "@/domain/game/state";

export type {
  PendingDecision,
  TiebreakRevealState,
} from "@/components/game/decision-machine";

function TiebreakSongCard({
  song,
  label,
  active,
  winner,
}: {
  song: GameSong;
  label: "A" | "B";
  active: boolean;
  winner: boolean;
}) {
  return (
    <div
      data-contender={label}
      className={`game-reveal-card overflow-hidden rounded-none border text-left transition-all ${
        active
          ? "scale-[1.02] border-white bg-white/10"
          : "border-white/10 bg-white/5 opacity-60"
      }`}
    >
      <div
        role="img"
        aria-label={`Capa de ${song.title}, de ${song.artist}`}
        className="aspect-video w-full bg-cover bg-center"
        style={{ backgroundImage: `url(${JSON.stringify(song.thumbnailUrl)})` }}
      />
      <div className="p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="game-reveal-label text-xs font-black tracking-widest uppercase">
            Música {label}
          </span>
          {winner && (
            <span className="rounded-none bg-[#F5F3ED] px-2 py-0.5 text-[0.65rem] font-black tracking-wide text-[#101216] uppercase">
              Vencedora
            </span>
          )}
        </div>
        <p className="mt-1 truncate font-bold">{song.title}</p>
        <p className="truncate text-xs text-white/55">{song.artist}</p>
      </div>
    </div>
  );
}

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
    <Dialog.Root
      open={decision !== null}
      onOpenChange={(open) => {
        if (!open && !busy) onCancel();
      }}
      disablePointerDismissal
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm" />
        <Dialog.Viewport className="fixed inset-0 z-50 grid place-items-center p-5">
          <Dialog.Popup className="game-decision-dialog w-full max-w-sm rounded-none border border-white/12 bg-[#101216] p-5 text-white shadow-2xl">
            <Dialog.Title className="text-xl font-black">{title}</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-6 text-white/65">
              {isTiebreak
                ? "Uma das duas músicas será escolhida ao acaso para avançar."
                : `Confirmar voto em “${decision.song.title}”, de ${decision.song.artist}?`}{" "}
              Esta decisão não poderá ser desfeita.
            </Dialog.Description>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Dialog.Close
                render={<Button variant="secondary" />}
                disabled={busy}
              >
                Cancelar
              </Dialog.Close>
              <Button type="button" onClick={onConfirm} disabled={busy}>
                {busy && (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                )}
                {isTiebreak ? "Sortear vencedora" : "Confirmar voto"}
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function AbandonConfirmation({
  open,
  busy,
  errorMessage,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  errorMessage: string | null;
  onCancel(): void;
  onConfirm(): void;
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !busy) onCancel();
      }}
      disablePointerDismissal
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm" />
        <Dialog.Viewport className="fixed inset-0 z-50 grid place-items-center p-5">
          <Dialog.Popup className="game-decision-dialog w-full max-w-sm rounded-none border border-white/12 bg-[#101216] p-5 text-white shadow-2xl">
            <Dialog.Title className="text-xl font-black">
              Abandonar partida?
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-6 text-white/65">
              O progresso atual será encerrado e esta partida não poderá ser
              retomada. Você voltará para a página do tema.
            </Dialog.Description>
            {errorMessage ? (
              <p
                role="alert"
                className="mt-3 rounded-xl border border-rose-300/20 bg-rose-300/10 p-3 text-sm text-rose-100"
              >
                {errorMessage}
              </p>
            ) : null}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Dialog.Close
                render={<Button variant="secondary" />}
                disabled={busy}
              >
                Continuar jogando
              </Dialog.Close>
              <Button type="button" onClick={onConfirm} disabled={busy}>
                {busy && (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                )}
                {busy ? "Abandonando..." : "Abandonar partida"}
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function TiebreakReveal({
  reveal,
}: {
  reveal: TiebreakRevealState | null;
}) {
  if (!reveal) return null;

  const winnerLabel =
    reveal.participants[0].songId === reveal.winner.songId ? "A" : "B";

  return (
    <div
      role="status"
      aria-label="Roleta de desempate"
      aria-live="assertive"
      className="fixed inset-0 z-50 grid place-items-center bg-[#101216]/92 p-5 text-center backdrop-blur-md"
    >
      <div className="w-full max-w-md">
        <div
          className={`mx-auto grid size-24 place-items-center rounded-full border-4 border-white/20 bg-[conic-gradient(#38BDF8_0_25%,#FF923D_0_50%,#38BDF8_0_75%,#FF923D_0)] ${reveal.isSpinning ? "animate-[spin_700ms_linear_infinite]" : ""}`}
          aria-hidden="true"
        >
          <span className="size-5 rounded-full bg-[#101216] ring-2 ring-white/70" />
        </div>
        <p className="mt-5 text-sm font-bold tracking-[0.18em] text-[#F5F3ED] uppercase">
          {reveal.isSpinning ? "Roleta em movimento" : "Desempate concluído"}
        </p>
        <p className="mt-2 text-lg font-bold text-white/70">
          {reveal.isSpinning
            ? "Revelando a vencedora..."
            : `Música ${winnerLabel}: ${reveal.winner.title} avança`}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {reveal.participants.map((song, index) => (
            <TiebreakSongCard
              key={song.songId}
              song={song}
              label={index === 0 ? "A" : "B"}
              active={song.songId === reveal.activeSongId}
              winner={
                !reveal.isSpinning && song.songId === reveal.winner.songId
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
