import { defineConfig } from "vitest/config";
import base from "../../vitest.config";
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ["tests/qa/cat06-postgres.test.ts"],
    fileParallelism: false,
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
