import { fileURLToPath } from "node:url";
import path from "path";

import preact from "@preact/preset-vite";
import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";

import { automergeAsset } from "../../scripts/automerge-asset.mjs";
import { landingBudget } from "../../scripts/landing-budget.mjs";

export default defineConfig(({ command }) => ({
  base: process.env.VITE_BASE,
  plugins: [
    landingBudget(),
    wasm(),
    preact(),
    {
      name: "shared-automerge-binary",
      apply: "build",
      enforce: "pre",
      resolveId(id) {
        if (
          id === "@automerge/automerge/automerge.wasm" ||
          id === "\0shared-automerge-binary"
        )
          return "\0shared-automerge-binary";
      },
      load(id) {
        if (id !== "\0shared-automerge-binary") return;
        this.emitFile({
          type: "asset",
          fileName: automergeAsset.fileName,
          source: automergeAsset.source,
        });
        return `export default ${JSON.stringify(automergeAsset.url)};`;
      },
    },
  ],
  server: {
    host: "0.0.0.0",
    port: 3000,
    proxy: {
      "/_bun": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      "^/draw(?:/|$)": {
        target: "http://localhost:3001",
        changeOrigin: true,
        rewrite: (requestPath) => requestPath.replace(/^\/draw\/?/, "/") || "/",
      },
    },
  },
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
  },

  resolve: {
    alias: {
      // Match Bun's file import: emit a URL, not an eagerly initialized WASM module.
      "@automerge/automerge/automerge.wasm":
        command === "serve"
          ? `${fileURLToPath(import.meta.resolve("@automerge/automerge/automerge.wasm"))}?url`
          : "\0shared-automerge-binary",
      "@": path.resolve(import.meta.dirname, "./src"),
    },
    dedupe: ["preact"],
  },

  worker: {
    format: "es",
    plugins: () => [wasm()],
  },

  build: {
    target: "esnext",
  },
}));
