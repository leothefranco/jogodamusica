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

type ClaimPolicyContext = {
  authenticated: boolean;
  activeAdmin: boolean;
  ownBucket: boolean;
  ownOwner: boolean;
  ownPrefix: boolean;
};

const claimClauseEvaluators = new Map<
  string,
  (context: ClaimPolicyContext) => boolean
>([
  ['(select "private"."is_active_admin"())', ({ activeAdmin }) => activeAdmin],
  ['"owner_id" = (select "auth"."uid"())', ({ ownOwner }) => ownOwner],
  ["\"bucket\" = 'theme-covers'", ({ ownBucket }) => ownBucket],
  [
    'split_part("object_key", \'/\', 1) = (select "auth"."uid"())::text',
    ({ ownPrefix }) => ownPrefix,
  ],
]);

function topLevelConjunction(expression: string) {
  const clauses: string[] = [];
  let clauseStart = 0;
  let depth = 0;
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < expression.length; index += 1) {
    const character = expression[index];
    if (quote) {
      if (character === quote) {
        if (expression[index + 1] === quote) index += 1;
        else quote = null;
      }
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "(") {
      depth += 1;
      continue;
    }
    if (character === ")") {
      depth -= 1;
      if (depth < 0) throw new Error("Predicado RLS com parênteses inválidos.");
      continue;
    }
    if (depth === 0 && expression.startsWith(" or ", index)) {
      throw new Error("Operador RLS desconhecido: OR.");
    }
    if (depth === 0 && expression.startsWith(" and ", index)) {
      clauses.push(expression.slice(clauseStart, index).trim());
      index += " and ".length - 1;
      clauseStart = index + 1;
    }
  }

  if (quote || depth !== 0) throw new Error("Predicado RLS incompleto.");
  clauses.push(expression.slice(clauseStart).trim());
  return clauses;
}

function evaluateOwnClaimPolicy(
  statement: string,
  context: ClaimPolicyContext,
) {
  const policy = statement.match(/\bto ([a-z_, ]+) using \((.*)\)\s*;?\s*$/);
  if (!policy || policy[1].trim() !== "authenticated") {
    throw new Error("Role da policy RLS desconhecida.");
  }

  const clauses = topLevelConjunction(policy[2]);
  if (clauses.length !== claimClauseEvaluators.size) {
    throw new Error("Quantidade inesperada de requisitos RLS.");
  }

  const seen = new Set<string>();
  const evaluators = clauses.map((clause) => {
    const evaluateClause = claimClauseEvaluators.get(clause);
    if (!evaluateClause || seen.has(clause)) {
      throw new Error(`Cláusula RLS desconhecida ou duplicada: ${clause}`);
    }
    seen.add(clause);
    return evaluateClause;
  });

  return (
    context.authenticated && evaluators.every((evaluate) => evaluate(context))
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

  it.each([
    [
      "role authenticated alterada",
      (statement: string) => statement.replace("to authenticated", "to anon"),
    ],
    [
      "operador OR permissivo",
      (statement: string) => statement.replace("using ( ", "using ( true or "),
    ],
    [
      "cláusula extra",
      (statement: string) => statement.replace("using ( ", "using ( true and "),
    ],
    [
      "requisito de admin removido",
      (statement: string) =>
        statement.replace('(select "private"."is_active_admin"()) and ', ""),
    ],
    [
      "requisito de owner removido",
      (statement: string) =>
        statement.replace('"owner_id" = (select "auth"."uid"()) and ', ""),
    ],
    [
      "requisito de bucket removido",
      (statement: string) =>
        statement.replace("\"bucket\" = 'theme-covers' and ", ""),
    ],
    [
      "requisito de prefixo removido",
      (statement: string) =>
        statement.replace(
          ' and split_part("object_key", \'/\', 1) = (select "auth"."uid"())::text',
          "",
        ),
    ],
    [
      "operador de owner alterado",
      (statement: string) =>
        statement.replace(
          '"owner_id" = (select "auth"."uid"())',
          '"owner_id" <> (select "auth"."uid"())',
        ),
    ],
  ] as const)("rejeita policy com %s", (_scenario, mutate) => {
    const migration = normalizedFile(migrationPath);
    const policy = statementContaining(
      migration,
      'create policy "active admins can inspect own theme cover claims"',
    );

    expect(() =>
      evaluateOwnClaimPolicy(mutate(policy), {
        authenticated: true,
        activeAdmin: true,
        ownBucket: true,
        ownOwner: true,
        ownPrefix: true,
      }),
    ).toThrow();
  });
});
