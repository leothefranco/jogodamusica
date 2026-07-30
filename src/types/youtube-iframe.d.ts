type YouTubePlayerEvent = {
  target: YouTubePlayer;
};

type YouTubePlayerErrorEvent = YouTubePlayerEvent & {
  data: number;
};

interface YouTubePlayer {
  destroy(): void;
  getCurrentTime(): number;
  loadVideoById(options: { videoId: string; startSeconds: number }): void;
  pauseVideo(): void;
}

interface YouTubeNamespace {
  Player: new (
    element: HTMLElement,
    options: {
      height: string;
      width: string;
      playerVars: {
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
    PLAYING: number;
  };
}

interface Window {
  YT?: YouTubeNamespace;
  onYouTubeIframeAPIReady?: () => void;
}
