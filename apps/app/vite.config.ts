import preact from "@preact/preset-vite";
import path from "path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";

export default defineConfig({
  base: process.env.VITE_BASE,
  plugins: [wasm(), preact()],
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
      "@automerge/automerge/automerge.wasm": `${fileURLToPath(import.meta.resolve("@automerge/automerge/automerge.wasm"))}?url`,
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
});
