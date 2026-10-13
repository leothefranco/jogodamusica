import { defineConfig, devices } from "playwright/test";
export default defineConfig({
  testDir: ".",
  testMatch: "cat08-http.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:3182",
    trace: "off",
  },
});
