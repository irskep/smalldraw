import type { Point, ToolPointerEvent } from "@smalldraw/core";

/**
 * Build a ToolPointerEvent from a native PointerEvent.
 */
export function buildToolEvent(
  event: PointerEvent,
  point: Point,
  buttonsOverride?: number,
): ToolPointerEvent {
  return {
    point,
    buttons:
      buttonsOverride ?? event.buttons ?? (event.type === "pointerup" ? 0 : 1),
    pressure: typeof event.pressure === "number" ? event.pressure : undefined,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
  };
}

/**
 * Get the pointer position relative to an overlay element.
 */
export function getPointerPoint(event: PointerEvent, overlay: HTMLElement): Point {
  const rect = overlay.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}
