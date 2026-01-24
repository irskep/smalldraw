import type { DrawingStore } from "@smalldraw/core";

/**
 * Update the overlay cursor based on current tool and handle hover.
 */
export function updateCursor(overlay: HTMLElement, store: DrawingStore): void {
  const hover = store.getHandleHover();
  if (hover.handleId) {
    overlay.style.cursor = cursorForHandle(
      hover.handleId,
      hover.behavior?.type,
    );
    return;
  }
  const active = store.getActiveToolId();
  overlay.style.cursor =
    active === "pen" || active === "rect" ? "crosshair" : "default";
}

/**
 * Get CSS cursor for a given handle.
 */
export function cursorForHandle(
  handleId: string,
  behaviorType?: string | null,
): string {
  if (behaviorType === "rotate" || handleId === "rotate") {
    return "alias";
  }
  if (behaviorType === "resize-axis") {
    switch (handleId) {
      case "mid-left":
      case "mid-right":
        return "ew-resize";
      case "mid-top":
      case "mid-bottom":
        return "ns-resize";
      default:
        return "pointer";
    }
  }
  switch (handleId) {
    case "top-left":
    case "bottom-right":
      return "nwse-resize";
    case "top-right":
    case "bottom-left":
      return "nesw-resize";
    default:
      return behaviorType === "move" ? "move" : "pointer";
  }
}
