"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

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

export type YouTubePlayerHandle = {
  pause(): void;
};

type YouTubePlayerProps = {
  label: "A" | "B";
  song: GameSong;
  onError(errorCode: number): void;
  onLoadError(): void;
  onPlayingChange(playing: boolean): void;
};

export const YouTubePlayer = forwardRef<
  YouTubePlayerHandle,
  YouTubePlayerProps
>(function YouTubePlayer(
  { label, song, onError, onLoadError, onPlayingChange },
  ref,
) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const playerHostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const guardIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restartGraceUntilRef = useRef(0);
  const resetOnNextPlayRef = useRef(false);
  const readyRef = useRef(false);
  const callbacksRef = useRef({
    onError,
    onLoadError,
    onPlayingChange,
  });

  useEffect(() => {
    callbacksRef.current = {
      onError,
      onLoadError,
      onPlayingChange,
    };
  }, [onError, onLoadError, onPlayingChange]);

  const clearPreviewGuard = useCallback(() => {
    if (guardIntervalRef.current) clearInterval(guardIntervalRef.current);
    guardIntervalRef.current = null;
  }, []);

  const markPaused = useCallback(() => {
    clearPreviewGuard();
    callbacksRef.current.onPlayingChange(false);
  }, [clearPreviewGuard]);

  useImperativeHandle(
    ref,
    () => ({
      pause() {
        const player = playerRef.current;
        if (!player || !readyRef.current) return;
        player.pauseVideo();
        markPaused();
      },
    }),
    [markPaused],
  );

  useEffect(() => {
    let cancelled = false;

    async function createPlayer() {
      if (!playerHostRef.current) return;
      let youtube: YouTubeNamespace;
      try {
        youtube = await loadYouTubeApi();
      } catch {
        callbacksRef.current.onLoadError();
        return;
      }
      if (cancelled || !playerHostRef.current) return;

      const player = new youtube.Player(playerHostRef.current, {
        height: "100%",
        width: "100%",
        playerVars: { controls: 1, playsinline: 1, rel: 0 },
        events: {
          onReady: (event) => {
            if (cancelled) return;
            playerRef.current = event.target;
            event.target.cueVideoById({
              videoId: song.providerContentId,
              startSeconds: song.startTimeSeconds,
              endSeconds: song.startTimeSeconds + song.previewDurationSeconds,
            });
            wrapperRef.current
              ?.querySelector("iframe")
              ?.setAttribute(
                "title",
                `Player do YouTube — ${song.title}, ${song.artist}`,
              );
            readyRef.current = true;
          },
          onStateChange: (event) => {
            if (event.data === youtube.PlayerState.PLAYING) {
              clearPreviewGuard();
              if (resetOnNextPlayRef.current) {
                resetOnNextPlayRef.current = false;
                restartGraceUntilRef.current = Date.now() + 1_500;
                event.target.seekTo(song.startTimeSeconds, true);
              }
              callbacksRef.current.onPlayingChange(true);
              const previewEnd =
                song.startTimeSeconds + song.previewDurationSeconds;
              guardIntervalRef.current = setInterval(() => {
                const currentTime = event.target.getCurrentTime();
                const isRestarting = restartGraceUntilRef.current > Date.now();

                if (
                  isRestarting &&
                  Math.abs(currentTime - song.startTimeSeconds) > 1
                ) {
                  event.target.seekTo(song.startTimeSeconds, true);
                  return;
                }

                restartGraceUntilRef.current = 0;
                if (currentTime < song.startTimeSeconds - 0.5) {
                  event.target.seekTo(song.startTimeSeconds, true);
                  return;
                }

                if (currentTime >= previewEnd) {
                  resetOnNextPlayRef.current = true;
                  event.target.pauseVideo();
                  markPaused();
                }
              }, 250);
              return;
            }

            if (event.data === youtube.PlayerState.ENDED) {
              resetOnNextPlayRef.current = true;
              markPaused();
              return;
            }

            if (event.data === youtube.PlayerState.PAUSED) markPaused();
          },
          onError: (event) => {
            markPaused();
            callbacksRef.current.onError(event.data);
          },
        },
      });
      playerRef.current = player;
    }

    void createPlayer();
    return () => {
      cancelled = true;
      clearPreviewGuard();
      restartGraceUntilRef.current = 0;
      readyRef.current = false;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [
    clearPreviewGuard,
    markPaused,
    song.artist,
    song.previewDurationSeconds,
    song.providerContentId,
    song.songId,
    song.startTimeSeconds,
    song.title,
  ]);

  return (
    <div
      ref={wrapperRef}
      aria-label={`Player da música ${label}`}
      className="game-youtube-player relative min-h-[200px] overflow-hidden rounded-2xl border border-white/10 bg-black"
    >
      <div
        ref={playerHostRef}
        className="game-player-host aspect-video min-h-[200px] w-full"
      />
    </div>
  );
});
