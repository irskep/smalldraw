import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests-ui",
  use: {
    baseURL: "http://127.0.0.1:3002",
  },
  webServer: {
    command: "bun run dev",
    url: "http://127.0.0.1:3002",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
