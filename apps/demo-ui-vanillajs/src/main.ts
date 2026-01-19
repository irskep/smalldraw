import {
  createVanillaDrawingApp,
  type VanillaDrawingApp,
} from "@smalldraw/ui-vanillajs";

const container = document.getElementById("app")!;
if (!container) {
  throw new Error("Missing #app container");
}

let app: VanillaDrawingApp | null = null;

function mount() {
  container.innerHTML = "";
  app = createVanillaDrawingApp({
    container,
    width: 960,
    height: 600,
    backgroundColor: "#ffffff",
  });
  (window as unknown as { smalldrawApp?: VanillaDrawingApp }).smalldrawApp =
    app;
}

const resetButton = document.getElementById("reset");
resetButton?.addEventListener("click", () => {
  app?.destroy();
  mount();
});

mount();

import.meta.hot.accept();
