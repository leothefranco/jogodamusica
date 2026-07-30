"use client";

import { useEffect, useRef } from "react";

import type { GameSong } from "@/domain/game/state";

let youtubeApiPromise: Promise<YouTubeNamespace> | null = null;

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    const timeout = window.setTimeout(() => {
      youtubeApiPromise = null;
      reject(new Error("Tempo esgotado ao carregar o player do YouTube."));
    }, 15_000);

    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timeout);
      previousReady?.();
      resolve(window.YT!);
    };

    if (!document.getElementById("youtube-iframe-api")) {
      const script = document.createElement("script");
      script.id = "youtube-iframe-api";
      script.src = "https://www.youtube.com/iframe_api";
      script.onerror = () => {
        window.clearTimeout(timeout);
        youtubeApiPromise = null;
        script.remove();
        reject(new Error("Falha ao carregar o player do YouTube."));
      };
      document.head.append(script);
    }
  });

  return youtubeApiPromise;
}

type YouTubePlayerProps = {
  track: GameSong | null;
  requestToken: number;
  onError(errorCode: number): void;
  onLoadError(): void;
  onStarted(songId: string): void;
};

export function YouTubePlayer({
  track,
  requestToken,
  onError,
  onLoadError,
  onStarted,
}: YouTubePlayerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const playerHostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trackRef = useRef(track);

  useEffect(() => {
    trackRef.current = track;
  }, [track]);

  useEffect(() => {
    let cancelled = false;

    async function playRequestedTrack() {
      if (!track || !playerHostRef.current) return;
      let youtube: YouTubeNamespace;
      try {
        youtube = await loadYouTubeApi();
      } catch {
        onLoadError();
        return;
      }
      if (cancelled || !playerHostRef.current) return;

      if (!playerRef.current) {
        playerRef.current = await new Promise<YouTubePlayer>((resolve) => {
          const player = new youtube.Player(playerHostRef.current!, {
            height: "100%",
            width: "100%",
            playerVars: { playsinline: 1, rel: 0 },
            events: {
              onReady: () => resolve(player),
              onStateChange: (event) => {
                if (event.data !== youtube.PlayerState.PLAYING) return;
                if (timerRef.current) clearTimeout(timerRef.current);
                const currentTrack = trackRef.current;
                if (!currentTrack) return;
                onStarted(currentTrack.songId);
                const previewEnd =
                  currentTrack.startTimeSeconds +
                  currentTrack.previewDurationSeconds;
                const remainingSeconds = Math.max(
                  previewEnd - event.target.getCurrentTime(),
                  0,
                );
                timerRef.current = setTimeout(
                  () => event.target.pauseVideo(),
                  remainingSeconds * 1_000,
                );
              },
              onError: (event) => onError(event.data),
            },
          });
        });
      }

      if (cancelled) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      playerRef.current.loadVideoById({
        videoId: track.providerContentId,
        startSeconds: track.startTimeSeconds,
      });
      wrapperRef.current
        ?.querySelector("iframe")
        ?.setAttribute(
          "title",
          `Player do YouTube — ${track.title}, ${track.artist}`,
        );
    }

    void playRequestedTrack();
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [onError, onLoadError, onStarted, requestToken, track]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      playerRef.current?.destroy();
      playerRef.current = null;
    },
    [],
  );

  return (
    <div
      ref={wrapperRef}
      aria-label="Player do YouTube"
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-black"
    >
      <div ref={playerHostRef} className="aspect-video min-h-[200px] w-full" />
      {!track ? (
        <p className="absolute inset-0 grid place-items-center px-5 text-center text-sm text-white/45">
          Inicie uma das músicas para carregar o player.
        </p>
      ) : null}
    </div>
  );
}
