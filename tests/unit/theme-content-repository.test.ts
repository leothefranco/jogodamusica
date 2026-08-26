import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
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
  const operationOrder: string[] = [];
  const deleteReturning = vi.fn().mockResolvedValue([]);
  const deleteWhere = vi.fn(() => ({ returning: deleteReturning }));
  const transactionDelete = vi.fn(() => {
    operationOrder.push("themes-delete");
    return { where: deleteWhere };
  });
  const databaseDelete = vi.fn(() => {
    operationOrder.push("database-delete");
    return { where: deleteWhere };
  });
  const transaction = {
    delete: transactionDelete,
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
    delete: databaseDelete,
    transaction: vi.fn(
      async (operation: (database: typeof transaction) => unknown) =>
        operation(transaction),
    ),
  };

  return {
    database,
    databaseDelete,
    deleteReturning,
    insertError,
    operationOrder,
    referenceLimit,
    savepointReturning,
    transaction,
    transactionDelete,
  };
});

vi.mock("@/db", () => ({
  getDatabase: () => databaseMocks.database,
}));

import {
  deleteThemeRecord,
  withThemeCoverUrlLock,
} from "@/server/repositories/theme-content-repository";

const dialect = new PgDialect();
const themeId = "20000000-0000-4000-8000-000000000002";

describe("repositório transacional da criação de Tema", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    databaseMocks.operationOrder.length = 0;
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

  it("bloqueia múltiplas claims em ordem determinística antes de excluir o Tema", async () => {
    let lockStatement: ReturnType<PgDialect["sqlToQuery"]> | null = null;
    databaseMocks.transaction.execute.mockImplementationOnce(async (query) => {
      databaseMocks.operationOrder.push("claims-for-update");
      lockStatement = dialect.sqlToQuery(query as SQL);
      return [
        { bucket: "theme-covers", objectKey: "owner/a.jpg", ownerId: "owner" },
        { bucket: "theme-covers", objectKey: "owner/b.jpg", ownerId: "owner" },
      ];
    });
    databaseMocks.deleteReturning.mockResolvedValueOnce([{ id: themeId }]);

    await expect(deleteThemeRecord(themeId)).resolves.toBe(themeId);

    expect(databaseMocks.operationOrder).toEqual([
      "claims-for-update",
      "themes-delete",
    ]);
    expect(lockStatement).not.toBeNull();
    expect(lockStatement!.sql.toLowerCase().replace(/\s+/g, " ")).toContain(
      "select bucket, object_key, owner_id from public.theme_cover_claims where theme_id = $1::uuid order by bucket, object_key, owner_id for update",
    );
    expect(lockStatement!.params).toEqual([themeId]);
    expect(lockStatement!.sql.toLowerCase()).not.toContain(" limit ");
    expect(databaseMocks.database.transaction).toHaveBeenCalledOnce();
    expect(databaseMocks.transactionDelete).toHaveBeenCalledOnce();
    expect(databaseMocks.databaseDelete).not.toHaveBeenCalled();
  });

  it("preserva o contrato null para Tema ausente depois de bloquear suas claims", async () => {
    databaseMocks.transaction.execute.mockImplementationOnce(async () => {
      databaseMocks.operationOrder.push("claims-for-update");
      return [];
    });
    databaseMocks.deleteReturning.mockResolvedValueOnce([]);

    await expect(deleteThemeRecord(themeId)).resolves.toBeNull();
    expect(databaseMocks.operationOrder).toEqual([
      "claims-for-update",
      "themes-delete",
    ]);
    expect(databaseMocks.database.transaction).toHaveBeenCalledOnce();
    expect(databaseMocks.transactionDelete).toHaveBeenCalledOnce();
    expect(databaseMocks.databaseDelete).not.toHaveBeenCalled();
  });
});
