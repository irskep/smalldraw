import { TanStackRouterVite } from "@tanstack/router-vite-plugin";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";

export default defineConfig({
  base: process.env.VITE_BASE,
  plugins: [wasm(), react(), TanStackRouterVite()],
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
      "@": path.resolve(__dirname, "./src"),
      react: path.resolve(__dirname, "../../node_modules/react"),
      "react-dom": path.resolve(__dirname, "../../node_modules/react-dom"),
    },
    dedupe: ["react", "react-dom"],
  },

  worker: {
    format: "es",
    plugins: () => [wasm()],
  },

  build: {
    target: "esnext",
  },
});
