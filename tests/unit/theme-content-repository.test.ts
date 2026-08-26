import { beforeEach, describe, expect, it, vi } from "vitest";

const databaseMocks = vi.hoisted(() => {
  const insertError = Object.assign(new Error("constraint failed"), {
    code: "23514",
  });
  const savepointReturning = vi.fn().mockRejectedValue(insertError);
  const savepoint = {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn(() => ({
          returning: savepointReturning,
        })),
      })),
    })),
  };
  const referenceLimit = vi.fn().mockResolvedValue([]);
  const transaction = {
    execute: vi.fn().mockResolvedValue([]),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ limit: referenceLimit })),
      })),
    })),
    transaction: vi.fn(
      async (operation: (database: typeof savepoint) => unknown) =>
        operation(savepoint),
    ),
  };
  const database = {
    transaction: vi.fn(
      async (operation: (database: typeof transaction) => unknown) =>
        operation(transaction),
    ),
  };

  return {
    database,
    insertError,
    referenceLimit,
    savepointReturning,
    transaction,
  };
});

vi.mock("@/db", () => ({
  getDatabase: () => databaseMocks.database,
}));

import {
  withThemeCoverCleanupLock,
  withThemeCoverUrlLock,
} from "@/server/repositories/theme-content-repository";

describe("repositório transacional da criação de Tema", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("isola falha de insert em savepoint e mantém o lock consultável", async () => {
    const result = await withThemeCoverUrlLock(
      "https://project.supabase.co/cover.jpg",
      async (repository) => {
        let insertFailure: unknown;
        try {
          await repository.insert({
            name: "Clássicos",
            slug: "classicos",
            description: null,
            coverUrl: "https://project.supabase.co/cover.jpg",
            isActive: false,
          });
        } catch (error) {
          insertFailure = error;
        }

        const referenced = await repository.isCoverUrlReferenced(
          "https://project.supabase.co/cover.jpg",
        );
        return { insertFailure, referenced };
      },
    );

    expect(result).toEqual({
      insertFailure: databaseMocks.insertError,
      referenced: false,
    });
    expect(databaseMocks.transaction.transaction).toHaveBeenCalledOnce();
    expect(databaseMocks.savepointReturning).toHaveBeenCalledOnce();
    expect(databaseMocks.referenceLimit).toHaveBeenCalledOnce();
  });

  it("mantém no máximo um cleanup com conexão por processo e libera após assentar", async () => {
    databaseMocks.transaction.execute.mockResolvedValue([{ acquired: true }]);
    let settleCleanup = () => {};
    const cleanupMaySettle = new Promise<void>((resolve) => {
      settleCleanup = resolve;
    });
    let markCleanupStarted = () => {};
    const cleanupStarted = new Promise<void>((resolve) => {
      markCleanupStarted = resolve;
    });

    const first = withThemeCoverCleanupLock(
      "https://project.supabase.co/first.jpg",
      async (repository) => {
        await repository.isCoverUrlReferenced(
          "https://project.supabase.co/first.jpg",
        );
        markCleanupStarted();
        await cleanupMaySettle;
        return "removed";
      },
    );
    await cleanupStarted;

    await expect(
      withThemeCoverCleanupLock(
        "https://project.supabase.co/second.jpg",
        async () => "should-not-run",
      ),
    ).rejects.toMatchObject({ code: "THEME_COVER_CLEANUP_BUSY" });
    expect(databaseMocks.database.transaction).toHaveBeenCalledOnce();

    settleCleanup();
    await expect(first).resolves.toBe("removed");
    await expect(
      withThemeCoverCleanupLock(
        "https://project.supabase.co/third.jpg",
        async () => "released",
      ),
    ).resolves.toBe("released");
    expect(databaseMocks.database.transaction).toHaveBeenCalledTimes(2);
  });

  it("falha rápido sem executar cleanup quando o advisory lock está ocupado", async () => {
    databaseMocks.transaction.execute.mockResolvedValue([{ acquired: false }]);
    const cleanup = vi.fn();

    await expect(
      withThemeCoverCleanupLock(
        "https://project.supabase.co/cover.jpg",
        cleanup,
      ),
    ).rejects.toMatchObject({ code: "THEME_COVER_CLEANUP_BUSY" });
    expect(cleanup).not.toHaveBeenCalled();
  });
});
