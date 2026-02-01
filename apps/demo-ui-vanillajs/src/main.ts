import type { DrawingApp } from "@smalldraw/ui-vanillajs";
import {
  initializeBase64Wasm,
  isWasmInitialized,
} from "@automerge/automerge/slim";
import { automergeWasmBase64 } from "@automerge/automerge/automerge.wasm.base64.js";

const container = document.getElementById("app");
if (!container) {
  throw new Error("Missing #app container");
}

let app: DrawingApp | null = null;

async function mount() {
  if (!container) return;
  if (!isWasmInitialized()) {
    await initializeBase64Wasm(automergeWasmBase64);
  }
  const { DrawingApp } = await import("@smalldraw/ui-vanillajs");
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
  void mount();
});

void mount();

import.meta.hot.accept();
