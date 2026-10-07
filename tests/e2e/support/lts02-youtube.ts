import type { Page } from "playwright/test";

type PlayerCall = { player: number; method: string; value?: number | string };

// A local external-SDK fixture, independent of other specs at runtime.
export async function installLts02YouTube(page: Page) {
  await page.addInitScript(() => {
    const calls: PlayerCall[] = [];
    const playerVars: Array<Record<string, number>> = [];
    const players: FakePlayer[] = [];

    class FakePlayer {
      readonly index: number;
      private currentTime = 0;

      constructor(
        element: HTMLElement,
        private readonly options: {
          playerVars: Record<string, number>;
          events: {
            onReady(event: { target: FakePlayer }): void;
            onStateChange(event: { target: FakePlayer; data: number }): void;
            onError(event: { target: FakePlayer; data: number }): void;
          };
        },
      ) {
        this.index = players.length;
        players.push(this);
        playerVars.push(options.playerVars);
        element.append(document.createElement("iframe"));
        queueMicrotask(() => options.events.onReady({ target: this }));
      }

      cueVideoById(options: {
        videoId: string;
        startSeconds: number;
        endSeconds: number;
      }) {
        this.currentTime = options.startSeconds;
        calls.push({
          player: this.index,
          method: "cue",
          value: options.videoId,
        });
        calls.push({
          player: this.index,
          method: "cue-end",
          value: options.endSeconds,
        });
      }

      getCurrentTime() {
        return this.currentTime;
      }

      pauseVideo() {
        calls.push({ player: this.index, method: "pause" });
        this.options.events.onStateChange({ target: this, data: 2 });
      }

      playVideo() {
        calls.push({ player: this.index, method: "play" });
        this.options.events.onStateChange({ target: this, data: 1 });
      }

      seekTo(seconds: number) {
        calls.push({ player: this.index, method: "seek", value: seconds });
        queueMicrotask(() => {
          this.currentTime = seconds;
        });
      }

      destroy() {
        calls.push({ player: this.index, method: "destroy" });
      }

      setCurrentTime(seconds: number) {
        this.currentTime = seconds;
      }

      emitState(state: number) {
        this.options.events.onStateChange({ target: this, data: state });
      }

      emitError(errorCode: number) {
        this.options.events.onError({ target: this, data: errorCode });
      }
    }

    Object.defineProperty(window, "YT", {
      configurable: true,
      value: {
        Player: FakePlayer,
        PlayerState: { PLAYING: 1, PAUSED: 2, ENDED: 0 },
      },
    });
    window.__youtubeTest = {
      calls,
      playerVars,
      emitError(player, errorCode) {
        players[player]?.emitError(errorCode);
      },
      emitState(player, state) {
        players[player]?.emitState(state);
      },
      setCurrentTime(player, seconds) {
        players[player]?.setCurrentTime(seconds);
      },
    };
  });
}
