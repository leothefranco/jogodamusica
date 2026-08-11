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

function completedTiebreakState(winnerSongId: "song-a" | "song-b") {
  return {
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
        winnerSongId,
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
  };
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
});

test("mostra dois players com controles nativos e votos fora da mídia", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto("/e2e-test/dois-players");

  const playerA = page.getByLabel("Player da música A");
  const playerB = page.getByLabel("Player da música B");
  await expect(playerA).toBeVisible();
  await expect(playerB).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Reproduzir música/ }),
  ).toHaveCount(0);
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
      expect.objectContaining({ controls: 1, playsinline: 1 }),
      expect.objectContaining({ controls: 1, playsinline: 1 }),
    ]);
  await expect
    .poll(() => page.evaluate(() => window.__youtubeTest.calls))
    .toEqual(
      expect.arrayContaining([
        { player: 0, method: "cue-end", value: 40 },
        { player: 1, method: "cue-end", value: 50 },
      ]),
    );

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
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight > window.innerHeight,
    ),
  ).toBe(true);

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

test("aproveita a largura do desktop com os players lado a lado", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/e2e-test/dois-players");

  const [boxA, boxB] = await Promise.all([
    page.getByLabel("Player da música A").boundingBox(),
    page.getByLabel("Player da música B").boundingBox(),
  ]);

  expect(boxA).not.toBeNull();
  expect(boxB).not.toBeNull();
  expect(boxA!.width).toBeGreaterThan(400);
  expect(boxB!.width).toBeGreaterThan(400);
  expect(Math.abs(boxA!.y - boxB!.y)).toBeLessThan(2);
  expect(boxA!.x + boxA!.width).toBeLessThanOrEqual(boxB!.x);
});

test("informa a conclusão enquanto abre o resultado final", async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    extraHTTPHeaders: { "x-e2e-test": "two-players" },
  });
  const page = await context.newPage();

  await page.goto("/e2e-test/dois-players?completed=1");

  await expect(
    page.getByText("Partida concluída. Abrindo o resultado..."),
  ).toHaveCount(1);
  await expect(page.getByText("Preparando o próximo confronto...")).toHaveCount(
    0,
  );

  await context.close();
});

test("pausa o outro player quando a reprodução começa pelos controles nativos", async ({
  page,
}) => {
  await page.goto("/e2e-test/dois-players");
  await expect
    .poll(() => page.evaluate(() => window.__youtubeTest.playerVars.length))
    .toBe(2);
  await page.evaluate(() => window.__youtubeTest.emitState(0, 1));
  await page.evaluate(() => window.__youtubeTest.emitState(1, 1));

  await expect
    .poll(() => page.evaluate(() => window.__youtubeTest.calls))
    .toEqual(
      expect.arrayContaining([
        { player: 0, method: "pause" },
        { player: 1, method: "pause" },
      ]),
    );
});

test("reinicia no começo do trecho depois que a prévia termina", async ({
  page,
}) => {
  await page.goto("/e2e-test/dois-players");
  await expect
    .poll(() => page.evaluate(() => window.__youtubeTest.playerVars.length))
    .toBe(2);
  await page.evaluate(() => {
    window.__youtubeTest.setCurrentTime(0, 40);
    window.__youtubeTest.emitState(0, 1);
  });
  await expect
    .poll(() => page.evaluate(() => window.__youtubeTest.calls))
    .toEqual(expect.arrayContaining([{ player: 0, method: "pause" }]));
  await page.evaluate(() => window.__youtubeTest.emitState(0, 1));

  await expect
    .poll(() => page.evaluate(() => window.__youtubeTest.calls))
    .toEqual(
      expect.arrayContaining([{ player: 0, method: "seek", value: 10 }]),
    );
});

test("mantém a reprodução dentro do trecho configurado", async ({ page }) => {
  await page.goto("/e2e-test/dois-players");
  await expect
    .poll(() => page.evaluate(() => window.__youtubeTest.playerVars.length))
    .toBe(2);

  await page.evaluate(() => {
    window.__youtubeTest.emitState(0, 1);
    window.__youtubeTest.setCurrentTime(0, 2);
  });
  await expect
    .poll(() => page.evaluate(() => window.__youtubeTest.calls))
    .toEqual(
      expect.arrayContaining([{ player: 0, method: "seek", value: 10 }]),
    );

  await page.evaluate(() => window.__youtubeTest.setCurrentTime(0, 45));
  await expect
    .poll(() => page.evaluate(() => window.__youtubeTest.calls))
    .toEqual(expect.arrayContaining([{ player: 0, method: "pause" }]));
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
  await expect
    .poll(() => page.evaluate(() => window.__youtubeTest.playerVars.length))
    .toBe(2);
  await page.evaluate(() => window.__youtubeTest.emitState(0, 1));
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

test("confirma um voto normal e avança o estado do confronto", async ({
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
        songs: [
          {
            sessionId: "00000000-0000-4000-8000-000000000001",
            songId: "song-a",
            seed: 1,
            title: "Canção A",
            artist: "Artista A",
            thumbnailUrl: "/icon.svg",
            provider: "youtube",
            providerContentId: "youtube-a",
            startTimeSeconds: 10,
            previewDurationSeconds: 30,
          },
          {
            sessionId: "00000000-0000-4000-8000-000000000001",
            songId: "song-b",
            seed: 2,
            title: "Canção B",
            artist: "Artista B",
            thumbnailUrl: "/icon.svg",
            provider: "youtube",
            providerContentId: "youtube-b",
            startTimeSeconds: 20,
            previewDurationSeconds: 30,
          },
        ],
        matches: [
          {
            id: "match-1",
            sessionId: "00000000-0000-4000-8000-000000000001",
            roundNumber: 1,
            position: 1,
            songAId: "song-a",
            songBId: "song-b",
            winnerSongId: "song-a",
            status: "completed",
            completedAt: "2026-01-01T00:01:00.000Z",
          },
          {
            id: "match-2",
            sessionId: "00000000-0000-4000-8000-000000000001",
            roundNumber: 1,
            position: 2,
            songAId: "song-a",
            songBId: "song-b",
            winnerSongId: null,
            status: "ready",
            completedAt: null,
          },
        ],
        currentMatch: {
          id: "match-2",
          sessionId: "00000000-0000-4000-8000-000000000001",
          roundNumber: 1,
          position: 2,
          songAId: "song-a",
          songBId: "song-b",
          winnerSongId: null,
          status: "ready",
          completedAt: null,
        },
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

  await page.getByRole("button", { name: "Votar na música A" }).click();
  await page
    .getByRole("dialog", { name: "Confirmar voto" })
    .getByRole("button", { name: "Confirmar voto" })
    .click();

  expect((await decisionRequest).postDataJSON()).toEqual({
    type: "vote",
    winnerSongId: "song-a",
  });
  await expect(
    page.getByText("confronto 2 de 2", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("progressbar", { name: "Progresso do chaveamento" }),
  ).toHaveAttribute("aria-valuenow", "1");
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
      body: JSON.stringify(completedTiebreakState("song-b")),
    }),
  );
  await page.goto("/e2e-test/dois-players");

  await page.getByRole("button", { name: "Desempatar" }).click();
  const confirmation = page.getByRole("dialog", {
    name: "Confirmar desempate",
  });
  await expect(confirmation).toBeVisible();
  const spinStartedAt = Date.now();
  await confirmation.getByRole("button", { name: "Sortear vencedora" }).click();

  expect((await decisionRequest).postDataJSON()).toEqual({ type: "tiebreak" });
  const reveal = page.getByRole("status", { name: "Roleta de desempate" });
  await expect(reveal).toBeVisible();
  await expect(reveal).toContainText("Roleta em movimento");
  await expect(
    reveal.getByRole("img", { name: "Capa de Canção A, de Artista A" }),
  ).toBeVisible();
  await expect(
    reveal.getByRole("img", { name: "Capa de Canção B, de Artista B" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Desempatar" })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Votar na música A" }),
  ).toBeDisabled();
  await expect(reveal).toContainText("Desempate concluído");
  await expect(reveal).toContainText("Canção B");
  await expect(reveal).toContainText("Vencedora");
  await page.waitForTimeout(1_000);
  await expect(reveal).toBeVisible();
  await expect(reveal).toContainText("Vencedora");
  expect(Date.now() - spinStartedAt).toBeGreaterThanOrEqual(2_300);
});

test("prefers-reduced-motion revela imediatamente sem girar a roleta", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/decision", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(completedTiebreakState("song-a")),
    }),
  );
  await page.goto("/e2e-test/dois-players");

  await page.getByRole("button", { name: "Desempatar" }).click();
  await page
    .getByRole("dialog", { name: "Confirmar desempate" })
    .getByRole("button", { name: "Sortear vencedora" })
    .click();

  const reveal = page.getByRole("status", { name: "Roleta de desempate" });
  await expect(reveal).toContainText("Desempate concluído");
  await expect(reveal).toContainText("Canção A");
  await expect(reveal).not.toContainText("Roleta em movimento");
});
