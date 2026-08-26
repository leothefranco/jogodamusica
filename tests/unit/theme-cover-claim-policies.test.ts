import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "drizzle/0009_theme_cover_claim_lifecycle.sql",
);
const snapshotPath = join(process.cwd(), "drizzle/meta/0009_snapshot.json");

function normalizedFile(path: string) {
  return readFileSync(path, "utf8").toLowerCase().replace(/\s+/g, " ");
}

function statementContaining(migration: string, marker: string) {
  const statement = migration
    .split("--> statement-breakpoint")
    .find((candidate) => candidate.includes(marker));
  expect(statement, `statement contendo ${marker}`).toBeDefined();
  return statement!;
}

function evaluateOwnClaimPolicy(
  statement: string,
  context: {
    authenticated: boolean;
    activeAdmin: boolean;
    ownBucket: boolean;
    ownOwner: boolean;
    ownPrefix: boolean;
  },
) {
  expect(statement).toContain("to authenticated");
  expect(statement).toContain('(select "private"."is_active_admin"())');
  expect(statement).toContain('"owner_id" = (select "auth"."uid"())');
  expect(statement).toContain("\"bucket\" = 'theme-covers'");
  expect(statement).toContain(
    'split_part("object_key", \'/\', 1) = (select "auth"."uid"())::text',
  );

  return (
    context.authenticated &&
    context.activeAdmin &&
    context.ownBucket &&
    context.ownOwner &&
    context.ownPrefix
  );
}

describe("estado durável da capa de Tema", () => {
  it("é uma migration aditiva e mantém themes.cover_url compatível", () => {
    expect(existsSync(migrationPath)).toBe(true);
    expect(existsSync(snapshotPath)).toBe(true);

    const migration = normalizedFile(migrationPath);
    const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8")) as {
      tables: Record<string, { columns: Record<string, { type: string }> }>;
    };

    expect(migration).toContain('create table "theme_cover_claims"');
    expect(migration).not.toMatch(/alter table "public"\."themes"/);
    expect(migration).not.toMatch(/drop (?:table|column)/);
    expect(snapshot.tables["public.themes"].columns.cover_url.type).toBe(
      "text",
    );
    expect(snapshot.tables["public.theme_cover_claims"]).toBeDefined();
  });

  it("restringe identidade, estados, epoch e vínculos da claim", () => {
    const migration = normalizedFile(migrationPath);

    expect(migration).toContain(
      'primary key("bucket","object_key","owner_id")',
    );
    expect(migration).toContain("theme_cover_claims_epoch_check");
    expect(migration).toContain("theme_cover_claims_status_check");
    expect(migration).toContain("theme_cover_claims_payload_hash_check");
    expect(migration).toContain("theme_cover_claims_object_key_check");
    expect(migration).toContain("on delete cascade");
    expect(migration).toContain(
      `constraint "theme_cover_claims_theme_check" check (("theme_cover_claims"."status" = 'consumed' and "theme_cover_claims"."theme_id" is not null) or ("theme_cover_claims"."status" <> 'consumed' and "theme_cover_claims"."theme_id" is null))`,
    );
    expect(migration).toContain(
      'create index "theme_cover_claims_owner_bucket_idx"',
    );
  });

  it("expõe somente SELECT das claims próprias a admins ativos", () => {
    const migration = normalizedFile(migrationPath);

    expect(migration).toContain(
      'alter table "public"."theme_cover_claims" enable row level security',
    );
    expect(migration).toContain(
      'revoke all on table "public"."theme_cover_claims" from anon, authenticated',
    );
    expect(migration).toContain(
      'grant select on table "public"."theme_cover_claims" to authenticated',
    );
    expect(migration).not.toMatch(
      /grant (?:insert|update|delete|all).*theme_cover_claims.*authenticated/,
    );
    expect(migration).toContain(
      'create policy "active admins can inspect own theme cover claims"',
    );
    expect(migration).toContain('(select "private"."is_active_admin"())');
    expect(migration).toContain('"owner_id" = (select "auth"."uid"())');
    expect(migration).toContain("\"bucket\" = 'theme-covers'");
    expect(migration).toContain(
      'split_part("object_key", \'/\', 1) = (select "auth"."uid"())::text',
    );
  });

  it("bloqueia DELETE no Storage enquanto a claim está claimed ou consumed", () => {
    const migration = normalizedFile(migrationPath);
    const deletePolicy = migration
      .split("--> statement-breakpoint")
      .find((statement) =>
        statement.includes(
          'create policy "active admins can delete theme covers"',
        ),
      );

    expect(deletePolicy).toBeDefined();
    expect(deletePolicy).toContain("\"bucket_id\" = 'theme-covers'");
    expect(deletePolicy).toContain('(select "private"."is_active_admin"())');
    expect(deletePolicy).toContain(
      '("storage"."foldername"("name"))[1] = (select "auth"."uid"())::text',
    );
    expect(deletePolicy).toContain(
      '"owner_id" = (select "auth"."uid"())::text',
    );
    expect(deletePolicy).toContain(
      'not exists ( select 1 from "public"."theme_cover_claims"',
    );
    expect(deletePolicy).toContain(
      "\"claim\".\"status\" in ('claimed', 'consumed')",
    );
    expect(deletePolicy).toContain(
      '"claim"."owner_id" = (select "auth"."uid"())',
    );
  });

  it("usa initplan nas duas policies sem chamada direta por linha", () => {
    const migration = normalizedFile(migrationPath);
    const initplanCall = '(select "private"."is_active_admin"())';

    expect(
      migration.match(/\(select "private"\."is_active_admin"\(\)\)/g),
    ).toHaveLength(2);
    expect(migration.replaceAll(initplanCall, "")).not.toContain(
      '"private"."is_active_admin"()',
    );
  });

  it.each([
    ["admin ativo na própria claim", true, true, true, true, true, true],
    ["usuário não autenticado", false, true, true, true, true, false],
    ["admin inativo", true, false, true, true, true, false],
    ["bucket alheio", true, true, false, true, true, false],
    ["owner alheio", true, true, true, false, true, false],
    ["prefixo alheio", true, true, true, true, false, false],
  ] as const)(
    "a policy RLS de SELECT decide %s",
    (
      _scenario,
      authenticated,
      activeAdmin,
      ownBucket,
      ownOwner,
      ownPrefix,
      allowed,
    ) => {
      const migration = normalizedFile(migrationPath);
      const policy = statementContaining(
        migration,
        'create policy "active admins can inspect own theme cover claims"',
      );

      expect(
        evaluateOwnClaimPolicy(policy, {
          authenticated,
          activeAdmin,
          ownBucket,
          ownOwner,
          ownPrefix,
        }),
      ).toBe(allowed);
    },
  );
});
