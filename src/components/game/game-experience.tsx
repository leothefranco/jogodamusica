"use client";

import { Check, Dices, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  YouTubePlayer,
  type YouTubePlayerHandle,
} from "@/components/game/youtube-player";
import {
  AbandonConfirmation,
  DecisionConfirmation,
  TiebreakReveal,
} from "@/components/game/decision-overlays";
import { useGameDecisions } from "@/components/game/use-game-decisions";
import { Button } from "@/components/ui/button";
import { getRoundLabel } from "@/domain/game/experience";
import { projectCurrentConfrontation } from "@/domain/game/projections";
import type { GameSong, GameState } from "@/domain/game/state";

function SongCard({
  label,
  song,
  onVote,
  playerError,
  playerRef,
  onPlayerError,
  onPlayerLoadError,
  onPlayingChange,
  canVote,
  voting,
}: {
  label: "A" | "B";
  song: GameSong;
  onVote(): void;
  playerError: string | null;
  playerRef: React.RefObject<YouTubePlayerHandle | null>;
  onPlayerError(errorCode: number): void;
  onPlayerLoadError(): void;
  onPlayingChange(playing: boolean): void;
  canVote: boolean;
  voting: boolean;
}) {
  return (
    <article className="game-song-card rounded-2xl border border-white/10 bg-white/[0.035] p-2">
      <div className="flex min-w-0 items-center gap-2 px-1 pb-1.5">
        <p className="shrink-0 text-xs font-bold tracking-[0.12em] text-violet-300 uppercase">
          Música {label}
        </p>
        <h2 className="min-w-0 flex-1 truncate text-sm font-bold">
          {song.title}
        </h2>
        <p className="max-w-[35%] truncate text-xs text-white/50">
          {song.artist}
        </p>
      </div>
      <div className="game-player-wrap relative">
        <YouTubePlayer
          ref={playerRef}
          label={label}
          song={song}
          onError={onPlayerError}
          onLoadError={onPlayerLoadError}
          onPlayingChange={onPlayingChange}
        />
        <p
          role={playerError ? "alert" : "status"}
          aria-live="polite"
          className="pointer-events-none absolute inset-x-2 top-2 z-10 rounded-lg bg-black/85 px-2 text-xs text-rose-100 empty:hidden"
        >
          {playerError}
        </p>
      </div>
      <Button
        type="button"
        onClick={onVote}
        aria-label={`Votar na música ${label}`}
        disabled={!canVote || voting}
        className="mt-2 min-h-11 w-full rounded-xl bg-violet-300 px-3 font-bold text-[#160d25] hover:bg-violet-200"
      >
        {voting ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <Check aria-hidden="true" />
        )}
        Votar {label}
      </Button>
    </article>
  );
}

export function GameExperience({ initialState }: { initialState: GameState }) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const playerARef = useRef<YouTubePlayerHandle>(null);
  const playerBRef = useRef<YouTubePlayerHandle>(null);
  const [playerErrors, setPlayerErrors] = useState<
    Partial<Record<"A" | "B", { matchId: string; message: string }>>
  >({});
  const [message, setMessage] = useState<string | null>(null);
  const [isAbandoning, setIsAbandoning] = useState(false);
  const [abandonError, setAbandonError] = useState<string | null>(null);
  const [isAbandonConfirmationOpen, setIsAbandonConfirmationOpen] =
    useState(false);

  const confrontation = projectCurrentConfrontation(state);
  const currentMatch = confrontation?.match ?? null;
  const songA = confrontation?.songA ?? null;
  const songB = confrontation?.songB ?? null;
  const canVote = Boolean(currentMatch);

  const pausePlayback = useCallback(() => {
    playerARef.current?.pause();
    playerBRef.current?.pause();
  }, []);
  const applyDecisionState = useCallback((payload: GameState) => {
    setState(payload);
  }, []);
  const decisions = useGameDecisions({
    gameState: state,
    pausePlayback,
    applyState: applyDecisionState,
  });

  useEffect(() => {
    if (state.session.status === "completed") {
      router.replace(`/resultado/${state.session.id}`);
    }
  }, [router, state.session.id, state.session.status]);

  const registerPlayerFailure = useCallback(
    (label: "A" | "B", failureMessage: string) => {
      if (!currentMatch) return;
      setPlayerErrors((current) => ({
        ...current,
        [label]: { matchId: currentMatch.id, message: failureMessage },
      }));
    },
    [currentMatch],
  );

  const reportPlayerError = useCallback(
    (label: "A" | "B", errorCode: number) => {
      registerPlayerFailure(
        label,
        "Este vídeo não pôde ser reproduzido. Tente novamente.",
      );
      void fetch(`/api/games/${state.session.id}/player-errors`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          errorCode,
          matchId: currentMatch?.id,
        }),
      });
    },
    [currentMatch?.id, registerPlayerFailure, state.session.id],
  );

  const reportPlayerLoadError = useCallback(
    (label: "A" | "B") => {
      registerPlayerFailure(
        label,
        "Não foi possível carregar este player. Tente novamente.",
      );
    },
    [registerPlayerFailure],
  );

  const playerRefs = { A: playerARef, B: playerBRef };

  function playingChanged(label: "A" | "B", playing: boolean) {
    if (!playing) return;
    setMessage(null);
    decisions.clearMessage();
    playerRefs[label === "A" ? "B" : "A"].current?.pause();
  }

  async function abandon() {
    setIsAbandoning(true);
    setAbandonError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/games/${state.session.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "abandon" }),
      });
      if (!response.ok) {
        throw new Error("Não foi possível abandonar a partida.");
      }
      router.push(`/tema/${state.theme.slug}`);
    } catch (caught) {
      setAbandonError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível abandonar a partida.",
      );
      setIsAbandoning(false);
    }
  }

  if (!currentMatch || !songA || !songB) {
    const transitionMessage =
      state.session.status === "completed"
        ? "Partida concluída. Abrindo o resultado..."
        : "Preparando o próximo confronto...";

    return (
      <main className="grid min-h-screen place-items-center bg-[#08080f] px-5 text-white">
        <div role="status" className="text-center">
          <LoaderCircle
            className="mx-auto size-8 animate-spin text-violet-300"
            aria-hidden="true"
          />
          <p className="mt-4 text-white/60">{transitionMessage}</p>
        </div>
      </main>
    );
  }

  const roundLabel = getRoundLabel({
    bracketSize: state.session.bracketSize,
    roundNumber: currentMatch.roundNumber,
    matchPosition: currentMatch.position,
  });
  const progress = confrontation?.progressPercent ?? 0;
  const matchPlayers = [
    { label: "A" as const, song: songA, playerRef: playerARef },
    { label: "B" as const, song: songB, playerRef: playerBRef },
  ];

  return (
    <main
      className="game-screen relative bg-[#08080f] text-white"
      aria-busy={decisions.isDeciding}
    >
      <div className="grid-fade pointer-events-none absolute inset-0 opacity-30" />
      <div className="game-shell relative mx-auto">
        <header className="game-header flex items-center justify-between gap-2">
          <div className="min-w-0">
            <Link
              href="/"
              className="text-xs font-semibold tracking-[0.16em] text-violet-300 uppercase outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
            >
              Jogo da Música
            </Link>
            <h1 className="truncate text-lg font-black">{state.theme.name}</h1>
          </div>
          <p className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/65">
            {roundLabel}
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={decisions.requestTiebreak}
            disabled={!canVote || decisions.isDeciding}
            aria-label="Desempatar"
            className="min-h-11 rounded-xl px-3"
          >
            <Dices aria-hidden="true" />
            <span className="hidden min-[430px]:inline">Empate</span>
          </Button>
        </header>

        <div className="game-matchup grid gap-2">
          {matchPlayers.map(({ label, song, playerRef }) => (
            <SongCard
              key={`${currentMatch.id}-${label}`}
              label={label}
              song={song}
              onVote={() => decisions.requestVote(song)}
              playerError={
                playerErrors[label]?.matchId === currentMatch.id
                  ? playerErrors[label].message
                  : null
              }
              playerRef={playerRef}
              onPlayerError={(errorCode) => reportPlayerError(label, errorCode)}
              onPlayerLoadError={() => reportPlayerLoadError(label)}
              onPlayingChange={(playing) => playingChanged(label, playing)}
              canVote={canVote}
              voting={decisions.isDeciding}
            />
          ))}
        </div>

        <section
          aria-label="Estado do confronto"
          className="game-status mx-auto w-full"
        >
          <p
            role={message ? "alert" : "status"}
            aria-live="polite"
            className="min-h-5 truncate text-center text-xs text-white/55"
          >
            {decisions.message ??
              message ??
              "Escolha quem avança ou declare empate."}
          </p>
        </section>

        <section aria-label="Progresso da partida" className="game-progress">
          <div className="flex justify-between text-xs text-white/45">
            <span>Progresso do chaveamento</span>
            <span>
              {state.progress.completedMatches} / {state.progress.totalMatches}
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="Progresso do chaveamento"
            aria-valuemin={0}
            aria-valuemax={state.progress.totalMatches}
            aria-valuenow={state.progress.completedMatches}
            className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/8"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400 transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </section>

        <div className="game-abandon text-center">
          <button
            type="button"
            onClick={() => {
              pausePlayback();
              setAbandonError(null);
              setIsAbandonConfirmationOpen(true);
            }}
            disabled={isAbandoning || decisions.isDeciding}
            className="min-h-11 rounded-lg px-4 text-sm text-white/45 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-violet-300"
          >
            {isAbandoning
              ? "Abandonando partida..."
              : "Abandonar partida e voltar ao tema"}
          </button>
        </div>
      </div>
      <DecisionConfirmation
        decision={decisions.pendingDecision}
        busy={decisions.isDeciding}
        onCancel={decisions.cancelDecision}
        onConfirm={() => void decisions.confirmDecision()}
      />
      <AbandonConfirmation
        open={isAbandonConfirmationOpen}
        busy={isAbandoning}
        errorMessage={abandonError}
        onCancel={() => {
          setAbandonError(null);
          setIsAbandonConfirmationOpen(false);
        }}
        onConfirm={() => void abandon()}
      />
      <TiebreakReveal reveal={decisions.tiebreakReveal} />
    </main>
  );
}
