import { createServer } from "node:net";

import { defineConfig } from "@playwright/test";

// Never accidentally test a stale server or another LocalCI checkout.
const managedPort =
  process.env.PLAYWRIGHT_PORT ??
  (await new Promise<string>((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string")
        return server.close(() => reject(new Error("Missing test port")));
      server.close((error) =>
        error ? reject(error) : resolve(String(address.port)),
      );
    });
  }));
process.env.PLAYWRIGHT_PORT = managedPort;
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
        reuseExistingServer: false,
        timeout: 30_000,
      },
});
