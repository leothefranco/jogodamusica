import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";
import { getServerEnv } from "@/lib/env-runtime";

type SqlClient = ReturnType<typeof postgres>;
type Database = ReturnType<typeof drizzle<typeof schema>>;

const globalForDatabase = globalThis as typeof globalThis & {
  jogoDaMusicaSqlClient?: SqlClient;
  jogoDaMusicaDatabase?: Database;
};

export function getDatabase(): Database {
  if (globalForDatabase.jogoDaMusicaDatabase) {
    return globalForDatabase.jogoDaMusicaDatabase;
  }

  const client =
    globalForDatabase.jogoDaMusicaSqlClient ??
    postgres(getServerEnv().DATABASE_URL, {
      max: 1,
      prepare: false,
      idle_timeout: 20,
      connect_timeout: 10,
    });

  const database = drizzle(client, { schema });

  globalForDatabase.jogoDaMusicaSqlClient = client;
  globalForDatabase.jogoDaMusicaDatabase = database;

  return database;
}

export async function closeDatabaseConnection() {
  if (globalForDatabase.jogoDaMusicaSqlClient) {
    await globalForDatabase.jogoDaMusicaSqlClient.end({ timeout: 5 });
    delete globalForDatabase.jogoDaMusicaSqlClient;
    delete globalForDatabase.jogoDaMusicaDatabase;
  }
}
