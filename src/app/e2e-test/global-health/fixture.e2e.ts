import "server-only";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { sql } from "drizzle-orm";
import { getDatabase } from "@/db";
import { createSourceAvailabilityService } from "@/server/services/source-availability-service";
import { drainCatalogInvalidations } from "@/server/services/catalog-invalidation-service";
import { assertCatalogHealthWriteAllowed } from "@/server/repositories/catalog-health-mode";
import {
  findSourceAvailabilityByProviderContentId,
  persistSourceAvailabilityObservation,
} from "@/server/repositories/source-availability-repository";
import { createAuthoritativePublicThemeRepository } from "@/server/repositories/authoritative-public-theme-repository";
import { SOURCE_AVAILABILITY_POLICY } from "@/domain/music/source-availability";
import { classifyThemeState } from "@/domain/music/theme-state";

export const httpThemeIds = [
  "10000000-0000-4000-8000-000000000081",
  "10000000-0000-4000-8000-000000000082",
];
const sourceReference = "cat08video0";
let providerCalls = 0;

export async function assertOwnHttpFixture() {
  if (
    process.env.E2E_TEST_MODE !== "1" ||
    process.env.CAT08_QA_DISPOSABLE !== "1" ||
    (await headers()).get("x-e2e-test") !== "cat08-global-health"
  )
    notFound();
  const configured = process.env.DATABASE_URL;
  if (!configured) notFound();
  const url = new URL(configured);
  if (
    url.protocol !== "postgresql:" ||
    url.hostname !== "127.0.0.1" ||
    url.port !== "55459" ||
    url.username !== "cat08_http_backend" ||
    url.password !== "" ||
    url.search !== "" ||
    !/^\/cat08_http_[a-f0-9]{32}$/.test(url.pathname)
  )
    notFound();
  const rows = await getDatabase().execute<{
    data: string;
    listen: string;
    version: number;
    super: boolean;
    bypass: boolean;
  }>(sql`
    select current_setting('data_directory') as data,
           current_setting('listen_addresses') as listen,
           current_setting('server_version_num')::int as version,
           (select rolsuper from pg_roles where rolname=current_user) as super,
           (select rolbypassrls from pg_roles where rolname=current_user) as bypass
  `);
  const identity = rows[0];
  if (
    identity?.data !==
      "C:/Users/LEOFR/AppData/Local/Temp/cat08-pg-alias-20261011/data" ||
    identity.listen !== "127.0.0.1" ||
    identity.version !== 170011 ||
    identity.super !== false ||
    identity.bypass !== true
  )
    notFound();
  return getDatabase();
}

export async function changeHttpSource(available: boolean) {
  const database = await assertOwnHttpFixture();
  if (typeof available !== "boolean") notFound();
  const source = await findSourceAvailabilityByProviderContentId(
    sourceReference,
    "BR",
  );
  if (!source?.track || source.track.providerContentId !== sourceReference)
    notFound();
  const track = source.track;
  const service = createSourceAvailabilityService({
    afterCommit: drainCatalogInvalidations,
    assertWriteAllowed: () => assertCatalogHealthWriteAllowed(database),
    clock: () => new Date(),
    findSource: findSourceAvailabilityByProviderContentId,
    persistObservation: persistSourceAvailabilityObservation,
    metrics: { record() {} },
    provider: {
      async observe(reference, region) {
        if (reference !== sourceReference || region !== "BR") notFound();
        providerCalls += 1;
        return available
          ? { type: "available", reason: "available", track }
          : { type: "unavailable", reason: "not_found", track: null };
      },
    },
  });
  await service.observeSource(sourceReference, { themeId: httpThemeIds[0] });
}

export async function httpFixtureState() {
  const database = await assertOwnHttpFixture();
  const rows = await createAuthoritativePublicThemeRepository(
    database,
  ).queryThemes({
    themeIds: httpThemeIds,
    now: new Date(),
    policy: SOURCE_AVAILABILITY_POLICY,
  });
  const projections = await database.execute<{
    id: string;
    editorial: string;
    visibility: string;
    operational: string;
    playable: number;
  }>(sql`select theme_id as id, editorial_state as editorial, visibility,
    operational_state as operational, playable_count as playable
    from public.theme_state_projections
    where theme_id in (${httpThemeIds[0]}::uuid, ${httpThemeIds[1]}::uuid)`);
  const [delivery] = await database.execute<{
    total: number;
    pending: number;
  }>(sql`
    select count(*)::int as total,
           count(*) filter (where processed_at is null)::int as pending
    from public.catalog_invalidation_outbox
  `);
  return {
    providerCalls,
    themes: rows.map((row) => ({ id: row.id, ...classifyThemeState(row) })),
    delivery,
    projections,
  };
}
