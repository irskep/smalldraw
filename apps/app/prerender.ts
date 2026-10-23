import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { createServer, type Plugin, type ViteDevServer } from "vite";

export function prerenderColoringBook(build: boolean): Plugin {
  let server: ViteDevServer;
  let root: string;
  let outDir: string;
  let base: string;
  async function render(html: string, origin: string, pathname: string) {
    const { renderColoringBook, coloringBookPaths } =
      await server.ssrLoadModule("/src/prerender.tsx");
    if (!coloringBookPaths.includes(pathname)) return html;
    return html.replace(
      '<div id="root"></div>',
      `<div id="root">${renderColoringBook(origin, pathname)}</div>`,
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
        const pathname = (context.originalUrl ?? context.path)
          .split("?")[0]
          .replace(/\/$/, "");
        if (
          build ||
          !(
            pathname === `${base}coloringbook` ||
            pathname.startsWith(`${base}coloringbook/`)
          )
        )
          return html;
        return render(
          html,
          server.resolvedUrls?.local[0] ??
            `http://localhost:${server.config.server.port ?? 3000}`,
          `/${pathname.slice(base.length)}`,
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
        const { coloringBookPaths } =
          await server.ssrLoadModule("/src/prerender.tsx");
        for (const pathname of coloringBookPaths as string[]) {
          const rendered = await render(
            html,
            new URL(server.config.env.VITE_API_URL).origin,
            pathname,
          );
          await writeFile(
            path.join(outDir, `${pathname.slice(1).replaceAll("/", "-")}.html`),
            rendered,
          );
        }
      } finally {
        await server.close();
      }
    },
  };
}
