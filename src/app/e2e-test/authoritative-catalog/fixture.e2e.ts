import "server-only";

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/pglite";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { createGameService } from "@/server/services/game-service";
import {
  getGameStateRecord,
  withGameCreationTransaction,
} from "@/server/repositories/game-repository";
import * as schema from "@/db/schema";
import { createAuthoritativePublicThemeRepository } from "@/server/repositories/authoritative-public-theme-repository";
import { createAuthoritativePublicThemeService } from "@/server/services/public-theme-service";

const now = new Date("2026-01-08T00:00:00.001Z");
const id = (kind: number, index: number) =>
  `${kind}0000000-0000-4000-8000-${String(index).padStart(12, "0")}`;

async function createFixture() {
  // Native loading keeps the installed WASM assets next to the ephemeral driver.
  const fixtureRequire = createRequire(join(process.cwd(), "package.json"));
  const { PGlite }: typeof import("@electric-sql/pglite") = fixtureRequire(
    "@electric-sql/pglite",
  );
  const client = new PGlite();
  const database = drizzle(client, { schema });
  await client.exec("create role anon; create role authenticated;");
  const journal = JSON.parse(
    readFileSync("drizzle/meta/_journal.json", "utf8"),
  ) as { entries: { idx: number; tag: string }[] };
  for (const entry of journal.entries.filter(
    ({ idx }) => idx <= 6 || idx >= 10,
  )) {
    await client.exec(readFileSync(`drizzle/${entry.tag}.sql`, "utf8"));
  }
  await database.insert(schema.themes).values([
    ...Array.from({ length: 200 }, (_, i) => ({
      id: id(1, 1000 + i),
      name: `A suspenso ${i}`,
      slug: `suspenso-${i}`,
      editorialState: "published" as const,
      isActive: true,
    })),
    ...[3, 64, 128].map((size) => ({
      id: id(1, size),
      name: `Tema direto ${size}`,
      slug: `direto-${size}`,
      editorialState:
        size === 128 ? ("draft" as const) : ("published" as const),
      isActive: size !== 128,
    })),
  ]);
  await database.insert(schema.songs).values(
    Array.from({ length: 128 }, (_, i) => ({
      id: id(2, i + 1),
      provider: "youtube" as const,
      providerContentId: `fixture-${i}`,
      sourceTitle: "Origem privada",
      sourceChannel: "Canal privado",
      thumbnailUrl: `/icon.svg?fixture=${i + 1}`,
      durationSeconds: 180,
      isEmbeddable: false,
    })),
  );
  await database.insert(schema.sourceAvailabilityObservations).values(
    Array.from({ length: 128 }, (_, i) => ({
      songId: id(2, i + 1),
      region: "BR",
      confirmedState: "available" as const,
      confirmationReason: "available" as const,
      observedAt: new Date("2026-01-01T00:00:00Z"),
      lastAttemptAt: new Date("2026-01-01T00:00:00Z"),
      lastConfirmedAt: new Date("2026-01-01T00:00:00Z"),
      validUntil: new Date(
        i === 0 ? "2026-01-08T00:00:00Z" : "2026-01-15T00:00:00Z",
      ),
      graceUntil: new Date("2026-01-16T00:00:00Z"),
      nextCheckAt: now,
      revision: 1,
      policyVersion: 1,
    })),
  );
  await database.insert(schema.themeSongs).values(
    [3, 64, 128].flatMap((size) =>
      Array.from({ length: size }, (_, i) => ({
        themeId: id(1, size),
        songId: id(2, i + 1),
        title: "QA",
        artist: "QA",
        previewDurationSeconds: 30,
        displayOrder: i,
        isActive: true,
      })),
    ),
  );
  const catalog = createAuthoritativePublicThemeService({
    ...createAuthoritativePublicThemeRepository(database),
    clock: () => now,
  });
  const games = createGameService({
    getGameState: (id) => getGameStateRecord(id, database),
    now: () => now,
    random: Math.random,
    withGameCreationTransaction: (id, operation, options) =>
      withGameCreationTransaction(
        id,
        operation,
        { ...options, authoritative: true, clock: () => now },
        database,
      ),
    withGameDecisionTransaction: async () => {
      throw new Error("Fixture only supports creation");
    },
  });
  return { ...catalog, games };
}

const fixtureGlobal = globalThis as typeof globalThis & {
  authoritativeCatalogFixture?: ReturnType<typeof createFixture>;
};
export async function catalogFixture() {
  if (
    process.env.E2E_TEST_MODE !== "1" ||
    (await headers()).get("x-e2e-test") !== "authoritative-catalog"
  )
    notFound();
  return (fixtureGlobal.authoritativeCatalogFixture ??= createFixture());
}
