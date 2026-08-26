import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const databaseMocks = vi.hoisted(() => {
  const responses: unknown[][] = [];
  const execute = vi.fn(async (query: unknown) => {
    void query;
    return responses.shift() ?? [];
  });
  const transaction = {
    execute,
    transaction: vi.fn(),
  };
  const database = {
    transactionOpen: false,
    transaction: vi.fn(),
  };

  return { database, execute, responses, transaction };
});

vi.mock("@/db", () => ({
  getDatabase: () => databaseMocks.database,
}));

import {
  acquireThemeCoverClaim,
  finalizeThemeCoverCleanup,
  prepareThemeCoverCleanup,
  withThemeCoverClaimPersistence,
  type ThemeCoverClaim,
} from "@/server/repositories/theme-content-repository";

const key = {
  bucket: "theme-covers" as const,
  objectKey:
    "10000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000003.jpg",
  actorId: "10000000-0000-4000-8000-000000000001",
  ownerId: "10000000-0000-4000-8000-000000000001",
  payloadHash: "a".repeat(64),
};
const claimedRow = {
  ...key,
  epoch: 4,
  leaseExpiresAt: new Date("2026-08-26T04:00:00Z"),
  status: "claimed" as const,
  themeId: null,
};
const dialect = new PgDialect();

function normalizedStatements() {
  return databaseMocks.execute.mock.calls.map(([query]) =>
    dialect
      .sqlToQuery(query as SQL)
      .sql.toLowerCase()
      .replace(/\s+/g, " "),
  );
}

function compiledStatements() {
  return databaseMocks.execute.mock.calls.map(([query]) =>
    dialect.sqlToQuery(query as SQL),
  );
}

describe("repositório de claims duráveis de capa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    databaseMocks.responses.length = 0;
    databaseMocks.responses.push([{ acquired: true }], [{ allowed: true }]);
    databaseMocks.database.transactionOpen = false;
    databaseMocks.database.transaction.mockImplementation(
      async (
        operation: (database: typeof databaseMocks.transaction) => unknown,
      ) => {
        databaseMocks.database.transactionOpen = true;
        try {
          return await operation(databaseMocks.transaction);
        } finally {
          databaseMocks.database.transactionOpen = false;
        }
      },
    );
  });

  it("cria a claim antes do caminho de Storage e usa chave advisory estruturada", async () => {
    databaseMocks.responses.push([], [{ ...claimedRow, epoch: 1 }]);

    await expect(acquireThemeCoverClaim(key)).resolves.toEqual({
      status: "claimed",
      claim: { ...key, epoch: 1 },
    });

    expect(normalizedStatements()).toEqual([
      expect.stringContaining("pg_try_advisory_xact_lock"),
      expect.stringContaining("from public.admin_profiles"),
      expect.stringContaining("for update"),
      expect.stringContaining("insert into public.theme_cover_claims"),
    ]);
    expect(normalizedStatements()[1]).toContain("for share nowait");

    const advisoryKey = compiledStatements()[0].params[0];
    expect(advisoryKey).toBe(
      JSON.stringify([
        "theme-cover-claim-v1",
        key.bucket,
        key.objectKey,
        key.ownerId,
      ]),
    );
    expect(advisoryKey).not.toContain("\u0000");
    expect(JSON.parse(advisoryKey as string)).toEqual([
      "theme-cover-claim-v1",
      key.bucket,
      key.objectKey,
      key.ownerId,
    ]);

    const distinctKey = {
      ...key,
      objectKey:
        "10000000-0000-4000-8000-000000000001/40000000-0000-4000-8000-000000000004.jpg",
    };
    databaseMocks.responses.push(
      [{ acquired: true }],
      [{ allowed: true }],
      [],
      [{ ...claimedRow, ...distinctKey, epoch: 1 }],
    );

    await acquireThemeCoverClaim(distinctKey);

    const advisoryKeys = compiledStatements()
      .filter(({ sql }) => sql.includes("pg_try_advisory_xact_lock"))
      .map(({ params }) => params[0]);
    expect(advisoryKeys).toHaveLength(2);
    expect(new Set(advisoryKeys).size).toBe(2);
    expect(advisoryKeys[1]).toBe(
      JSON.stringify([
        "theme-cover-claim-v1",
        distinctKey.bucket,
        distinctKey.objectKey,
        distinctKey.ownerId,
      ]),
    );
  });

  it("falha imediatamente quando o advisory lock está ocupado", async () => {
    databaseMocks.responses[0] = [{ acquired: false }];

    await expect(acquireThemeCoverClaim(key)).rejects.toMatchObject({
      code: "THEME_COVER_CLAIM_BUSY",
    });
    expect(databaseMocks.execute).toHaveBeenCalledOnce();
    expect(normalizedStatements()[0]).toContain("pg_try_advisory_xact_lock");
  });

  it("rejeita chave/prefixo não confiável antes de abrir transação", async () => {
    databaseMocks.responses.length = 0;

    await expect(
      acquireThemeCoverClaim({
        ...key,
        objectKey:
          "90000000-0000-4000-8000-000000000009/30000000-0000-4000-8000-000000000003.jpg",
      }),
    ).rejects.toMatchObject({ code: "INVALID_THEME_COVER_REFERENCE" });
    expect(databaseMocks.database.transaction).not.toHaveBeenCalled();
    expect(databaseMocks.execute).not.toHaveBeenCalled();
  });

  it("rejeita owner inativo mesmo com conexão privilegiada", async () => {
    databaseMocks.responses[1] = [{ allowed: false }];

    await expect(acquireThemeCoverClaim(key)).rejects.toMatchObject({
      code: "THEME_COVER_CLAIM_FORBIDDEN",
    });
    expect(databaseMocks.execute).toHaveBeenCalledTimes(2);
    expect(normalizedStatements()[0]).toContain("pg_try_advisory_xact_lock");
    expect(normalizedStatements()[1]).toContain("is_active = true");
    expect(normalizedStatements()[1]).toContain("for share nowait");
  });

  it("distingue o ator autenticado do owner antes de abrir transação", async () => {
    databaseMocks.responses.length = 0;

    await expect(
      acquireThemeCoverClaim({
        ...key,
        actorId: "90000000-0000-4000-8000-000000000009",
      }),
    ).rejects.toMatchObject({ code: "THEME_COVER_CLAIM_FORBIDDEN" });
    expect(databaseMocks.database.transaction).not.toHaveBeenCalled();
    expect(databaseMocks.execute).not.toHaveBeenCalled();
  });

  it("não toma lease de deleting ainda ativo", async () => {
    databaseMocks.responses.push(
      [
        {
          ...claimedRow,
          status: "deleting",
          leaseExpiresAt: new Date("2099-01-01T00:00:00Z"),
        },
      ],
      [],
    );

    await expect(acquireThemeCoverClaim(key)).rejects.toMatchObject({
      code: "THEME_COVER_CLEANUP_BUSY",
    });
    expect(normalizedStatements().at(-1)).toContain(
      "or lease_expires_at <= now()",
    );
  });

  it("retoma delete_failed com epoch novo sem permitir ABA", async () => {
    const cleanupRow = {
      ...claimedRow,
      epoch: 5,
      status: "deleting" as const,
    };
    databaseMocks.responses.push(
      [{ ...claimedRow, status: "delete_failed", leaseExpiresAt: null }],
      [cleanupRow],
    );

    await expect(acquireThemeCoverClaim(key)).resolves.toEqual({
      status: "cleanup-required",
      claim: { ...key, epoch: 5 },
    });
    const takeover = normalizedStatements().at(-1)!;
    expect(takeover).toContain("set epoch = epoch + 1");
    expect(takeover).toContain("and epoch =");
    expect(takeover).toContain("and status =");
  });

  it("conflita payload divergente sem alterar a claim existente", async () => {
    databaseMocks.responses.push([
      { ...claimedRow, payloadHash: "b".repeat(64) },
    ]);

    await expect(acquireThemeCoverClaim(key)).resolves.toEqual({
      status: "conflict",
    });
    expect(databaseMocks.execute).toHaveBeenCalledTimes(3);
  });

  it("insere/reconcilia Tema e consome a claim na mesma transação curta", async () => {
    databaseMocks.responses.push(
      [claimedRow],
      [{ themeId: "20000000-0000-4000-8000-000000000002" }],
    );
    const operation = vi.fn(async () => {
      expect(databaseMocks.database.transactionOpen).toBe(true);
      return {
        idempotent: false,
        themeId: "20000000-0000-4000-8000-000000000002",
      };
    });

    await expect(
      withThemeCoverClaimPersistence(
        { ...key, epoch: claimedRow.epoch },
        operation,
      ),
    ).resolves.toEqual({
      idempotent: false,
      themeId: "20000000-0000-4000-8000-000000000002",
    });

    expect(operation).toHaveBeenCalledOnce();
    const consume = normalizedStatements().at(-1)!;
    expect(consume).toContain("set status = 'consumed'");
    expect(consume).toContain("and epoch =");
    expect(consume).toContain("and status = 'claimed'");
  });

  it("rejeita consumidor suspenso depois que outro epoch criou tombstone", async () => {
    databaseMocks.responses.push([
      { ...claimedRow, epoch: 5, status: "deleting" },
    ]);
    const operation = vi.fn();

    await expect(
      withThemeCoverClaimPersistence(
        { ...key, epoch: claimedRow.epoch },
        operation,
      ),
    ).rejects.toMatchObject({ code: "THEME_COVER_CLAIM_REVOKED" });
    expect(operation).not.toHaveBeenCalled();
  });

  it("cria tombstone em transação curta antes de autorizar o DELETE", async () => {
    const cleanupRow = {
      ...claimedRow,
      epoch: 5,
      status: "deleting" as const,
    };
    databaseMocks.responses.push([claimedRow], [], [cleanupRow]);

    await expect(
      prepareThemeCoverCleanup(
        { ...key, epoch: claimedRow.epoch },
        "https://project.supabase.co/storage/v1/object/public/theme-covers/cover.jpg",
      ),
    ).resolves.toEqual({
      status: "cleanup-ready",
      claim: { ...key, epoch: 5 },
    });

    const tombstone = normalizedStatements().at(-1)!;
    expect(tombstone).toContain("set epoch = epoch + 1");
    expect(tombstone).toContain("status = 'deleting'");
    expect(tombstone).toContain("and epoch =");
    expect(tombstone).toContain("and status = 'claimed'");
    expect(databaseMocks.database.transactionOpen).toBe(false);
  });

  it("preserva capa já referenciada e converte a claim em consumed", async () => {
    const themeId = "20000000-0000-4000-8000-000000000002";
    databaseMocks.responses.push(
      [claimedRow],
      [{ id: themeId }],
      [{ themeId }],
    );

    await expect(
      prepareThemeCoverCleanup(
        { ...key, epoch: claimedRow.epoch },
        "https://project.supabase.co/storage/v1/object/public/theme-covers/cover.jpg",
      ),
    ).resolves.toEqual({ status: "preserved-in-use" });
  });

  it.each([
    ["deleted", "deleted"],
    ["delete-failed", "delete_failed"],
  ] as const)(
    "finaliza %s apenas para o mesmo epoch deleting",
    async (outcome, status) => {
      databaseMocks.responses.push([{ status }]);

      await expect(
        finalizeThemeCoverCleanup(
          { ...key, epoch: 5 } satisfies ThemeCoverClaim,
          outcome,
        ),
      ).resolves.toBeUndefined();
      const finalize = normalizedStatements().at(-1)!;
      expect(finalize).toContain("and epoch =");
      expect(finalize).toContain("and status = 'deleting'");
    },
  );
});
