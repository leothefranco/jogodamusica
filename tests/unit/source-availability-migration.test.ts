import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { evaluateSourceAvailabilityMigration } from "../support/source-availability-migration-evaluator";

const migrationPath = join(
  process.cwd(),
  "drizzle/0010_source_availability_br.sql",
);
const snapshotPath = join(process.cwd(), "drizzle/meta/0010_snapshot.json");

function normalizedFile(path: string) {
  return readFileSync(path, "utf8").toLowerCase().replace(/\s+/g, " ");
}

function migrationSql() {
  return readFileSync(migrationPath, "utf8");
}

function mutateMigration(search: string, replacement: string) {
  const migration = migrationSql();
  expect(migration).toContain(search);
  return migration.replace(search, replacement);
}

function mutateMigrationOccurrence(
  search: string,
  replacement: string,
  occurrence: number,
) {
  const migration = migrationSql();
  let index = -1;
  let fromIndex = 0;
  for (let current = 0; current < occurrence; current += 1) {
    index = migration.indexOf(search, fromIndex);
    expect(index).toBeGreaterThanOrEqual(0);
    fromIndex = index + search.length;
  }
  return `${migration.slice(0, index)}${replacement}${migration.slice(index + search.length)}`;
}

function appendMigrationStatement(statement: string) {
  return `${migrationSql()}\n--> statement-breakpoint\n${statement}`;
}

describe("migration da disponibilidade regional de Fonte", () => {
  it("é expansiva e mantém songs.is_embeddable e dados legados intactos", () => {
    expect(existsSync(migrationPath)).toBe(true);
    expect(existsSync(snapshotPath)).toBe(true);

    const migration = normalizedFile(migrationPath);
    const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8")) as {
      tables: Record<
        string,
        {
          columns: Record<string, { type: string }>;
          isRLSEnabled: boolean;
        }
      >;
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
    expect(
      snapshot.tables["public.source_availability_observations"].isRLSEnabled,
    ).toBe(true);
    expect(
      snapshot.tables["public.unbound_source_availability_observations"]
        .isRLSEnabled,
    ).toBe(true);
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
    expect(migration).toContain(
      'create table "unbound_source_availability_observations"',
    );
    expect(migration).toContain('"source_key_hash" varchar(64) not null');
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
    expect(migration).toContain('primary key("source_key_hash","region")');
    expect(migration).toContain("unbound_source_availability_key_hash_check");
    expect(migration).toContain(
      'create index "unbound_source_availability_region_next_check_idx"',
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
    expect(migration).toContain(
      'alter table "public"."unbound_source_availability_observations" enable row level security',
    );
    expect(migration).toContain(
      'alter table "public"."unbound_source_availability_observations" force row level security',
    );
    expect(migration).toContain(
      'revoke all on table "public"."unbound_source_availability_observations" from public, anon, authenticated',
    );
  });

  it("deriva os statements e valida constraints, identidade, FK, RLS e grants por comportamento", () => {
    const migration = migrationSql();
    const evaluation = evaluateSourceAvailabilityMigration(migration);

    expect(evaluation.statementCount).toBe(
      migration.split("--> statement-breakpoint").length,
    );
    expect(evaluation.violations).toEqual([]);
  });

  it.each([
    [
      "constraint",
      () =>
        mutateMigration(
          '"source_availability_observations"."revision" > 0',
          '"source_availability_observations"."revision" >= 0',
        ),
      "constraints:source_availability_observations",
    ],
    [
      "constraint available",
      () =>
        mutateMigration(
          'and "source_availability_observations"."grace_until" is not null',
          "",
        ),
      "constraints:source_availability_observations",
    ],
    [
      "constraint available confirmed_state",
      () =>
        mutateMigration(
          '"source_availability_observations"."confirmed_state" = \'available\'',
          "1 = 1",
        ),
      "constraints:source_availability_observations",
    ],
    [
      "constraint available com confirmation_reason NULL",
      () =>
        mutateMigrationOccurrence(
          'and "source_availability_observations"."confirmation_reason" is not null',
          "",
          1,
        ),
      "constraints:source_availability_observations",
    ],
    [
      "constraint available last_confirmed_at",
      () =>
        mutateMigration(
          'and "source_availability_observations"."last_confirmed_at" is not null',
          "",
        ),
      "constraints:source_availability_observations",
    ],
    [
      "constraint available valid_until",
      () =>
        mutateMigration(
          'and "source_availability_observations"."valid_until" is not null',
          "",
        ),
      "constraints:source_availability_observations",
    ],
    [
      "constraint available confirmação antes da validade",
      () =>
        mutateMigration(
          'and "source_availability_observations"."last_confirmed_at" <= "source_availability_observations"."valid_until"',
          "",
        ),
      "constraints:source_availability_observations",
    ],
    [
      "constraint available validade antes da grace",
      () =>
        mutateMigration(
          'and "source_availability_observations"."valid_until" <= "source_availability_observations"."grace_until"',
          "",
        ),
      "constraints:source_availability_observations",
    ],
    [
      "constraint unavailable",
      () =>
        mutateMigration(
          'and "source_availability_observations"."valid_until" is null',
          "",
        ),
      "constraints:source_availability_observations",
    ],
    [
      "constraint unavailable confirmed_state",
      () =>
        mutateMigration(
          '"source_availability_observations"."confirmed_state" = \'unavailable\'',
          "1 = 1",
        ),
      "constraints:source_availability_observations",
    ],
    [
      "constraint unavailable reason",
      () =>
        mutateMigration(
          "and \"source_availability_observations\".\"confirmation_reason\" in ('region_blocked', 'not_embeddable', 'not_found')",
          "",
        ),
      "constraints:source_availability_observations",
    ],
    [
      "constraint unavailable com confirmation_reason NULL",
      () =>
        mutateMigrationOccurrence(
          'and "source_availability_observations"."confirmation_reason" is not null',
          "",
          2,
        ),
      "constraints:source_availability_observations",
    ],
    [
      "constraint available unbound com confirmation_reason NULL",
      () =>
        mutateMigrationOccurrence(
          'and "unbound_source_availability_observations"."confirmation_reason" is not null',
          "",
          1,
        ),
      "constraints:unbound_source_availability_observations",
    ],
    [
      "constraint unavailable unbound com confirmation_reason NULL",
      () =>
        mutateMigrationOccurrence(
          'and "unbound_source_availability_observations"."confirmation_reason" is not null',
          "",
          2,
        ),
      "constraints:unbound_source_availability_observations",
    ],
    [
      "constraint unavailable last_confirmed_at",
      () =>
        mutateMigrationOccurrence(
          'and "source_availability_observations"."last_confirmed_at" is not null',
          "",
          2,
        ),
      "constraints:source_availability_observations",
    ],
    [
      "constraint unavailable grace_until",
      () =>
        mutateMigration(
          'and "source_availability_observations"."grace_until" is null',
          "",
        ),
      "constraints:source_availability_observations",
    ],
    [
      "constraint unknown",
      () =>
        mutateMigration(
          'and "source_availability_observations"."confirmation_reason" is null',
          "",
        ),
      "constraints:source_availability_observations",
    ],
    [
      "constraint unknown confirmed_state",
      () =>
        mutateMigration(
          '"source_availability_observations"."confirmed_state" = \'unknown\'',
          "1 = 1",
        ),
      "constraints:source_availability_observations",
    ],
    [
      "constraint unknown last_confirmed_at",
      () =>
        mutateMigration(
          'and "source_availability_observations"."last_confirmed_at" is null',
          "",
        ),
      "constraints:source_availability_observations",
    ],
    [
      "constraint unknown valid_until",
      () =>
        mutateMigrationOccurrence(
          'and "source_availability_observations"."valid_until" is null',
          "",
          2,
        ),
      "constraints:source_availability_observations",
    ],
    [
      "constraint unknown grace_until",
      () =>
        mutateMigrationOccurrence(
          'and "source_availability_observations"."grace_until" is null',
          "",
          2,
        ),
      "constraints:source_availability_observations",
    ],
    [
      "ordenação temporal",
      () =>
        mutateMigration(
          '"source_availability_observations"."last_confirmed_at" <= "source_availability_observations"."last_attempt_at"',
          '"source_availability_observations"."last_confirmed_at" >= "source_availability_observations"."last_attempt_at"',
        ),
      "constraints:source_availability_observations",
    ],
    [
      "unicidade",
      () =>
        mutateMigration(
          'PRIMARY KEY("song_id","region")',
          'PRIMARY KEY("song_id")',
        ),
      "uniqueness:source_availability_observations",
    ],
    [
      "unicidade com PK ampliada",
      () =>
        mutateMigration(
          'PRIMARY KEY("song_id","region")',
          'PRIMARY KEY("song_id","region","confirmed_state")',
        ),
      "uniqueness:source_availability_observations",
    ],
    [
      "unicidade unbound com PK ampliada",
      () =>
        mutateMigration(
          'PRIMARY KEY("source_key_hash","region")',
          'PRIMARY KEY("source_key_hash","region","confirmed_state")',
        ),
      "uniqueness:unbound_source_availability_observations",
    ],
    [
      "índice bound ausente",
      () =>
        mutateMigration(
          'CREATE INDEX "source_availability_region_next_check_idx" ON "source_availability_observations" USING btree ("region","next_check_at");',
          "",
        ),
      "indexes:source_availability_observations",
    ],
    [
      "índice bound duplicado com outro nome",
      () =>
        appendMigrationStatement(
          'CREATE INDEX "source_availability_region_next_check_duplicate_idx" ON "source_availability_observations" USING btree ("region","next_check_at");',
        ),
      "indexes:source_availability_observations",
    ],
    [
      "índice bound no mesmo nome de tabela em outro schema",
      () =>
        mutateMigration(
          'CREATE INDEX "source_availability_region_next_check_idx" ON "source_availability_observations" USING btree ("region","next_check_at");',
          'CREATE INDEX "source_availability_region_next_check_idx" ON "other"."source_availability_observations" USING btree ("region","next_check_at");',
        ),
      "indexes:source_availability_observations",
    ],
    [
      "índice bound na tabela unbound",
      () =>
        mutateMigration(
          'CREATE INDEX "source_availability_region_next_check_idx" ON "source_availability_observations" USING btree ("region","next_check_at");',
          'CREATE INDEX "source_availability_region_next_check_idx" ON "unbound_source_availability_observations" USING btree ("region","next_check_at");',
        ),
      "indexes:source_availability_observations",
    ],
    [
      "índice bound na tabela unbound com SQL esperado apenas em comentário",
      () =>
        mutateMigration(
          'CREATE INDEX "source_availability_region_next_check_idx" ON "source_availability_observations" USING btree ("region","next_check_at");',
          '-- CREATE INDEX "source_availability_region_next_check_idx" ON "source_availability_observations" USING btree ("region","next_check_at");\nCREATE INDEX "source_availability_region_next_check_idx" ON "unbound_source_availability_observations" USING btree ("region","next_check_at");',
        ),
      "indexes:source_availability_observations",
    ],
    [
      "índice bound com método diferente de btree",
      () =>
        mutateMigration(
          'CREATE INDEX "source_availability_region_next_check_idx" ON "source_availability_observations" USING btree ("region","next_check_at");',
          'CREATE INDEX "source_availability_region_next_check_idx" ON "source_availability_observations" USING hash ("region","next_check_at");',
        ),
      "indexes:source_availability_observations",
    ],
    [
      "índice bound com ordem de colunas invertida",
      () =>
        mutateMigration(
          'CREATE INDEX "source_availability_region_next_check_idx" ON "source_availability_observations" USING btree ("region","next_check_at");',
          'CREATE INDEX "source_availability_region_next_check_idx" ON "source_availability_observations" USING btree ("next_check_at","region");',
        ),
      "indexes:source_availability_observations",
    ],
    [
      "índice bound com coluna diferente",
      () =>
        mutateMigration(
          'CREATE INDEX "source_availability_region_next_check_idx" ON "source_availability_observations" USING btree ("region","next_check_at");',
          'CREATE INDEX "source_availability_region_next_check_idx" ON "source_availability_observations" USING btree ("region","revision");',
        ),
      "indexes:source_availability_observations",
    ],
    [
      "foreign key",
      () => mutateMigration("ON DELETE cascade", "ON DELETE no action"),
      "foreign-key:source_availability_observations",
    ],
    [
      "foreign key removida posteriormente",
      () =>
        appendMigrationStatement(
          'ALTER TABLE "public"."source_availability_observations" DROP CONSTRAINT "source_availability_observations_song_id_songs_id_fk";',
        ),
      "foreign-key:source_availability_observations",
    ],
    [
      "foreign key removida na mesma ação ALTER TABLE",
      () =>
        mutateMigration(
          "ON UPDATE no action;",
          'ON UPDATE no action, DROP CONSTRAINT "source_availability_observations_song_id_songs_id_fk";',
        ),
      "ddl:source_availability_observations",
    ],
    [
      "foreign key removida após comentário SQL",
      () =>
        appendMigrationStatement(
          '-- comentário\nALTER TABLE "public"."source_availability_observations" DROP CONSTRAINT "source_availability_observations_song_id_songs_id_fk";',
        ),
      "foreign-key:source_availability_observations",
    ],
    [
      "grant após comentário SQL aninhado",
      () =>
        appendMigrationStatement(
          "/* externo /* interno */ ainda externo */ GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;",
        ),
      "grants:source_availability_observations",
    ],
    [
      "DROP TYPE dependente",
      () =>
        appendMigrationStatement(
          'DROP TYPE "public"."source_availability_reason" CASCADE;',
        ),
      "ddl:source_availability_observations",
    ],
    [
      "DROP SCHEMA dependente",
      () => appendMigrationStatement("DROP SCHEMA public CASCADE;"),
      "ddl:source_availability_observations",
    ],
    [
      "DDL em bloco DO",
      () =>
        appendMigrationStatement(
          'DO $$ BEGIN EXECUTE \'DROP TYPE "public"."source_availability_reason" CASCADE\'; END $$;',
        ),
      "ddl:source_availability_observations",
    ],
    [
      "DDL com ALTER TABLE ONLY não modelado",
      () =>
        appendMigrationStatement(
          'ALTER TABLE ONLY "public"."source_availability_observations" DROP CONSTRAINT "source_availability_observations_song_id_songs_id_fk";',
        ),
      "ddl:source_availability_observations",
    ],
    [
      "DROP COLUMN relevante não modelado",
      () =>
        appendMigrationStatement(
          'ALTER TABLE "public"."source_availability_observations" DROP COLUMN "song_id" CASCADE;',
        ),
      "ddl:source_availability_observations",
    ],
    [
      "DROP de constraint não modelada",
      () =>
        appendMigrationStatement(
          'ALTER TABLE "public"."source_availability_observations" DROP CONSTRAINT "source_availability_observations_song_id_region_pk" CASCADE;',
        ),
      "ddl:source_availability_observations",
    ],
    [
      "RLS",
      () =>
        mutateMigration(
          'ALTER TABLE "public"."source_availability_observations" ENABLE ROW LEVEL SECURITY;',
          "SELECT 1;",
        ),
      "rls:source_availability_observations",
    ],
    [
      "RLS desabilitado posteriormente",
      () =>
        appendMigrationStatement(
          'ALTER TABLE "public"."source_availability_observations" DISABLE ROW LEVEL SECURITY;',
        ),
      "rls:source_availability_observations",
    ],
    [
      "FORCE RLS removido posteriormente",
      () =>
        appendMigrationStatement(
          'ALTER TABLE "public"."source_availability_observations" NO FORCE ROW LEVEL SECURITY;',
        ),
      "rls:source_availability_observations",
    ],
    [
      "FORCE RLS removido no mesmo chunk",
      () =>
        appendMigrationStatement(
          'ALTER TABLE "public"."source_availability_observations" FORCE ROW LEVEL SECURITY; ALTER TABLE "public"."source_availability_observations" NO FORCE ROW LEVEL SECURITY;',
        ),
      "rls:source_availability_observations",
    ],
    [
      "policy com relação não quoted",
      () =>
        appendMigrationStatement(
          "CREATE POLICY leak ON public.source_availability_observations USING (true);",
        ),
      "rls:source_availability_observations",
    ],
    [
      "grants",
      () =>
        mutateMigration(
          'REVOKE ALL ON TABLE "public"."source_availability_observations" FROM PUBLIC, anon, authenticated;',
          'GRANT SELECT ON TABLE "public"."source_availability_observations" TO PUBLIC, anon, authenticated;',
        ),
      "grants:source_availability_observations",
    ],
    [
      "grant sem palavra TABLE",
      () =>
        appendMigrationStatement(
          'GRANT SELECT ON "public"."source_availability_observations" TO PUBLIC, anon, authenticated;',
        ),
      "grants:source_availability_observations",
    ],
    [
      "grant em todas as tabelas do schema public",
      () =>
        appendMigrationStatement(
          "GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;",
        ),
      "grants:source_availability_observations",
    ],
    [
      "grant direto com WITH GRANT OPTION",
      () =>
        appendMigrationStatement(
          'GRANT SELECT ON TABLE "public"."source_availability_observations" TO anon WITH GRANT OPTION;',
        ),
      "grants:source_availability_observations",
    ],
    [
      "grant por schema com WITH GRANT OPTION",
      () =>
        appendMigrationStatement(
          "GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon WITH GRANT OPTION;",
        ),
      "grants:source_availability_observations",
    ],
    [
      "grant em todas as tabelas do schema public (unbound)",
      () =>
        appendMigrationStatement(
          "GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;",
        ),
      "grants:unbound_source_availability_observations",
    ],
  ] as const)("rejeita mutante de %s", (_case, createMutant, violation) => {
    const evaluation = evaluateSourceAvailabilityMigration(createMutant());

    expect(evaluation.violations).toContain(violation);
  });
});
