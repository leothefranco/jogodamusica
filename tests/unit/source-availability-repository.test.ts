import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { applySourceAvailabilityResult } from "@/domain/music/source-availability";

const databaseMocks = vi.hoisted(() => {
  const responses: unknown[][] = [];
  const execute = vi.fn(async (query: unknown) => {
    void query;
    return responses.shift() ?? [];
  });
  const transaction = { execute };
  const database = {
    transactionOpen: false,
    execute,
    transaction: vi.fn(
      async (operation: (database: typeof transaction) => unknown) => {
        database.transactionOpen = true;
        try {
          return await operation(transaction);
        } finally {
          database.transactionOpen = false;
        }
      },
    ),
  };

  return { database, execute, responses, transaction };
});

vi.mock("@/db", () => ({
  getDatabase: () => databaseMocks.database,
}));

import {
  findSourceAvailabilityByProviderContentId,
  persistSourceAvailabilityObservation,
} from "@/server/repositories/source-availability-repository";

const dialect = new PgDialect();
const songId = "20000000-0000-4000-8000-000000000020";
const track = {
  providerContentId: "dQw4w9WgXcQ",
  sourceTitle: "Fonte",
  sourceChannel: "Canal",
  thumbnailUrl: "https://example.com/thumb.jpg",
  durationSeconds: 180,
  isEmbeddable: true,
  isRegionAllowed: true,
};
const observation = applySourceAvailabilityResult({
  current: null,
  observedAt: new Date("2026-01-01T00:00:00.000Z"),
  result: { type: "available", reason: "available", track },
});

function observationRow(
  overrides: Partial<typeof observation> = {},
): Record<string, unknown> {
  return { ...observation, ...overrides };
}

function compiledStatements() {
  return databaseMocks.execute.mock.calls.map(([query]) =>
    dialect.sqlToQuery(query as SQL),
  );
}

function normalizedStatements() {
  return compiledStatements().map(({ sql }) =>
    sql.toLowerCase().replace(/\s+/g, " "),
  );
}

describe("repositório de disponibilidade regional", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    databaseMocks.responses.length = 0;
    databaseMocks.database.transactionOpen = false;
  });

  it("persiste Fonte e observação em transação curta com CAS atômico", async () => {
    databaseMocks.responses.push(
      [],
      [{ id: songId }],
      [],
      [observationRow()],
      [],
      [],
    );

    await expect(
      persistSourceAvailabilityObservation({
        providerContentId: track.providerContentId,
        track,
        observation,
      }),
    ).resolves.toEqual({ songId, observation, applied: true, track });

    expect(databaseMocks.database.transaction).toHaveBeenCalledOnce();
    expect(databaseMocks.database.transactionOpen).toBe(false);
    expect(normalizedStatements()).toEqual([
      expect.stringContaining("pg_advisory_xact_lock"),
      expect.stringContaining("insert into public.songs"),
      expect.stringContaining(
        "from public.unbound_source_availability_observations",
      ),
      expect.stringContaining(
        "insert into public.source_availability_observations",
      ),
      expect.stringContaining(
        "delete from public.unbound_source_availability_observations",
      ),
      expect.stringContaining("update public.songs"),
    ]);

    const cas = normalizedStatements()[3];
    expect(cas).toContain("on conflict (song_id, region) do update");
    expect(cas).toContain("excluded.revision >= current.revision");
    expect(cas).toContain("revision = current.revision + 1");
    expect(cas).toContain("excluded.observed_at >= current.observed_at");
    expect(cas).toContain(
      "excluded.last_attempt_at >= current.last_attempt_at",
    );
    expect(cas).toContain("is distinct from");

    const lockParams = compiledStatements()[0].params;
    expect(lockParams).not.toContain(track.providerContentId);

    const casParams = compiledStatements()[3].params;
    expect(casParams).not.toContain(track.providerContentId);
    expect(casParams).not.toContain(track.sourceTitle);
    expect(casParams).not.toContain(track.thumbnailUrl);
  });

  it("reconcilia observação por hash quando songs existe sem estado bound", async () => {
    const unbound = observationRow({
      observedAt: new Date("2026-01-03T00:00:00.000Z"),
      lastAttemptAt: new Date("2026-01-03T00:00:00.000Z"),
      revision: 3,
    });
    databaseMocks.responses.push(
      [
        {
          songId,
          providerContentId: track.providerContentId,
          sourceTitle: track.sourceTitle,
          sourceChannel: track.sourceChannel,
          thumbnailUrl: track.thumbnailUrl,
          durationSeconds: track.durationSeconds,
          isEmbeddable: track.isEmbeddable,
        },
      ],
      [unbound],
    );

    await expect(
      findSourceAvailabilityByProviderContentId(track.providerContentId, "BR"),
    ).resolves.toMatchObject({
      songId,
      track: { providerContentId: track.providerContentId },
      observation: { revision: 3 },
    });
    expect(normalizedStatements()).toHaveLength(2);
    expect(normalizedStatements()[1]).toContain(
      "from public.unbound_source_availability_observations",
    );
  });

  it("ignora resposta antiga sem regredir observação ou metadados da Fonte", async () => {
    const current = observationRow({
      observedAt: new Date("2026-01-03T00:00:00.000Z"),
      lastAttemptAt: new Date("2026-01-03T00:00:00.000Z"),
      lastConfirmedAt: new Date("2026-01-03T00:00:00.000Z"),
      revision: 3,
    });
    databaseMocks.responses.push(
      [],
      [],
      [{ id: songId }],
      [],
      [],
      [current],
      [],
      [
        {
          providerContentId: track.providerContentId,
          sourceTitle: track.sourceTitle,
          sourceChannel: track.sourceChannel,
          thumbnailUrl: track.thumbnailUrl,
          durationSeconds: track.durationSeconds,
          isEmbeddable: track.isEmbeddable,
        },
      ],
    );

    await expect(
      persistSourceAvailabilityObservation({
        providerContentId: track.providerContentId,
        track: { ...track, sourceTitle: "Metadado antigo" },
        observation,
      }),
    ).resolves.toMatchObject({
      songId,
      applied: false,
      observation: { revision: 3 },
      track,
    });

    expect(normalizedStatements()).toHaveLength(8);
    expect(normalizedStatements().at(-3)).toContain(
      "from public.source_availability_observations",
    );
    expect(normalizedStatements().at(-2)).toContain(
      "delete from public.unbound_source_availability_observations",
    );
    expect(normalizedStatements().at(-1)).toContain("from public.songs");
    expect(normalizedStatements()).not.toEqual(
      expect.arrayContaining([expect.stringContaining("update public.songs")]),
    );
  });

  it("persiste ausência explícita nova por hash sem fabricar metadados", async () => {
    const unavailable = applySourceAvailabilityResult({
      current: null,
      observedAt: new Date("2026-01-01T00:00:00.000Z"),
      result: { type: "unavailable", reason: "not_found", track: null },
    });
    databaseMocks.responses.push([], [], [observationRow(unavailable)]);

    await expect(
      persistSourceAvailabilityObservation({
        providerContentId: track.providerContentId,
        track: null,
        observation: unavailable,
      }),
    ).resolves.toMatchObject({
      songId: null,
      observation: unavailable,
      applied: true,
    });
    expect(normalizedStatements()).toHaveLength(3);
    expect(normalizedStatements()[0]).toContain("pg_advisory_xact_lock");
    expect(normalizedStatements()[1]).toContain("from public.songs");
    expect(normalizedStatements()[2]).toContain(
      "insert into public.unbound_source_availability_observations",
    );
    expect(compiledStatements()[2].params).not.toContain(
      track.providerContentId,
    );
    const pendingCas = normalizedStatements()[2];
    expect(pendingCas).toContain("excluded.revision >= current.revision");
    expect(pendingCas).toContain("revision = current.revision + 1");
    expect(pendingCas).toContain("is distinct from");
  });

  it("migra a observação por hash antes de comparar resposta antiga", async () => {
    const newerUnavailable = applySourceAvailabilityResult({
      current: null,
      observedAt: new Date("2026-01-03T00:00:00.000Z"),
      result: {
        type: "unavailable",
        reason: "region_blocked",
        track: { ...track, isRegionAllowed: false },
      },
    });
    databaseMocks.responses.push(
      [],
      [{ id: songId }],
      [observationRow(newerUnavailable)],
      [observationRow(newerUnavailable)],
      [],
      [observationRow(newerUnavailable)],
      [],
      [
        {
          providerContentId: track.providerContentId,
          sourceTitle: track.sourceTitle,
          sourceChannel: track.sourceChannel,
          thumbnailUrl: track.thumbnailUrl,
          durationSeconds: track.durationSeconds,
          isEmbeddable: track.isEmbeddable,
        },
      ],
    );

    await expect(
      persistSourceAvailabilityObservation({
        providerContentId: track.providerContentId,
        track,
        observation,
      }),
    ).resolves.toMatchObject({
      songId,
      observation: { confirmationReason: "region_blocked" },
      applied: false,
    });

    const statements = normalizedStatements();
    expect(statements[2]).toContain("for update");
    expect(
      statements.filter((statement) =>
        statement.includes(
          "insert into public.source_availability_observations",
        ),
      ),
    ).toHaveLength(2);
    expect(statements).not.toEqual(
      expect.arrayContaining([expect.stringContaining("update public.songs")]),
    );
  });
});
