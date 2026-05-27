import { defineConfig } from "@playwright/test";

const managedPort = process.env.PLAYWRIGHT_PORT ?? "43122";
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${managedPort}`;

export default defineConfig({
  testDir: "./tests-ui",
  use: {
    baseURL,
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `bun ./harness/index.html --watch --host=0.0.0.0:${managedPort}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
      },
});
