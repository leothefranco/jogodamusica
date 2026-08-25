import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "drizzle/0008_theme_cover_reference_policies.sql"),
  "utf8",
)
  .toLowerCase()
  .replace(/\s+/g, " ");
const snapshot = JSON.parse(
  readFileSync(join(process.cwd(), "drizzle/meta/0008_snapshot.json"), "utf8"),
) as {
  tables: Record<string, { columns: Record<string, { type: string }> }>;
};
const migrationHistory = readdirSync(join(process.cwd(), "drizzle"))
  .filter((fileName) => /^\d{4}.*\.sql$/.test(fileName))
  .toSorted()
  .flatMap((fileName) =>
    readFileSync(join(process.cwd(), "drizzle", fileName), "utf8")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .split("--> statement-breakpoint"),
  );
const normalizedMigrationHistory = migrationHistory.join(" ");

type StoragePolicy = { name: string; operation: string; statement: string };
type PolicyContext = {
  authenticated: boolean;
  activeAdmin: boolean;
  ownBucket: boolean;
  ownPrefix: boolean;
  ownObject: boolean;
};

const policyClauseEvaluators = new Map<
  string,
  (context: PolicyContext) => boolean
>([
  ["\"bucket_id\" = 'theme-covers'", ({ ownBucket }) => ownBucket],
  ['"private"."is_active_admin"()', ({ activeAdmin }) => activeAdmin],
  [
    '("storage"."foldername"("name"))[1] = (select "auth"."uid"())::text',
    ({ ownPrefix }) => ownPrefix,
  ],
  ['"owner_id" = (select "auth"."uid"())::text', ({ ownObject }) => ownObject],
]);

function evaluatePolicy(policy: StoragePolicy, context: PolicyContext) {
  if (
    !context.authenticated ||
    !policy.statement.includes("to authenticated")
  ) {
    return false;
  }

  const condition = policy.statement.match(
    /\b(?:with check|using) \((.*)\)\s*;?\s*$/,
  )?.[1];
  expect(condition, `predicado da policy ${policy.name}`).toBeDefined();

  return condition!.split(" and ").every((clause) => {
    const evaluateClause = policyClauseEvaluators.get(clause.trim());
    expect(evaluateClause, `cláusula reconhecida: ${clause}`).toBeDefined();
    return evaluateClause!(context);
  });
}

function finalStoragePolicies() {
  const policies = new Map<string, StoragePolicy>();

  for (const statement of migrationHistory) {
    const drop = statement.match(
      /drop policy if exists "([^"]+)" on "storage"\."objects"/,
    );
    if (drop) {
      policies.delete(drop[1]);
      continue;
    }

    const create = statement.match(
      /create policy "([^"]+)" on "storage"\."objects" for (insert|select|delete|update|all)/,
    );
    if (create) {
      policies.set(create[1], {
        name: create[1],
        operation: create[2],
        statement,
      });
      continue;
    }

    const alter = statement.match(
      /alter policy "([^"]+)" on "storage"\."objects"/,
    );
    if (alter) {
      const previous = policies.get(alter[1]);
      expect(previous, `policy alterada ${alter[1]}`).toBeDefined();
      policies.set(alter[1], { ...previous!, statement });
    }
  }

  return policies;
}

function statementContaining(marker: string) {
  const statement = migration
    .split("--> statement-breakpoint")
    .find((candidate) => candidate.includes(marker.toLowerCase()));
  expect(statement, `statement contendo ${marker}`).toBeDefined();
  return statement!;
}

function expectOwnAdminPrefix(statement: string) {
  expect(statement).toContain("\"bucket_id\" = 'theme-covers'");
  expect(statement).toContain('"private"."is_active_admin"()');
  expect(statement).toContain(
    '("storage"."foldername"("name"))[1] = (select "auth"."uid"())::text',
  );
}

describe("policies de capas de Tema", () => {
  it("mantém INSERT no bucket e prefixo do administrador ativo", () => {
    const insert = statementContaining(
      'alter policy "active admins can upload theme covers"',
    );
    expect(insert).toContain("with check");
    expectOwnAdminPrefix(insert);
  });

  it.each(["select", "delete"])(
    "limita %s ao bucket, prefixo e autoria do administrador ativo",
    (operation) => {
      const policy = statementContaining(`for ${operation}`);
      expectOwnAdminPrefix(policy);
      expect(policy).toContain('"owner_id" = (select "auth"."uid"())::text');
    },
  );

  it("é expansiva e mantém cover_url legível pela versão anterior", () => {
    expect(migration).not.toMatch(/alter table "public"\."themes"/);
    expect(migration).not.toMatch(/drop (?:table|column)/);
    expect(snapshot.tables["public.themes"].columns.cover_url).toEqual(
      expect.objectContaining({ type: "text" }),
    );
  });

  it("deixa somente uma policy restritiva por operação no histórico final", () => {
    const policies = finalStoragePolicies();

    expect([...policies.keys()].toSorted()).toEqual([
      "active admins can delete theme covers",
      "active admins can inspect own theme covers",
      "active admins can upload theme covers",
    ]);
    expect(
      [...policies.values()].map(({ operation }) => operation).toSorted(),
    ).toEqual(["delete", "insert", "select"]);

    for (const policy of policies.values()) {
      expect(policy.statement).toContain("to authenticated");
      expect(policy.statement).not.toMatch(/\bor\b/);
      expectOwnAdminPrefix(policy.statement);
      if (policy.operation !== "insert") {
        expect(policy.statement).toContain(
          '"owner_id" = (select "auth"."uid"())::text',
        );
      }
    }
  });

  it("mantém o helper de autorização sem privilégio público ou search_path implícito", () => {
    expect(normalizedMigrationHistory).toContain("security definer");
    expect(normalizedMigrationHistory).toContain("set search_path = ''");
    expect(normalizedMigrationHistory).toContain(
      'revoke all on function "private"."is_active_admin"() from public',
    );
    expect(normalizedMigrationHistory).toContain(
      'grant execute on function "private"."is_active_admin"() to authenticated',
    );
  });

  it.each([
    ["admin ativo no próprio prefixo", true, true, true, true, true],
    ["usuário não autenticado", false, true, true, true, false],
    ["admin inativo", true, false, true, true, false],
    ["bucket alheio", true, true, false, true, false],
    ["prefixo alheio", true, true, true, false, false],
  ])(
    "a expressão final de INSERT decide %s",
    (_scenario, authenticated, activeAdmin, ownBucket, ownPrefix, allowed) => {
      const insert = [...finalStoragePolicies().values()].find(
        ({ operation }) => operation === "insert",
      );
      expect(insert).toBeDefined();
      expect(
        evaluatePolicy(insert!, {
          authenticated,
          activeAdmin,
          ownBucket,
          ownPrefix,
          ownObject: false,
        }),
      ).toBe(allowed);
    },
  );

  it.each([
    ["dono ativo no próprio prefixo", true, true, true, true, true, true],
    ["objeto de outro dono", true, true, true, true, false, false],
    ["admin inativo", true, false, true, true, true, false],
    ["bucket alheio", true, true, false, true, true, false],
    ["prefixo alheio", true, true, true, false, true, false],
  ])(
    "as expressões finais de SELECT/DELETE decidem %s",
    (
      _scenario,
      authenticated,
      activeAdmin,
      ownBucket,
      ownPrefix,
      ownObject,
      allowed,
    ) => {
      const policies = [...finalStoragePolicies().values()].filter(
        ({ operation }) => operation === "select" || operation === "delete",
      );
      expect(policies).toHaveLength(2);
      for (const policy of policies) {
        expect(
          evaluatePolicy(policy, {
            authenticated,
            activeAdmin,
            ownBucket,
            ownPrefix,
            ownObject,
          }),
        ).toBe(allowed);
      }
    },
  );
});
