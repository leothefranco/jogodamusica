import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import * as schema from "@/db/schema";
import {
  recalculateThemeProjectionUsing,
  captureProjectionContext,
} from "@/server/repositories/theme-projection-repository";
import { withThemeContentLock } from "@/server/repositories/theme-content-repository";
import { createGameSession } from "@/server/services/game-service";
const boundary = vi.hoisted(() => ({ database: vi.fn() }));
vi.mock("@/db", () => ({ getDatabase: boundary.database }));
const enabled = Boolean(process.env.CAT07_POSTGRES_ADMIN_URL);
const databaseName = `cat07_qa_${randomUUID().replaceAll("-", "")}`;
const themeId = "10000000-0000-4000-8000-000000000071";
const songId = (i: number) =>
  `20000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
const now = new Date();
let admin: ReturnType<typeof postgres>,
  connection: ReturnType<typeof postgres>,
  peer: ReturnType<typeof postgres>;
let database: ReturnType<typeof drizzle<typeof schema>>,
  other: ReturnType<typeof drizzle<typeof schema>>;
function gate() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
async function recalculate() {
  return database.transaction((tx) =>
    recalculateThemeProjectionUsing(tx, themeId, captureProjectionContext(now)),
  );
}

describe.skipIf(!enabled)("CAT-07 PostgreSQL real descartável", () => {
  beforeAll(async () => {
    const url = new URL(process.env.CAT07_POSTGRES_ADMIN_URL!);
    if (
      process.env.CAT07_QA_DISPOSABLE !== "1" ||
      url.hostname !== "127.0.0.1" ||
      url.port !== "55449" ||
      url.username !== "cat07qa" ||
      url.pathname !== "/postgres"
    )
      throw new Error("Refusing non-owned QA instance");
    admin = postgres(url.toString(), { max: 1, onnotice: () => {} });
    const [identity] =
      await admin`select current_setting('data_directory') as data, current_setting('listen_addresses') as listen, version() as version`;
    expect(identity.data).toBe(
      "C:/Users/LEOFR/AppData/Local/Temp/cat07-pg-20261007/data",
    );
    expect(identity.listen).toBe("127.0.0.1");
    expect(identity.version).toContain("PostgreSQL 17.11");
    await admin.unsafe(`create database "${databaseName}"`);
    url.pathname = `/${databaseName}`;
    connection = postgres(url.toString(), { max: 3, onnotice: () => {} });
    peer = postgres(url.toString(), { max: 1, onnotice: () => {} });
    await connection.unsafe(
      "create role anon; create role authenticated; create role cat07_reader nologin nobypassrls; create role cat07_backend login nosuperuser nocreatedb nocreaterole bypassrls",
    );
    const journal = JSON.parse(
      readFileSync("drizzle/meta/_journal.json", "utf8"),
    ) as { entries: { idx: number; tag: string }[] };
    for (const entry of journal.entries.filter(
      ({ idx }) => idx <= 6 || idx >= 10,
    ))
      await connection.unsafe(readFileSync(`drizzle/${entry.tag}.sql`, "utf8"));
    database = drizzle(connection, { schema });
    other = drizzle(peer, { schema });
  });
  afterAll(async () => {
    vi.unstubAllEnvs();
    await connection?.end();
    await peer?.end();
    if (admin) {
      if (!/^cat07_qa_[a-f0-9]{32}$/.test(databaseName))
        throw new Error("Cleanup namespace mismatch");
      await admin.unsafe(`drop database if exists "${databaseName}"`);
      await admin.unsafe(
        "drop role if exists cat07_reader, cat07_backend, anon, authenticated",
      );
      const left =
        await admin`select datname from pg_database where datname like 'cat07_qa_%'`;
      expect(left).toEqual([]);
      await admin.end();
    }
  });
  beforeEach(async () => {
    boundary.database.mockReset().mockReturnValue(database);
    vi.stubEnv("THEME_PROJECTION_WRITE_MODE", "enabled");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("PUBLIC_CATALOG_READ_MODE", "authoritative_direct");
    await connection.unsafe("truncate themes, songs cascade");
    await database
      .insert(schema.themes)
      .values({
        id: themeId,
        name: "QA",
        slug: "qa-projection",
        editorialState: "published",
        isActive: true,
      });
    await database
      .insert(schema.songs)
      .values(
        Array.from({ length: 4 }, (_, i) => ({
          id: songId(i),
          provider: "youtube" as const,
          providerContentId: `qa-${i}`,
          sourceTitle: "QA",
          sourceChannel: "QA",
          thumbnailUrl: `/qa-${i}.jpg`,
          durationSeconds: 180,
          isEmbeddable: false,
        })),
      );
    await database
      .insert(schema.themeSongs)
      .values(
        Array.from({ length: 4 }, (_, i) => ({
          themeId,
          songId: songId(i),
          title: "QA",
          artist: "QA",
          previewDurationSeconds: 30,
          isActive: true,
        })),
      );
    await database
      .insert(schema.sourceAvailabilityObservations)
      .values(
        Array.from({ length: 4 }, (_, i) => ({
          songId: songId(i),
          region: "BR",
          confirmedState: "available" as const,
          confirmationReason: "available" as const,
          observedAt: now,
          lastAttemptAt: now,
          lastConfirmedAt: now,
          validUntil: new Date(now.getTime() + 7 * 86400000),
          graceUntil: new Date(now.getTime() + 8 * 86400000),
          nextCheckAt: new Date(now.getTime() + 7 * 86400000),
          revision: 1,
          policyVersion: 1,
        })),
      );
  });

  it("migration tem FK/PK, constraints e os índices de visibilidade/admin", async () => {
    await recalculate();
    const indexes =
      await connection`select indexname, indexdef from pg_indexes where tablename = 'theme_state_projections' order by indexname`;
    expect(indexes.map((row) => row.indexname)).toEqual([
      "theme_projection_operational_idx",
      "theme_projection_visibility_idx",
      "theme_state_projections_pkey",
    ]);
    for (const clause of [
      "available_fresh=-1",
      "playable_count=99",
      "visibility='unsafe'",
      "supported_modes=array[3]",
      "operational_state='unsafe'",
      "policy_version=0",
    ])
      await expect(
        connection.unsafe(`update theme_state_projections set ${clause}`),
      ).rejects.toMatchObject({ code: "23514" });
    await expect(
      connection`update theme_state_projections set theme_id = '10000000-0000-4000-8000-000000000099'`,
    ).rejects.toMatchObject({ code: "23503" });
    await expect(
      connection`insert into theme_state_projections select * from theme_state_projections`,
    ).rejects.toMatchObject({ code: "23505" });
    await connection`set enable_seqscan = off`;
    try {
      const visible =
        await connection`explain select theme_id from theme_state_projections where visibility = 'visible' order by theme_id`;
      const operational =
        await connection`explain select theme_id from theme_state_projections where operational_state = 'healthy' order by theme_id`;
      expect(JSON.stringify(visible)).toContain(
        "theme_projection_visibility_idx",
      );
      expect(JSON.stringify(operational)).toContain(
        "theme_projection_operational_idx",
      );
    } finally {
      await connection`set enable_seqscan = on`;
    }
  });
  it("anon/authenticated sem grants; papel com grant e sem BYPASS continua bloqueado pela RLS", async () => {
    await recalculate();
    const [table] =
      await connection`select relrowsecurity as rls, relforcerowsecurity as forced from pg_class where oid = 'theme_state_projections'::regclass`;
    expect(table).toEqual({ rls: true, forced: true });
    expect(
      await connection`select policyname from pg_policies where tablename = 'theme_state_projections'`,
    ).toEqual([]);
    for (const role of ["anon", "authenticated"]) {
      const [grant] =
        await connection`select has_table_privilege(${role}, 'theme_state_projections', 'SELECT') as read, has_table_privilege(${role}, 'theme_state_projections', 'INSERT') as write`;
      expect(grant).toEqual({ read: false, write: false });
      await expect(
        connection.begin(async (tx) => {
          await tx.unsafe(`set local role ${role}`);
          await tx`select * from theme_state_projections`;
        }),
      ).rejects.toMatchObject({ code: "42501" });
    }
    await connection`grant select, insert on theme_state_projections to cat07_reader`;
    await connection.begin(async (tx) => {
      await tx`set local role cat07_reader`;
      expect(await tx`select * from theme_state_projections`).toEqual([]);
    });
    const [record] = await connection`select * from theme_state_projections`;
    await expect(
      connection.begin(async (tx) => {
        await tx`set local role cat07_reader`;
        await tx`insert into theme_state_projections ${tx(record)}`;
      }),
    ).rejects.toMatchObject({ code: "42501" });
    await connection`revoke all on theme_state_projections from cat07_reader`;
  });
  it("upserts concorrentes serializam no Tema: created seguido de unchanged, uma linha", async () => {
    const reached = gate(),
      release = gate();
    const first = database.transaction(async (tx) => {
      const result = await recalculateThemeProjectionUsing(
        tx,
        themeId,
        captureProjectionContext(now),
      );
      reached.resolve();
      await release.promise;
      return result;
    });
    await reached.promise;
    const second = other.transaction((tx) =>
      recalculateThemeProjectionUsing(
        tx,
        themeId,
        captureProjectionContext(now),
      ),
    );
    try {
      const deadline = Date.now() + 1500;
      let observed = false;
      while (Date.now() < deadline) {
        const waiting =
          await connection`select pid from pg_stat_activity where datname = ${databaseName} and wait_event_type='Lock'`;
        if (waiting.length > 0) {
          observed = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 10));
      }
      expect(observed).toBe(true);
    } finally {
      release.resolve();
    }
    expect((await first).status).toBe("created");
    expect((await second).status).toBe("unchanged");
    expect(
      await connection`select count(*)::int as rows from theme_state_projections`,
    ).toEqual([{ rows: 1 }]);
  });
  it("falha no projetor faz rollback da retirada na mesma transação real", async () => {
    await recalculate();
    const before = await connection`select * from theme_state_projections`;
    await connection`alter table theme_state_projections add constraint qa_reject_three check (playable_count<>3) not valid`;
    try {
      await expect(
        withThemeContentLock(themeId, (repo) =>
          repo.removeThemeSongRecord(songId(0)),
        ),
      ).rejects.toThrow();
      expect(await connection`select * from theme_state_projections`).toEqual(
        before,
      );
      expect(
        await connection`select count(*)::int as rows from theme_songs`,
      ).toEqual([{ rows: 4 }]);
    } finally {
      await connection`alter table theme_state_projections drop constraint qa_reject_three`;
    }
  });
  it("CAT-06 recusa drift coerente de 64 na projeção quando há apenas 3 candidatas reais", async () => {
    await recalculate();
    await connection`update theme_state_projections set available_fresh=64, playable_count=64, potential_count=64, active_entry_count=64, supported_modes=array[4,8,16,32,64]`;
    await connection`update source_availability_observations set confirmed_state='unavailable', confirmation_reason='not_found', valid_until=null, grace_until=null where song_id=${songId(0)}::uuid`;
    await expect(
      createGameSession({ themeId, bracketSize: 4 }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_ACTIVE_SONGS", status: 409 });
    expect(
      await connection`select (select count(*)::int from game_sessions) sessions, (select count(*)::int from session_songs) snapshots, (select count(*)::int from game_matches) matches`,
    ).toEqual([{ sessions: 0, snapshots: 0, matches: 0 }]);
  });
});
