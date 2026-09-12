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
  await expect(
    page.getByRole("button", { name: "Sortear vencedora do confronto" }),
  ).toBeEnabled();
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
  await page
    .getByRole("button", { name: "Sortear vencedora do confronto" })
    .focus();
  await page.keyboard.press("PageDown");
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
  await expect
    .poll(() => page.evaluate(() => window.__youtubeTest.playerVars.length))
    .toBe(2);

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

test("exige confirmação acessível antes de abandonar a partida", async ({
  page,
}) => {
  let abandonRequests = 0;
  await page.route("**/api/games/*", async (route) => {
    if (route.request().method() === "PATCH") {
      abandonRequests += 1;
      await route.fulfill({ status: 204 });
      return;
    }
    await route.continue();
  });
  await page.goto("/e2e-test/dois-players");

  const trigger = page.getByRole("button", {
    name: "Abandonar partida e voltar ao tema",
  });
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "Abandonar partida?" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("não poderá ser retomada");
  await expect(
    dialog.getByRole("button", { name: "Continuar jogando" }),
  ).toBeFocused();
  expect(abandonRequests).toBe(0);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  expect(abandonRequests).toBe(0);

  await trigger.click();
  await dialog.getByRole("button", { name: "Abandonar partida" }).click();
  await expect.poll(() => abandonRequests).toBe(1);
});

test("mostra a falha de abandono dentro do diálogo", async ({ page }) => {
  await page.route("**/api/games/*", (route) => route.fulfill({ status: 500 }));
  await page.goto("/e2e-test/dois-players");
  await page
    .getByRole("button", { name: "Abandonar partida e voltar ao tema" })
    .click();

  const dialog = page.getByRole("dialog", { name: "Abandonar partida?" });
  await dialog.getByRole("button", { name: "Abandonar partida" }).click();

  await expect(dialog.getByRole("alert")).toContainText(
    "Não foi possível abandonar a partida",
  );
  await expect(
    dialog.getByRole("button", { name: "Abandonar partida" }),
  ).toBeEnabled();
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

  await page
    .getByRole("button", { name: "Sortear vencedora do confronto" })
    .click();
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
  await expect(
    page.getByRole("button", { name: "Sortear vencedora do confronto" }),
  ).toBeDisabled();
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

  await page
    .getByRole("button", { name: "Sortear vencedora do confronto" })
    .click();
  await page
    .getByRole("dialog", { name: "Confirmar desempate" })
    .getByRole("button", { name: "Sortear vencedora" })
    .click();

  const reveal = page.getByRole("status", { name: "Roleta de desempate" });
  await expect(reveal).toContainText("Desempate concluído");
  await expect(reveal).toContainText("Canção A");
  await expect(reveal).not.toContainText("Roleta em movimento");
});

test("confronto móvel permite rolagem e explica o sorteio com lados distintos", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/e2e-test/dois-players");
  await expect
    .poll(() => page.evaluate(() => window.__youtubeTest.playerVars.length))
    .toBe(2);
  await expect(
    page.getByRole("heading", { name: "Qual é a melhor?" }),
  ).toHaveCount(0);
  const draw = page.getByRole("button", {
    name: "Sortear vencedora do confronto",
  });
  await expect(draw).toBeVisible();
  await expect(draw).toContainText("Sortear vencedora");
  await expect(draw).toContainText("Escolha aleatória");
  const layout = await page.evaluate(() => {
    const cards = [...document.querySelectorAll(".game-song-card")];
    return {
      width: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
      colors: cards.map((card) => getComputedStyle(card).backgroundColor),
    };
  });
  expect(layout.width).toBeLessThanOrEqual(layout.viewport);
  expect(layout.colors[0]).not.toBe(layout.colors[1]);
  const contenders = page.locator(".game-song-card");
  const metrics = await contenders.evaluateAll((cards) =>
    cards.map((card) => {
      const vote = card.querySelector(".game-vote")!;
      const player = card.querySelector(".game-player-host")!;
      const bounds = card.getBoundingClientRect();
      const buttonBounds = vote.getBoundingClientRect();
      const playerBounds = player.getBoundingClientRect();
      return {
        width: bounds.width,
        height: bounds.height,
        buttonWidth: buttonBounds.width,
        buttonHeight: buttonBounds.height,
        playerWidth: playerBounds.width,
        playerHeight: playerBounds.height,
        voteColor: getComputedStyle(vote).backgroundColor,
        textColor: getComputedStyle(vote).color,
        hasCheck: vote.querySelector(".lucide-check") !== null,
      };
    }),
  );
  for (const side of metrics) {
    expect(side.buttonHeight).toBeGreaterThanOrEqual(48);
    expect(side.playerWidth).toBeGreaterThanOrEqual(200);
    expect(side.playerHeight).toBeGreaterThanOrEqual(200);
    expect(side.hasCheck).toBe(false);
  }
  for (const dimension of [
    "width",
    "height",
    "buttonWidth",
    "buttonHeight",
    "playerWidth",
    "playerHeight",
  ] as const) {
    expect(metrics[0][dimension]).toBeCloseTo(metrics[1][dimension], 0);
  }
  expect(metrics[0].voteColor).not.toBe(metrics[1].voteColor);
  expect(metrics[0].textColor).toBe(metrics[1].textColor);
  await expect(page.locator(".game-versus")).toHaveText("VS");
  await draw.click();
  await expect(
    page.getByRole("dialog", { name: "Confirmar desempate" }),
  ).toBeVisible();
});

test("VS circular separa os adversários sem obstruir a mídia ou os votos", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/e2e-test/dois-players");
  const contenders = page.getByRole("article");
  const versus = page.getByText("VS", { exact: true });
  const [first, second, badge] = await Promise.all([
    contenders.nth(0).boundingBox(),
    contenders.nth(1).boundingBox(),
    versus.boundingBox(),
  ]);
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  expect(badge).not.toBeNull();
  expect(badge!.width).toBeGreaterThanOrEqual(48);
  expect(badge!.width).toBeLessThanOrEqual(56);
  expect(badge!.height).toBeCloseTo(badge!.width, 0);
  expect(badge!.y).toBeGreaterThanOrEqual(first!.y + first!.height + 12);
  expect(badge!.y + badge!.height + 12).toBeLessThanOrEqual(second!.y);
  expect(badge!.x + badge!.width / 2).toBeCloseTo(195, 0);
  const radius = await versus.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).borderTopLeftRadius),
  );
  expect(radius).toBeGreaterThanOrEqual(24);
});

test("cards e ações arredondados preservam respiro e alvos de toque equivalentes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/e2e-test/dois-players");
  const cards = page.getByRole("article");
  for (const label of ["A", "B"]) {
    const card = cards.filter({
      has: page.getByRole("button", { name: `Votar na música ${label}` }),
    });
    const radius = await card.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).borderTopLeftRadius),
    );
    expect(radius).toBeGreaterThanOrEqual(18);
    expect(radius).toBeLessThanOrEqual(20);
    const vote = page.getByRole("button", { name: `Votar na música ${label}` });
    const player = page.getByLabel(`Player da música ${label}`);
    const [voteBox, playerBox] = await Promise.all([
      vote.boundingBox(),
      player.boundingBox(),
    ]);
    expect(voteBox!.height).toBeGreaterThanOrEqual(48);
    expect(
      voteBox!.y - playerBox!.y - playerBox!.height,
    ).toBeGreaterThanOrEqual(12);
    expect(playerBox!.width).toBeGreaterThanOrEqual(200);
    expect(playerBox!.height).toBeGreaterThanOrEqual(200);
  }
  for (const button of [
    page.getByRole("button", { name: "Votar na música A" }),
    page.getByRole("button", { name: "Votar na música B" }),
    page.getByRole("button", { name: "Sortear vencedora do confronto" }),
  ]) {
    const radius = await button.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).borderTopLeftRadius),
    );
    expect(radius).toBeGreaterThanOrEqual(12);
    expect(radius).toBeLessThanOrEqual(14);
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(48);
  }
});

test("erro de reprodução fica legível fora da área dos controles nativos", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.route("**/player-errors", (route) =>
    route.fulfill({ status: 204 }),
  );
  await page.goto("/e2e-test/dois-players");
  await expect
    .poll(() => page.evaluate(() => window.__youtubeTest.playerVars.length))
    .toBe(2);
  await page.evaluate(() => window.__youtubeTest.emitError(0, 101));
  const error = page.getByRole("article").first().getByRole("alert");
  await expect(error).toContainText("Tente novamente");
  const [errorBox, playerBox, voteBox] = await Promise.all([
    error.boundingBox(),
    page.getByLabel("Player da música A").boundingBox(),
    page.getByRole("button", { name: "Votar na música A" }).boundingBox(),
  ]);
  expect(errorBox!.y).toBeGreaterThanOrEqual(playerBox!.y + playerBox!.height);
  expect(errorBox!.y + errorBox!.height).toBeLessThanOrEqual(voteBox!.y);
  await expect(
    page.getByRole("button", { name: "Votar na música A" }),
  ).toBeEnabled();
});

for (const width of [320, 360, 390]) {
  for (const swapped of [false, true]) {
    test(`nomes longos e texto ampliado permanecem completos em${width}px, invertidos=${swapped}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 740 });
      await page.route("**/player-errors", (route) =>
        route.fulfill({ status: 204 }),
      );
      await page.goto(
        `/e2e-test/dois-players?longNames=1&swapped=${swapped ? "1" : "0"}`,
      );
      await expect
        .poll(() => page.evaluate(() => window.__youtubeTest.playerVars.length))
        .toBe(2);
      const title = page.getByRole("heading", {
        name: /^Uma canção com um título/,
      });
      const isComplete = () =>
        title.evaluate(
          (element) =>
            element.scrollWidth <= element.clientWidth &&
            element.scrollHeight <= element.clientHeight + 1,
        );
      expect(await isComplete()).toBe(true);
      const normalFontSize = await title.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).fontSize),
      );
      await page.screenshot({
        path: testInfo.outputPath("long-names.png"),
        fullPage: true,
      });
      await page.addStyleTag({ content: "html { font-size: 200%; }" });
      expect(
        await title.evaluate((element) =>
          Number.parseFloat(getComputedStyle(element).fontSize),
        ),
      ).toBeGreaterThanOrEqual(normalFontSize * 2);
      expect(await isComplete()).toBe(true);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      await page.evaluate(() => window.__youtubeTest.emitError(0, 101));
      const error = page.getByRole("article").first().getByRole("alert");
      await expect(error).toContainText("Tente novamente");
      const [errorBox, playerBox] = await Promise.all([
        error.boundingBox(),
        page.getByLabel("Player da música A").boundingBox(),
      ]);
      expect(errorBox!.y).toBeGreaterThanOrEqual(
        playerBox!.y + playerBox!.height,
      );
      const abandon = page.getByRole("button", {
        name: "Abandonar partida e voltar ao tema",
      });
      await abandon.scrollIntoViewIfNeeded();
      await expect(abandon).toBeInViewport();
      await page.evaluate(() =>
        window.scrollTo({ top: 0, behavior: "instant" }),
      );
      await page.screenshot({
        path: testInfo.outputPath("text-200-error.png"),
        fullPage: true,
      });
    });
  }
}

for (const viewport of [
  { width: 320, height: 740 },
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
]) {
  for (const swapped of [false, true]) {
    test(`composição acessível ${viewport.width}x${viewport.height}, lados ${swapped ? "invertidos" : "originais"}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.goto(`/e2e-test/dois-players${swapped ? "?swapped=1" : ""}`);
      await expect
        .poll(() => page.evaluate(() => window.__youtubeTest.playerVars.length))
        .toBe(2);
      await page.evaluate(() => document.fonts.ready);
      const cards = await page.getByRole("article").evaluateAll((elements) =>
        elements.map((element) => {
          const player = element.querySelector(
            '[aria-label^="Player da música"]',
          )!;
          const vote = element.querySelector("button")!;
          const label = element.querySelector('[aria-label^="Música "]')!;
          return {
            card: element.getBoundingClientRect().toJSON(),
            player: player.getBoundingClientRect().toJSON(),
            vote: vote.getBoundingClientRect().toJSON(),
            cardRadius: Number.parseFloat(
              getComputedStyle(element).borderTopLeftRadius,
            ),
            voteRadius: Number.parseFloat(
              getComputedStyle(vote).borderTopLeftRadius,
            ),
            labelRadius: Number.parseFloat(
              getComputedStyle(label).borderTopLeftRadius,
            ),
          };
        }),
      );
      const versus = await page.getByText("VS", { exact: true }).boundingBox();
      expect(versus).not.toBeNull();
      const [a, b] = cards;
      expect(versus!.width).toBeGreaterThanOrEqual(48);
      expect(versus!.width).toBeLessThanOrEqual(56);
      expect(versus!.height).toBeCloseTo(versus!.width, 0);
      if (viewport.width < 900) {
        expect(versus!.y).toBeGreaterThanOrEqual(a.card.bottom + 12);
        expect(versus!.y + versus!.height + 12).toBeLessThanOrEqual(b.card.top);
        expect(versus!.x + versus!.width / 2).toBeCloseTo(
          viewport.width / 2,
          0,
        );
      } else {
        expect(versus!.x).toBeGreaterThanOrEqual(a.card.right + 12);
        expect(versus!.x + versus!.width + 12).toBeLessThanOrEqual(b.card.left);
        expect(a.player.top).toBeCloseTo(b.player.top, 0);
      }
      for (const side of cards) {
        expect(side.cardRadius).toBeGreaterThanOrEqual(18);
        expect(side.cardRadius).toBeLessThanOrEqual(20);
        expect(side.voteRadius).toBeGreaterThanOrEqual(12);
        expect(side.voteRadius).toBeLessThanOrEqual(14);
        expect(side.labelRadius).toBeGreaterThanOrEqual(12);
        expect(side.player.width).toBeGreaterThanOrEqual(200);
        expect(side.player.height).toBeGreaterThanOrEqual(200);
        expect(side.vote.height).toBeGreaterThanOrEqual(48);
        expect(side.vote.top - side.player.bottom).toBeGreaterThanOrEqual(12);
      }
      for (const surface of ["card", "player", "vote"] as const) {
        expect(a[surface].width).toBeCloseTo(b[surface].width, 0);
        expect(a[surface].height).toBeCloseTo(b[surface].height, 0);
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(viewport.width);
      const abandon = page.getByRole("button", {
        name: "Abandonar partida e voltar ao tema",
      });
      await abandon.scrollIntoViewIfNeeded();
      await expect(abandon).toBeInViewport();
      await page.evaluate(() =>
        window.scrollTo({ top: 0, behavior: "instant" }),
      );
      await page.screenshot({
        path: testInfo.outputPath("duel.png"),
        fullPage: true,
      });
      await testInfo.attach("layout", {
        body: JSON.stringify({ viewport, swapped, cards, versus }, null, 2),
        contentType: "application/json",
      });
    });
  }
}

for (const swapped of [false, true]) {
  test(`títulos de tamanhos diferentes preservam alinhamento desktop, invertidos=${swapped}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(
      `/e2e-test/dois-players?longNames=1&swapped=${swapped ? "1" : "0"}`,
    );
    const [a, b] = await Promise.all([
      page.getByLabel("Player da música A").boundingBox(),
      page.getByLabel("Player da música B").boundingBox(),
    ]);
    expect(a!.y).toBeCloseTo(b!.y, 0);
    expect(a!.width).toBeCloseTo(b!.width, 0);
    expect(a!.height).toBeCloseTo(b!.height, 0);
    await page.screenshot({
      path: testInfo.outputPath("duel-long-desktop.png"),
      fullPage: true,
    });
  });
}

test("teclado percorre A e B e devolve foco sem registrar decisões canceladas", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let decisions = 0;
  await page.route("**/decision", (route) => {
    decisions += 1;
    return route.fulfill({ status: 500 });
  });
  await page.goto("/e2e-test/dois-players");
  await expect
    .poll(() => page.evaluate(() => window.__youtubeTest.playerVars.length))
    .toBe(2);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Pular para o conteúdo" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  const draw = page.getByRole("button", {
    name: "Sortear vencedora do confronto",
  });
  await expect(draw).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Confirmar desempate" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(draw).toBeFocused();
  for (const label of ["A", "B"]) {
    await page.keyboard.press("Tab");
    await expect(
      page.getByLabel(`Player da música ${label}`).locator("iframe"),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    const vote = page.getByRole("button", { name: `Votar na música ${label}` });
    await expect(vote).toBeFocused();
    const focusStyle = await vote.evaluate((element) => ({
      width: Number.parseFloat(getComputedStyle(element).outlineWidth),
      style: getComputedStyle(element).outlineStyle,
    }));
    expect(focusStyle.width).toBeGreaterThanOrEqual(2);
    expect(focusStyle.style).not.toBe("none");
    await page.screenshot({ path: testInfo.outputPath(`focus-${label}.png`) });
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Confirmar voto" });
    await expect(
      dialog.getByRole("button", { name: "Cancelar" }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(vote).toBeFocused();
  }
  await page.keyboard.press("Tab");
  const abandon = page.getByRole("button", {
    name: "Abandonar partida e voltar ao tema",
  });
  await expect(abandon).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Abandonar partida?" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(abandon).toBeFocused();
  expect(decisions).toBe(0);
});

test("texto e foco mantêm contraste nos dois lados e no sorteio", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/e2e-test/dois-players");
  const measure = () =>
    page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d")!;
      function rgb(color: string) {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
      }
      function ratio(foreground: string, background: string) {
        function luminance(color: string) {
          const channels = rgb(color).map((channel) => {
            const value = channel / 255;
            return value <= 0.04045
              ? value / 12.92
              : ((value + 0.055) / 1.055) ** 2.4;
          });
          return (
            channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
          );
        }
        const a = luminance(foreground),
          b = luminance(background);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      }
      const cards = [...document.querySelectorAll("article")].map((card) => {
        const vote = getComputedStyle(card.querySelector("button")!);
        const title = getComputedStyle(card.querySelector("h2")!);
        const artist = getComputedStyle(card.querySelector("p")!);
        const background = getComputedStyle(card).backgroundColor;
        return {
          vote: ratio(vote.color, vote.backgroundColor),
          title: ratio(title.color, background),
          artist: ratio(artist.color, background),
          focus: ratio("#f5f3ed", background),
        };
      });
      const draw = document.querySelector<HTMLButtonElement>(
        '[aria-label="Sortear vencedora do confronto"]',
      )!;
      const drawStyle = getComputedStyle(draw);
      return {
        cards,
        draw: ratio(drawStyle.color, drawStyle.backgroundColor),
        drawDescription: ratio(
          getComputedStyle(draw.querySelector("small")!).color,
          drawStyle.backgroundColor,
        ),
      };
    });
  const normal = await measure();
  for (const label of ["A", "B"]) {
    await page
      .getByRole("button", { name: `Votar na música ${label}` })
      .hover();
    const hovered = await measure();
    expect(hovered.cards[label === "A" ? 0 : 1].vote).toBeGreaterThanOrEqual(
      4.5,
    );
  }
  for (const card of normal.cards) {
    expect(card.vote).toBeGreaterThanOrEqual(4.5);
    expect(card.title).toBeGreaterThanOrEqual(4.5);
    expect(card.artist).toBeGreaterThanOrEqual(4.5);
    expect(card.focus).toBeGreaterThanOrEqual(3);
  }
  expect(normal.draw).toBeGreaterThanOrEqual(4.5);
  expect(normal.drawDescription).toBeGreaterThanOrEqual(4.5);
  await testInfo.attach("contrast", {
    body: JSON.stringify(normal, null, 2),
    contentType: "application/json",
  });
});
