import { DrawingApp } from "@smalldraw/ui-vanillajs";

const container = document.getElementById("app");
if (!container) {
  throw new Error("Missing #app container");
}

let app: DrawingApp | null = null;

function mount() {
  if (!container) return;
  container.innerHTML = "";
  app = new DrawingApp({
    container,
    width: 960,
    height: 600,
    backgroundColor: "#ffffff",
  });
  (window as unknown as { smalldrawApp?: DrawingApp }).smalldrawApp = app;
}

const resetButton = document.getElementById("reset");
resetButton?.addEventListener("click", () => {
  app?.destroy();
  mount();
});

mount();

import.meta.hot.accept();
