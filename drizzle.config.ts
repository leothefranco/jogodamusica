import { existsSync } from "node:fs";

import { defineConfig } from "drizzle-kit";

import { serverEnvSchema } from "./src/lib/env-schema";

if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

const env = serverEnvSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
});

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
  strict: true,
  verbose: true,
});
