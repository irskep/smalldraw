import { createSmalldraw } from "@smalldraw/core";
import {
  createSmalldrawVanillaUI,
  type SmalldrawVanillaUI,
} from "@smalldraw/ui-vanillajs";

async function main(
  previousUI?: SmalldrawVanillaUI,
): Promise<SmalldrawVanillaUI | undefined> {
  previousUI?.destroy();

  const container = document.getElementById("app");
  if (!container) {
    console.error("Missing #app container");
    return undefined;
  }

  const core = await createSmalldraw({
    persistence: { storageKey: "smalldraw-demo-doc-url", mode: "reuse" },
    debug: true,
  });

  const ui = createSmalldrawVanillaUI({
    core,
    container,
    width: 960,
    height: 600,
    backgroundColor: "#ffffff",
  });

  (window as unknown as { smalldrawApp?: SmalldrawVanillaUI }).smalldrawApp =
    ui;

  document.getElementById("reset")?.addEventListener("click", async () => {
    await ui.reset();
  });

  return ui;
}

if (import.meta.hot) {
  main(import.meta.hot.data.ui as SmalldrawVanillaUI | undefined).then((ui) => {
    import.meta.hot.data.ui = ui;
  });
  import.meta.hot.accept();
} else {
  main();
}
