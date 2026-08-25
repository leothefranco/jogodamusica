import { describe, expect, it, vi } from "vitest";

import { createGamePlaybackErrorReporter } from "@/server/services/game-service";

const sessionId = "20000000-0000-4000-8000-000000000020";
const matchId = "30000000-0000-4000-8000-000000000030";

describe("relato de falha de playback", () => {
  it("emite os cinco códigos permitidos sem identificadores crus", async () => {
    const ensureSessionExists = vi.fn().mockResolvedValue(undefined);
    const reportEvent = vi.fn();
    const reportPlaybackError = createGamePlaybackErrorReporter({
      ensureSessionExists,
      randomUUID: () => "10000000-0000-4000-8000-000000000001",
      reportEvent,
    });

    for (const errorCode of [2, 5, 100, 101, 150] as const) {
      await reportPlaybackError({ sessionId, matchId, errorCode });
    }

    expect(ensureSessionExists).toHaveBeenCalledTimes(5);
    expect(ensureSessionExists).toHaveBeenCalledWith(sessionId);
    expect(reportEvent.mock.calls.map(([event]) => event.payload)).toEqual(
      [2, 5, 100, 101, 150].map((playerErrorCode) => ({
        surface: "game_player",
        playerErrorCode,
        failureClass: "provider_playback",
      })),
    );
    const serialized = JSON.stringify(reportEvent.mock.calls);
    expect(serialized).not.toContain(sessionId);
    expect(serialized).not.toContain(matchId);
    expect(serialized).not.toContain("providerId");
    expect(serialized).not.toContain("url");
    expect(serialized).not.toContain("message");
  });

  it("não altera o relato de negócio quando o reporter falha", async () => {
    const ensureSessionExists = vi.fn().mockResolvedValue(undefined);
    const reportPlaybackError = createGamePlaybackErrorReporter({
      ensureSessionExists,
      randomUUID: () => "10000000-0000-4000-8000-000000000001",
      reportEvent: () => {
        throw new Error("exporter indisponível");
      },
    });

    await expect(
      reportPlaybackError({ sessionId, matchId, errorCode: 101 }),
    ).resolves.toBeUndefined();
    expect(ensureSessionExists).toHaveBeenCalledWith(sessionId);
  });
});
