import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "drizzle/0010_source_availability_br.sql",
);
const snapshotPath = join(process.cwd(), "drizzle/meta/0010_snapshot.json");

function normalizedFile(path: string) {
  return readFileSync(path, "utf8").toLowerCase().replace(/\s+/g, " ");
}

describe("migration da disponibilidade regional de Fonte", () => {
  it("é expansiva e mantém songs.is_embeddable e dados legados intactos", () => {
    expect(existsSync(migrationPath)).toBe(true);
    expect(existsSync(snapshotPath)).toBe(true);

    const migration = normalizedFile(migrationPath);
    const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8")) as {
      tables: Record<string, { columns: Record<string, { type: string }> }>;
    };

    expect(migration).toContain(
      'create table "source_availability_observations"',
    );
    expect(migration).not.toMatch(
      /(?:insert|update|delete) (?:into |from )?"songs"/,
    );
    expect(migration).not.toMatch(/alter table "public"\."songs"/);
    expect(migration).not.toMatch(/drop (?:table|column)/);
    expect(snapshot.tables["public.songs"].columns.is_embeddable.type).toBe(
      "boolean",
    );
  });

  it("modela estados e códigos somente por allowlists", () => {
    const migration = normalizedFile(migrationPath);

    expect(migration).toContain(
      `create type "public"."source_availability_state" as enum('available', 'unavailable', 'unknown')`,
    );
    expect(migration).toContain(
      `create type "public"."source_availability_reason" as enum('available', 'region_blocked', 'not_embeddable', 'not_found')`,
    );
    expect(migration).toContain(
      `create type "public"."source_availability_error" as enum('transport', 'quota', 'configuration', 'invalid_response', 'provider_error')`,
    );
    expect(migration).not.toMatch(
      /provider_content_id|thumbnail_url|source_title|source_channel/,
    );
  });

  it("impõe identidade, integridade temporal, revisão e versão positivas", () => {
    const migration = normalizedFile(migrationPath);

    expect(migration).toContain('primary key("song_id","region")');
    expect(migration).toContain("source_availability_region_check");
    expect(migration).toContain("source_availability_revision_check");
    expect(migration).toContain("source_availability_policy_version_check");
    expect(migration).toContain("source_availability_attempt_order_check");
    expect(migration).toContain("source_availability_confirmation_check");
    expect(migration).toContain("source_availability_next_check_check");
    expect(migration).toContain("on delete cascade");
    expect(migration).toContain(
      'create index "source_availability_region_next_check_idx"',
    );
  });

  it("mantém a tabela fora da Data API para anon e authenticated", () => {
    const migration = normalizedFile(migrationPath);

    expect(migration).toContain(
      'alter table "public"."source_availability_observations" enable row level security',
    );
    expect(migration).toContain(
      'alter table "public"."source_availability_observations" force row level security',
    );
    expect(migration).toContain(
      'revoke all on table "public"."source_availability_observations" from public, anon, authenticated',
    );
    expect(migration).not.toMatch(/grant .*source_availability_observations/);
    expect(migration).not.toMatch(
      /create policy .*source_availability_observations/,
    );
  });
});
