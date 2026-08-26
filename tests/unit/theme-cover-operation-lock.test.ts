import { describe, expect, it, vi } from "vitest";

import {
  createThemeCoverCleanupSlot,
  createThemeCoverOperationLock,
} from "@/server/services/theme-cover-operation-lock";

describe("lock lógico de operação da capa", () => {
  it("serializa a mesma capa e sempre libera depois de falha", async () => {
    const withLock = createThemeCoverOperationLock({ waitTimeoutMs: 1_000 });
    const events: string[] = [];
    let releaseFirst = () => {};
    const firstMayFinish = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = withLock("cover", async () => {
      events.push("first:start");
      await firstMayFinish;
      events.push("first:throw");
      throw new Error("failed");
    });
    const secondOperation = vi.fn(async () => {
      events.push("second:start");
      return "ok";
    });
    const second = withLock("cover", secondOperation);

    await Promise.resolve();
    expect(secondOperation).not.toHaveBeenCalled();
    releaseFirst();
    await expect(first).rejects.toThrow("failed");
    await expect(second).resolves.toBe("ok");
    expect(events).toEqual(["first:start", "first:throw", "second:start"]);

    await expect(withLock("cover", async () => "released")).resolves.toBe(
      "released",
    );
  });

  it("limita a espera sem liberar prematuramente a operação ativa", async () => {
    const withLock = createThemeCoverOperationLock({ waitTimeoutMs: 10 });
    let releaseFirst = () => {};
    const firstMayFinish = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const first = withLock("cover", () => firstMayFinish);

    await expect(
      withLock("cover", async () => undefined),
    ).rejects.toMatchObject({ code: "THEME_COVER_BUSY" });

    let thirdStarted = false;
    const third = withLock("cover", async () => {
      thirdStarted = true;
    });
    await Promise.resolve();
    expect(thirdStarted).toBe(false);
    releaseFirst();
    await first;
    await third;
    expect(thirdStarted).toBe(true);
  });

  it("libera o slot de cleanup somente depois de uma rejeição assentar", async () => {
    const withCleanupSlot = createThemeCoverCleanupSlot();
    let rejectCleanup: (error: Error) => void = () => {};
    const cleanupMaySettle = new Promise<never>((_resolve, reject) => {
      rejectCleanup = reject;
    });
    const first = withCleanupSlot(() => cleanupMaySettle);

    await expect(
      withCleanupSlot(async () => "should-not-run"),
    ).rejects.toMatchObject({ code: "THEME_COVER_CLEANUP_BUSY" });

    rejectCleanup(new Error("delete aborted"));
    await expect(first).rejects.toThrow("delete aborted");
    await expect(
      withCleanupSlot(async () => "released-after-settle"),
    ).resolves.toBe("released-after-settle");
  });
});
