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
    expect(migration).toContain('"private"."is_active_admin"()');
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
    expect(deletePolicy).toContain('"private"."is_active_admin"()');
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
});
