import { createSmalldrawApp, type SmalldrawApp } from "@smalldraw/ui-vanillajs";

async function main(
  previousApp?: SmalldrawApp,
): Promise<SmalldrawApp | undefined> {
  previousApp?.destroy();

  const container = document.getElementById("app");
  if (!container) {
    console.error("Missing #app container");
    return undefined;
  }

  const app = await createSmalldrawApp({
    container,
    width: 960,
    height: 600,
    backgroundColor: "#ffffff",
    persistence: {
      storageKey: "smalldraw-demo-doc-url",
      mode: "reuse",
    },
    debug: true,
  });

  (window as unknown as { smalldrawApp?: SmalldrawApp }).smalldrawApp = app;

  document.getElementById("reset")?.addEventListener("click", async () => {
    await app.reset();
  });

  return app;
}

if (import.meta.hot) {
  main(import.meta.hot.data.app as SmalldrawApp | undefined).then((app) => {
    import.meta.hot.data.app = app;
  });
  import.meta.hot.accept();
} else {
  main();
}
