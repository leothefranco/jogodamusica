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

import { withThemeCoverUrlLock } from "@/server/repositories/theme-content-repository";

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
});
