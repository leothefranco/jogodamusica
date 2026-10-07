import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import * as schema from "@/db/schema";
import { postgresRowsAdapter } from "../support/postgres-rows-adapter";
import { applySourceAvailabilityResult } from "@/domain/music/source-availability";
import {
  findSourceAvailabilityByProviderContentId,
  persistSourceAvailabilityObservation,
} from "@/server/repositories/source-availability-repository";
const boundary = vi.hoisted(() => ({ database: vi.fn() }));
vi.mock("@/db", () => ({ getDatabase: boundary.database }));
const client = new PGlite();
const database = drizzle(client, { schema });
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
  observedAt: new Date("2026-01-01T00:00:00Z"),
  result: { type: "available", reason: "available", track },
});
const unavailable = applySourceAvailabilityResult({
  current: null,
  observedAt: new Date("2026-01-03T00:00:00Z"),
  result: { type: "unavailable", reason: "region_blocked", track: null },
});
beforeAll(async () => {
  await client.exec("create role anon; create role authenticated;");
  const journal = JSON.parse(
    readFileSync("drizzle/meta/_journal.json", "utf8"),
  ) as { entries: { idx: number; tag: string }[] };
  for (const entry of journal.entries.filter(
    ({ idx }) => idx <= 6 || idx >= 10,
  ))
    await client.exec(readFileSync(`drizzle/${entry.tag}.sql`, "utf8"));
});
afterAll(() => client.close());
beforeEach(async () => {
  boundary.database.mockReturnValue(postgresRowsAdapter(database));
  await client.exec(
    "truncate source_availability_observations, unbound_source_availability_observations, songs cascade",
  );
});
describe("repositório de disponibilidade regional com SQL real", () => {
  it("persiste Fonte e observação atomicamente e permite reler a saúde", async () => {
    const saved = await persistSourceAvailabilityObservation({
      providerContentId: track.providerContentId,
      track,
      observation,
    });
    expect(saved).toMatchObject({
      applied: true,
      previousObservation: null,
      observation,
      track,
    });
    expect(saved.songId).toBeTruthy();
    expect(
      await findSourceAvailabilityByProviderContentId(
        track.providerContentId,
        "BR",
      ),
    ).toMatchObject({ songId: saved.songId, observation, track });
  });
  it("reconcilia observação por hash quando Fonte existe sem estado bound", async () => {
    await persistSourceAvailabilityObservation({
      providerContentId: track.providerContentId,
      track: null,
      observation: unavailable,
    });
    await database
      .insert(schema.songs)
      .values({ provider: "youtube", ...track });
    expect(
      await findSourceAvailabilityByProviderContentId(
        track.providerContentId,
        "BR",
      ),
    ).toMatchObject({ observation: unavailable });
  });
  it("ignora resposta antiga sem regredir observação nem metadados", async () => {
    await persistSourceAvailabilityObservation({
      providerContentId: track.providerContentId,
      track,
      observation: unavailable,
    });
    const stale = await persistSourceAvailabilityObservation({
      providerContentId: track.providerContentId,
      track: { ...track, sourceTitle: "Antigo" },
      observation,
    });
    expect(stale).toMatchObject({
      applied: false,
      previousObservation: unavailable,
      observation: unavailable,
    });
    expect(
      (
        await findSourceAvailabilityByProviderContentId(
          track.providerContentId,
          "BR",
        )
      )?.track?.sourceTitle,
    ).toBe("Fonte");
  });
  it("persiste ausência explícita nova por hash sem fabricar metadados", async () => {
    const saved = await persistSourceAvailabilityObservation({
      providerContentId: track.providerContentId,
      track: null,
      observation: unavailable,
    });
    expect(saved).toMatchObject({ songId: null, track: null, applied: true });
    expect(
      await findSourceAvailabilityByProviderContentId(
        track.providerContentId,
        "BR",
      ),
    ).toMatchObject({ songId: null, track: null, observation: unavailable });
  });
  it("migra a observação por hash antes de comparar resposta antiga", async () => {
    await persistSourceAvailabilityObservation({
      providerContentId: track.providerContentId,
      track: null,
      observation: unavailable,
    });
    const saved = await persistSourceAvailabilityObservation({
      providerContentId: track.providerContentId,
      track,
      observation,
    });
    expect(saved).toMatchObject({
      applied: false,
      observation: unavailable,
      previousObservation: unavailable,
    });
    expect(saved.songId).toBeTruthy();
    expect(
      await database
        .select()
        .from(schema.unboundSourceAvailabilityObservations),
    ).toHaveLength(0);
  });
});
