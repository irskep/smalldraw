import type { ToolPointerEvent } from "@smalldraw/core";
import { Vec2 } from "@smalldraw/geometry";

/**
 * Build a ToolPointerEvent from a native PointerEvent.
 */
export function buildToolEvent(
  event: PointerEvent,
  point: Vec2,
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
 * If scale is provided, converts from screen to world coordinates.
 */
export function getPointerPoint(
  event: PointerEvent,
  overlay: HTMLElement,
  scale = 1,
): Vec2 {
  const rect = overlay.getBoundingClientRect();
  return new Vec2(event.clientX, event.clientY)
    .sub([rect.left, rect.top])
    .div([scale, scale]);
}
