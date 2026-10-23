import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { createServer, type Plugin, type ViteDevServer } from "vite";

export function prerenderColoringBook(build: boolean): Plugin {
  let server: ViteDevServer;
  let root: string;
  let outDir: string;
  let base: string;
  async function render(html: string, origin: string) {
    const { renderColoringBook } =
      await server.ssrLoadModule("/src/prerender.tsx");
    return html.replace(
      '<div id="root"></div>',
      `<div id="root">${renderColoringBook(origin)}</div>`,
    );
  }
  return {
    name: "prerender-coloringbook",
    configResolved(config) {
      root = config.root;
      outDir = path.resolve(root, config.build.outDir);
      base = config.base;
    },
    configureServer(devServer) {
      server = devServer;
    },
    transformIndexHtml: {
      order: "post",
      async handler(html, context) {
        if (
          build ||
          (context.originalUrl ?? context.path)
            .split("?")[0]
            .replace(/\/$/, "") !== `${base}coloringbook`
        )
          return html;
        return render(
          html,
          server.resolvedUrls?.local[0] ??
            `http://localhost:${server.config.server.port ?? 3000}`,
        );
      },
    },
    async writeBundle() {
      if (!build) return;
      server = await createServer({
        root,
        mode: "production",
        server: { middlewareMode: true, hmr: false, ws: false, watch: null },
        optimizeDeps: { noDiscovery: true, include: [] },
        appType: "custom",
      });
      try {
        const html = await readFile(path.join(outDir, "index.html"), "utf8");
        const rendered = await render(
          html,
          new URL(server.config.env.VITE_API_URL).origin,
        );
        await writeFile(path.join(outDir, "coloringbook.html"), rendered);
      } finally {
        await server.close();
      }
    },
  };
}
