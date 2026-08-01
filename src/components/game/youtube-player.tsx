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
  play(): void;
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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumeAtRef = useRef(song.startTimeSeconds);
  const resetOnNextPlayRef = useRef(false);
  const readyRef = useRef(false);
  const pendingPlayRef = useRef(false);
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

  const clearPreviewTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const markPaused = useCallback(() => {
    clearPreviewTimer();
    callbacksRef.current.onPlayingChange(false);
  }, [clearPreviewTimer]);

  useImperativeHandle(
    ref,
    () => ({
      pause() {
        pendingPlayRef.current = false;
        const player = playerRef.current;
        if (!player || !readyRef.current) return;
        if (!resetOnNextPlayRef.current) {
          resumeAtRef.current = player.getCurrentTime();
        }
        player.pauseVideo();
        markPaused();
      },
      play() {
        pendingPlayRef.current = true;
        const player = playerRef.current;
        if (!player || !readyRef.current) return;
        pendingPlayRef.current = false;
        const position = resetOnNextPlayRef.current
          ? song.startTimeSeconds
          : resumeAtRef.current;
        resetOnNextPlayRef.current = false;
        resumeAtRef.current = position;
        player.seekTo(position, true);
        player.playVideo();
      },
    }),
    [markPaused, song.startTimeSeconds],
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
        playerVars: { controls: 0, playsinline: 1, rel: 0 },
        events: {
          onReady: (event) => {
            if (cancelled) return;
            playerRef.current = event.target;
            event.target.cueVideoById({
              videoId: song.providerContentId,
              startSeconds: song.startTimeSeconds,
            });
            wrapperRef.current
              ?.querySelector("iframe")
              ?.setAttribute(
                "title",
                `Player do YouTube — ${song.title}, ${song.artist}`,
              );
            readyRef.current = true;
            if (pendingPlayRef.current) {
              pendingPlayRef.current = false;
              event.target.seekTo(resumeAtRef.current, true);
              event.target.playVideo();
            }
          },
          onStateChange: (event) => {
            if (event.data === youtube.PlayerState.PLAYING) {
              clearPreviewTimer();
              callbacksRef.current.onPlayingChange(true);
              const previewEnd =
                song.startTimeSeconds + song.previewDurationSeconds;
              const remainingSeconds = Math.max(
                previewEnd - event.target.getCurrentTime(),
                0,
              );
              timerRef.current = setTimeout(() => {
                resetOnNextPlayRef.current = true;
                resumeAtRef.current = song.startTimeSeconds;
                event.target.pauseVideo();
                markPaused();
              }, remainingSeconds * 1_000);
              return;
            }

            if (event.data === youtube.PlayerState.ENDED) {
              resetOnNextPlayRef.current = true;
              resumeAtRef.current = song.startTimeSeconds;
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
      clearPreviewTimer();
      readyRef.current = false;
      pendingPlayRef.current = false;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [
    clearPreviewTimer,
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
      className="relative min-h-[200px] overflow-hidden rounded-2xl border border-white/10 bg-black"
    >
      <div ref={playerHostRef} className="aspect-video min-h-[200px] w-full" />
    </div>
  );
});
