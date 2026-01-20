import type { ToolEventHandler, ToolRuntime } from "./types";

interface PointerHandlersConfig {
  onPointerDown?: ToolEventHandler;
  onPointerMove?: ToolEventHandler;
  onPointerUp?: ToolEventHandler;
  onPointerCancel?: ToolEventHandler;
}

export function attachPointerHandlers(
  runtime: ToolRuntime,
  handlers: PointerHandlersConfig,
): () => void {
  const disposers: Array<() => void> = [];
  if (handlers.onPointerDown) {
    disposers.push(runtime.on("pointerDown", handlers.onPointerDown));
  }
  if (handlers.onPointerMove) {
    disposers.push(runtime.on("pointerMove", handlers.onPointerMove));
  }
  if (handlers.onPointerUp) {
    disposers.push(runtime.on("pointerUp", handlers.onPointerUp));
  }
  if (handlers.onPointerCancel) {
    disposers.push(runtime.on("pointerCancel", handlers.onPointerCancel));
  }
  return () => {
    disposers.forEach((dispose) => {
      dispose();
    });
  };
}
