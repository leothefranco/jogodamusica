import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it } from "vitest";

const journal = JSON.parse(
  readFileSync("drizzle/meta/_journal.json", "utf8"),
) as {
  entries: { idx: number; tag: string }[];
};
let database: PGlite | undefined;

async function legacyDatabase() {
  database = new PGlite();
  await database.exec("create role anon; create role authenticated;");
  for (const entry of journal.entries.filter(({ idx }) => idx <= 6)) {
    await database.exec(readFileSync(`drizzle/${entry.tag}.sql`, "utf8"));
  }
  return database;
}

async function applyEditorialMigration(client: PGlite) {
  const entry = journal.entries.find(({ idx }) => idx === 11);
  expect(entry, "migration CAT-04 gerada na sequência da base").toBeDefined();
  await client.exec(readFileSync(`drizzle/${entry!.tag}.sql`, "utf8"));
}

afterEach(async () => {
  await database?.close();
});

describe(
  "migration editorial do Tema em PostgreSQL",
  { timeout: 30_000 },
  () => {
    it("mantém inserts/updates legados e dual-write atual coerentes no schema expandido", async () => {
      const client = await legacyDatabase();
      await applyEditorialMigration(client);
      await client.exec(
        `insert into themes (name, slug, is_active) values ('QA', 'qa', true);`,
      );
      expect(
        (await client.query("select is_active, editorial_state from themes"))
          .rows,
      ).toEqual([{ is_active: true, editorial_state: "published" }]);
      await client.exec("update themes set is_active = false");
      expect(
        (await client.query("select is_active, editorial_state from themes"))
          .rows,
      ).toEqual([{ is_active: false, editorial_state: "draft" }]);
      await client.exec(
        "update themes set editorial_state = 'published', is_active = true",
      );
      expect(
        (await client.query("select is_active, editorial_state from themes"))
          .rows,
      ).toEqual([{ is_active: true, editorial_state: "published" }]);
      await client.exec("update themes set editorial_state = 'draft'");
      expect(
        (await client.query("select is_active, editorial_state from themes"))
          .rows,
      ).toEqual([{ is_active: false, editorial_state: "draft" }]);
      await client.exec(
        "insert into themes (name, slug) values ('QA default', 'qa-default')",
      );
      expect(
        (
          await client.query(
            "select editorial_state from themes where slug = 'qa-default'",
          )
        ).rows,
      ).toEqual([{ editorial_state: "draft" }]);
    });

    it("rejeita estado inválido, nulo e par explicitamente inconsistente sem abrir privilégios", async () => {
      const client = await legacyDatabase();
      await applyEditorialMigration(client);
      await client.exec(
        "insert into themes (name, slug, is_active, editorial_state) values ('QA', 'qa', false, 'draft')",
      );
      await expect(
        client.exec("update themes set editorial_state = 'invalid'"),
      ).rejects.toMatchObject({ code: "22P02" });
      await expect(
        client.exec("update themes set editorial_state = null"),
      ).rejects.toMatchObject({ code: "23502" });
      await expect(
        client.exec(
          "insert into themes (name, slug, is_active, editorial_state) values ('QA bad', 'qa-bad', true, 'draft')",
        ),
      ).rejects.toMatchObject({ code: "23514" });
      expect(
        (
          await client.query(
            `select relrowsecurity as rls from pg_class where oid = 'public.themes'::regclass`,
          )
        ).rows,
      ).toEqual([{ rls: true }]);
      for (const role of ["anon", "authenticated"]) {
        expect(
          (
            await client.query(
              `select has_table_privilege($1, 'public.themes', 'SELECT') as can_read, has_table_privilege($1, 'public.themes', 'UPDATE') as can_write, has_function_privilege($1, 'public.sync_theme_editorial_state()', 'EXECUTE') as can_execute`,
              [role],
            )
          ).rows,
        ).toEqual([{ can_read: false, can_write: false, can_execute: false }]);
      }
    });

    it("faz backfill sem modificar os campos legados dos Temas existentes", async () => {
      const client = await legacyDatabase();
      await client.exec(`insert into themes (name, slug, is_active) values
      ('QA draft', 'qa-draft', false), ('QA published', 'qa-published', true);`);
      const before = await client.query(
        "select id, name, slug, is_active, created_at, updated_at from themes order by slug",
      );

      await applyEditorialMigration(client);

      expect(
        await client.query(
          "select id, name, slug, is_active, created_at, updated_at from themes order by slug",
        ),
      ).toEqual(before);
      expect(
        (
          await client.query(
            "select is_active, editorial_state from themes order by slug",
          )
        ).rows,
      ).toEqual([
        { is_active: false, editorial_state: "draft" },
        { is_active: true, editorial_state: "published" },
      ]);
    });
  },
);
