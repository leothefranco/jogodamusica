type YouTubePlayerEvent = {
  target: YouTubePlayer;
};

type YouTubePlayerErrorEvent = YouTubePlayerEvent & {
  data: number;
};

interface YouTubePlayer {
  cueVideoById(options: { videoId: string; startSeconds: number }): void;
  destroy(): void;
  getCurrentTime(): number;
  pauseVideo(): void;
  playVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
}

interface YouTubeNamespace {
  Player: new (
    element: HTMLElement,
    options: {
      height: string;
      width: string;
      playerVars: {
        controls: 0;
        playsinline: 1;
        rel: 0;
      };
      events: {
        onReady(event: YouTubePlayerEvent): void;
        onStateChange(event: YouTubePlayerEvent & { data: number }): void;
        onError(event: YouTubePlayerErrorEvent): void;
      };
    },
  ) => YouTubePlayer;
  PlayerState: {
    ENDED: number;
    PAUSED: number;
    PLAYING: number;
  };
}

interface Window {
  YT?: YouTubeNamespace;
  onYouTubeIframeAPIReady?: () => void;
}
