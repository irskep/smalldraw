import index from "../src/index.html";

Bun.serve({
  port: 3001,
  hostname: "0.0.0.0",
  development: { hmr: true, console: true },
  routes: {
    "/": index,
    "/index.html": index,
    "/favicon.svg": () =>
      new Response(Bun.file(new URL("../public/favicon.svg", import.meta.url))),
    "/fill-worker.js": async () => {
      const build = await Bun.build({
        entrypoints: [
          new URL(
            "../../../packages/splat/src/tools/fillWorker.ts",
            import.meta.url,
          ).pathname,
        ],
        target: "browser",
      });
      if (!build.success)
        return new Response("Worker build failed", { status: 500 });
      return new Response(build.outputs[0], {
        headers: { "Content-Type": "text/javascript" },
      });
    },
  },
});
