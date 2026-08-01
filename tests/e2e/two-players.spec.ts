import { expect, test } from "playwright/test";

type PlayerCall = {
  player: number;
  method: string;
  value?: number | string;
};

type YouTubeTestControl = {
  calls: PlayerCall[];
  playerVars: Array<Record<string, number>>;
  emitError(player: number, errorCode: number): void;
  emitState(player: number, state: number): void;
  setCurrentTime(player: number, seconds: number): void;
};

declare global {
  interface Window {
    __youtubeTest: YouTubeTestControl;
  }
}

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-e2e-test": "two-players" });
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

      cueVideoById(options: { videoId: string; startSeconds: number }) {
        this.currentTime = options.startSeconds;
        calls.push({
          player: this.index,
          method: "cue",
          value: options.videoId,
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
        this.currentTime = seconds;
        calls.push({ player: this.index, method: "seek", value: seconds });
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
});

test("mostra dois players associados às músicas sem controles nativos", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto("/e2e-test/dois-players");

  const playerA = page.getByLabel("Player da música A");
  const playerB = page.getByLabel("Player da música B");
  await expect(playerA).toBeVisible();
  await expect(playerB).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reproduzir música A" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Reproduzir música B" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Votar na música A" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Votar na música B" }),
  ).toBeEnabled();
  await expect(page.getByRole("button", { name: "Desempatar" })).toBeEnabled();
  await expect
    .poll(() => page.evaluate(() => window.__youtubeTest.playerVars))
    .toEqual([
      expect.objectContaining({ controls: 0, playsinline: 1 }),
      expect.objectContaining({ controls: 0, playsinline: 1 }),
    ]);

  const [boxA, boxB] = await Promise.all([
    playerA.boundingBox(),
    playerB.boundingBox(),
  ]);
  expect(boxA).not.toBeNull();
  expect(boxB).not.toBeNull();
  expect(boxA!.width).toBeGreaterThanOrEqual(200);
  expect(boxA!.height).toBeGreaterThanOrEqual(200);
  expect(boxB!.width).toBeGreaterThanOrEqual(200);
  expect(boxB!.height).toBeGreaterThanOrEqual(200);
  expect(boxA!.y + boxA!.height).toBeLessThanOrEqual(boxB!.y);
  await expect
    .poll(() =>
      page.evaluate(() => ({
        viewportHeight: window.innerHeight,
        contentHeight: document.documentElement.scrollHeight,
      })),
    )
    .toEqual({ viewportHeight: 700, contentHeight: 700 });

  await page.setViewportSize({ width: 390, height: 560 });
  await expect
    .poll(() =>
      page.evaluate(() => ({
        viewportHeight: window.innerHeight,
        contentHeight: document.documentElement.scrollHeight,
      })),
    )
    .toMatchObject({ viewportHeight: 560 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight > window.innerHeight,
    ),
  ).toBe(true);
  await page.keyboard.press("End");
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(0);
  await expect(
    page.getByRole("button", {
      name: "Abandonar partida e voltar ao tema",
    }),
  ).toBeInViewport();
});

test("alterna a reprodução e retoma cada música da própria posição", async ({
  page,
}) => {
  await page.goto("/e2e-test/dois-players");
  const playA = page.getByRole("button", { name: "Reproduzir música A" });
  const playB = page.getByRole("button", { name: "Reproduzir música B" });

  await playA.click();
  await page.evaluate(() => window.__youtubeTest.setCurrentTime(0, 17));
  await playB.click();
  await page.evaluate(() => window.__youtubeTest.setCurrentTime(1, 29));
  await page.getByRole("button", { name: "Reproduzir música A" }).click();

  await expect
    .poll(() => page.evaluate(() => window.__youtubeTest.calls))
    .toEqual(
      expect.arrayContaining([
        { player: 0, method: "pause" },
        { player: 1, method: "play" },
        { player: 1, method: "pause" },
        { player: 0, method: "seek", value: 17 },
        { player: 0, method: "play" },
      ]),
    );
  await expect(
    page.getByRole("button", { name: "Pausar música A" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reproduzir música B" }),
  ).toBeVisible();
});

test("reinicia no começo do trecho depois que a prévia termina", async ({
  page,
}) => {
  await page.goto("/e2e-test/dois-players");
  await page.getByRole("button", { name: "Reproduzir música A" }).click();
  await page.evaluate(() => {
    window.__youtubeTest.setCurrentTime(0, 40);
    window.__youtubeTest.emitState(0, 1);
  });
  await expect(
    page.getByRole("button", { name: "Reproduzir música A" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Reproduzir música A" }).click();

  await expect
    .poll(() => page.evaluate(() => window.__youtubeTest.calls))
    .toEqual(
      expect.arrayContaining([
        { player: 0, method: "pause" },
        { player: 0, method: "seek", value: 10 },
      ]),
    );
});

test("mantém o voto disponível quando um dos players falha", async ({
  page,
}) => {
  await page.route("**/player-errors", (route) =>
    route.fulfill({ status: 204 }),
  );
  await page.goto("/e2e-test/dois-players");
  await expect
    .poll(() => page.evaluate(() => window.__youtubeTest.playerVars.length))
    .toBe(2);

  await page.evaluate(() => window.__youtubeTest.emitError(0, 101));

  await expect(
    page.getByRole("button", { name: "Votar na música A" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("article").first().getByRole("alert"),
  ).toContainText("Tente novamente");
});

test("pausa os players e cancela o modal acessível sem retomar o áudio", async ({
  page,
}) => {
  let browserDialogOpened = false;
  page.on("dialog", async (dialog) => {
    browserDialogOpened = true;
    await dialog.dismiss();
  });
  await page.goto("/e2e-test/dois-players");
  await page.getByRole("button", { name: "Reproduzir música A" }).click();
  await page.evaluate(() => window.__youtubeTest.setCurrentTime(0, 17));

  const voteA = page.getByRole("button", { name: "Votar na música A" });
  await voteA.click();

  const confirmation = page.getByRole("dialog", { name: "Confirmar voto" });
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toContainText("Canção A");
  await expect(confirmation).toContainText("Artista A");
  await expect(
    confirmation.getByRole("button", { name: "Cancelar" }),
  ).toBeFocused();
  await expect
    .poll(() => page.evaluate(() => window.__youtubeTest.calls))
    .toEqual(
      expect.arrayContaining([
        { player: 0, method: "pause" },
        { player: 1, method: "pause" },
      ]),
    );

  await page.keyboard.press("Tab");
  await expect(
    confirmation.getByRole("button", { name: "Confirmar voto" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    confirmation.getByRole("button", { name: "Cancelar" }),
  ).toBeFocused();
  await confirmation.getByRole("button", { name: "Cancelar" }).click();

  await expect(confirmation).toBeHidden();
  await expect(voteA).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Reproduzir música A" }),
  ).toBeVisible();
  const callsAfterCancel = await page.evaluate(
    () => window.__youtubeTest.calls.length,
  );
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.__youtubeTest.calls.length)).toBe(
    callsAfterCancel,
  );

  await voteA.click();
  await expect(confirmation).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(confirmation).toBeHidden();
  await expect(voteA).toBeFocused();

  await page.getByRole("button", { name: "Reproduzir música A" }).click();
  await expect
    .poll(() => page.evaluate(() => window.__youtubeTest.calls))
    .toEqual(
      expect.arrayContaining([
        { player: 0, method: "seek", value: 17 },
        { player: 0, method: "play" },
      ]),
    );
  expect(browserDialogOpened).toBe(false);
});

test("bloqueia confirmações repetidas enquanto a decisão está em andamento", async ({
  page,
}) => {
  let requestCount = 0;
  let releaseDecision!: () => void;
  const decisionPending = new Promise<void>((resolve) => {
    releaseDecision = resolve;
  });

  await page.route("**/decision", async (route) => {
    requestCount += 1;
    await decisionPending;
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({
        error: { message: "Decisão de teste não registrada." },
      }),
    });
  });
  await page.goto("/e2e-test/dois-players");

  await page.getByRole("button", { name: "Votar na música A" }).click();
  const confirmation = page.getByRole("dialog", { name: "Confirmar voto" });
  const confirmVote = confirmation.getByRole("button", {
    name: "Confirmar voto",
  });
  await confirmVote.click();

  await expect(confirmVote).toBeDisabled();
  await expect(
    confirmation.getByRole("button", { name: "Cancelar" }),
  ).toBeDisabled();
  await expect.poll(() => requestCount).toBe(1);

  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(100);
  expect(requestCount).toBe(1);

  releaseDecision();
  await expect(confirmVote).toBeEnabled();
  expect(requestCount).toBe(1);
});

test("confirma o desempate na aplicação e revela a vencedora sorteada pelo servidor", async ({
  page,
}) => {
  const decisionRequest = page.waitForRequest(
    (request) =>
      request.url().endsWith("/decision") && request.method() === "POST",
  );
  await page.route("**/decision", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        theme: { name: "Clássicos do teste", slug: "classicos-do-teste" },
        session: {
          id: "00000000-0000-4000-8000-000000000001",
          themeId: "00000000-0000-4000-8000-000000000002",
          bracketSize: 4,
          status: "active",
          currentRound: 1,
          championSongId: null,
          startedAt: "2026-01-01T00:00:00.000Z",
          completedAt: null,
        },
        songs: [],
        matches: [
          {
            id: "match-1",
            sessionId: "00000000-0000-4000-8000-000000000001",
            roundNumber: 1,
            position: 1,
            songAId: "song-a",
            songBId: "song-b",
            winnerSongId: "song-b",
            status: "completed",
            completedAt: "2026-01-01T00:01:00.000Z",
          },
        ],
        currentMatch: null,
        progress: {
          completedMatches: 1,
          totalMatches: 3,
          currentRound: 1,
          roundCount: 2,
        },
      }),
    }),
  );
  await page.goto("/e2e-test/dois-players");

  await page.getByRole("button", { name: "Desempatar" }).click();
  const confirmation = page.getByRole("dialog", {
    name: "Confirmar desempate",
  });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "Sortear vencedora" }).click();

  expect((await decisionRequest).postDataJSON()).toEqual({ type: "tiebreak" });
  const reveal = page.getByRole("status", { name: "Roleta de desempate" });
  await expect(reveal).toBeVisible();
  await expect(reveal).toContainText("Canção B");
});
