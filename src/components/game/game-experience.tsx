"use client";

import { Check, Headphones, LoaderCircle, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { YouTubePlayer } from "@/components/game/youtube-player";
import { Button } from "@/components/ui/button";
import {
  createPlaybackGate,
  getRoundLabel,
  markSongStarted,
} from "@/domain/game/experience";
import type { GameSong, GameState } from "@/domain/game/state";

function SongCard({
  label,
  song,
  heard,
  onListen,
  onVote,
  canVote,
  voting,
}: {
  label: "A" | "B";
  song: GameSong;
  heard: boolean;
  onListen(): void;
  onVote(): void;
  canVote: boolean;
  voting: boolean;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
      <p className="text-xs font-bold tracking-[0.16em] text-violet-300 uppercase">
        Música {label}
      </p>
      <div className="mt-3 aspect-video overflow-hidden rounded-2xl bg-white/5">
        {/* YouTube thumbnails are provider metadata and the adjacent text identifies the song. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={song.thumbnailUrl}
          alt=""
          className="h-full w-full object-cover"
        />
      </div>
      <h2 className="mt-4 text-xl font-bold text-balance">{song.title}</h2>
      <p className="mt-1 text-sm text-white/50">{song.artist}</p>

      <Button
        type="button"
        variant="secondary"
        onClick={onListen}
        className="mt-5 min-h-11 w-full rounded-xl"
      >
        {heard ? (
          <RotateCcw aria-hidden="true" />
        ) : (
          <Headphones aria-hidden="true" />
        )}
        {heard ? `Ouvir música ${label} novamente` : `Ouvir música ${label}`}
      </Button>
      <Button
        type="button"
        onClick={onVote}
        disabled={!canVote || voting}
        className="mt-3 min-h-12 w-full rounded-xl bg-violet-300 font-bold text-[#160d25] hover:bg-violet-200"
      >
        {voting ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <Check aria-hidden="true" />
        )}
        Votar na música {label}
      </Button>
    </article>
  );
}

export function GameExperience({ initialState }: { initialState: GameState }) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [activeTrack, setActiveTrack] = useState<GameSong | null>(null);
  const [requestToken, setRequestToken] = useState(0);
  const [gate, setGate] = useState(() =>
    createPlaybackGate(initialState.currentMatch?.id ?? ""),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const [isAbandoning, setIsAbandoning] = useState(false);

  const currentMatch = state.currentMatch;
  const songsById = useMemo(
    () => new Map(state.songs.map((song) => [song.songId, song])),
    [state.songs],
  );
  const songA = currentMatch?.songAId
    ? songsById.get(currentMatch.songAId)
    : null;
  const songB = currentMatch?.songBId
    ? songsById.get(currentMatch.songBId)
    : null;

  useEffect(() => {
    if (state.session.status === "completed") {
      router.replace(`/resultado/${state.session.id}`);
    }
  }, [router, state.session.id, state.session.status]);

  const reportPlayerError = useCallback(
    (errorCode: number) => {
      setMessage(
        "Este vídeo não pôde ser reproduzido. Tente novamente ou volte ao tema.",
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
    [currentMatch?.id, state.session.id],
  );

  const markPlaybackAsStarted = useCallback((songId: string) => {
    setGate((current) => markSongStarted(current, songId));
  }, []);

  const reportPlayerLoadError = useCallback(() => {
    setMessage(
      "Não foi possível carregar o player do YouTube. Verifique sua conexão e tente novamente.",
    );
  }, []);

  function listen(song: GameSong) {
    setMessage(null);
    setActiveTrack(song);
    setRequestToken((token) => token + 1);
  }

  async function vote(song: GameSong) {
    if (!currentMatch || gate.matchId !== currentMatch.id || !gate.canVote)
      return;
    if (
      !window.confirm(
        `Confirmar voto em “${song.title}”, de ${song.artist}? O voto não poderá ser desfeito.`,
      )
    )
      return;

    setIsVoting(true);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/games/${state.session.id}/matches/${currentMatch.id}/decision`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ type: "vote", winnerSongId: song.songId }),
        },
      );
      const payload = (await response.json()) as GameState & {
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(
          payload.error?.message ?? "Não foi possível registrar o voto.",
        );
      }
      setState(payload);
      setGate(createPlaybackGate(payload.currentMatch?.id ?? ""));
      setActiveTrack(null);
      setMessage(null);
    } catch (caught) {
      setMessage(
        caught instanceof Error
          ? caught.message
          : "Não foi possível registrar o voto.",
      );
    } finally {
      setIsVoting(false);
    }
  }

  async function abandon() {
    setIsAbandoning(true);
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
      setMessage(
        caught instanceof Error
          ? caught.message
          : "Não foi possível abandonar a partida.",
      );
      setIsAbandoning(false);
    }
  }

  if (!currentMatch || !songA || !songB) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#08080f] px-5 text-white">
        <div role="status" className="text-center">
          <LoaderCircle
            className="mx-auto size-8 animate-spin text-violet-300"
            aria-hidden="true"
          />
          <p className="mt-4 text-white/60">
            Preparando o próximo confronto...
          </p>
        </div>
      </main>
    );
  }

  const canVote = gate.matchId === currentMatch.id && gate.canVote;
  const roundLabel = getRoundLabel({
    bracketSize: state.session.bracketSize,
    roundNumber: currentMatch.roundNumber,
    matchPosition: currentMatch.position,
  });
  const progress =
    state.progress.totalMatches === 0
      ? 0
      : (state.progress.completedMatches / state.progress.totalMatches) * 100;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#08080f] px-4 py-6 text-white sm:px-8">
      <div className="grid-fade pointer-events-none absolute inset-0 opacity-30" />
      <div className="relative mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              href="/"
              className="text-xs font-semibold tracking-[0.16em] text-violet-300 uppercase outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
            >
              Jogo da Música
            </Link>
            <h1 className="mt-1 text-xl font-black">{state.theme.name}</h1>
          </div>
          <p className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/65">
            {roundLabel}
          </p>
        </header>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <SongCard
            label="A"
            song={songA}
            heard={gate.startedSongIds.has(songA.songId)}
            onListen={() => listen(songA)}
            onVote={() => void vote(songA)}
            canVote={canVote}
            voting={isVoting}
          />
          <SongCard
            label="B"
            song={songB}
            heard={gate.startedSongIds.has(songB.songId)}
            onListen={() => listen(songB)}
            onVote={() => void vote(songB)}
            canVote={canVote}
            voting={isVoting}
          />
        </div>

        <section aria-label="Reprodução" className="mx-auto mt-5 max-w-3xl">
          <YouTubePlayer
            track={activeTrack}
            requestToken={requestToken}
            onError={reportPlayerError}
            onLoadError={reportPlayerLoadError}
            onStarted={markPlaybackAsStarted}
          />
          <p
            role={message ? "alert" : "status"}
            aria-live="polite"
            className="mt-3 min-h-6 text-center text-sm text-white/55"
          >
            {message ??
              (canVote
                ? "As duas músicas foram iniciadas. Escolha quem avança."
                : "Inicie as duas músicas para liberar o voto.")}
          </p>
        </section>

        <section aria-label="Progresso da partida" className="mt-6">
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
            className="mt-2 h-2 overflow-hidden rounded-full bg-white/8"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400 transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </section>

        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => void abandon()}
            disabled={isAbandoning}
            className="min-h-11 rounded-lg px-4 text-sm text-white/45 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-violet-300"
          >
            {isAbandoning
              ? "Abandonando partida..."
              : "Abandonar partida e voltar ao tema"}
          </button>
        </div>
      </div>
    </main>
  );
}
