import type { Point } from "@smalldraw/geometry";
import {
  applyTransformToPoint,
  getGeometryLocalBounds,
} from "../model/geometryShapeUtils";
import type { Shape } from "../model/shape";
import type { ShapeHandlerRegistry } from "../model/shapeHandlers";
import type { Bounds, HandleDescriptor } from "./types";

function getAxisDirection(handle: HandleDescriptor): -1 | 1 | null {
  if (handle.behavior.type !== "resize-axis") return null;
  switch (handle.id) {
    case "mid-right":
    case "mid-bottom":
      return 1;
    case "mid-left":
    case "mid-top":
      return -1;
    default:
      return null;
  }
}

export function resolveSelectionHandlePoint(
  bounds: Bounds,
  handle: HandleDescriptor,
  shape: Shape | undefined,
  registry: ShapeHandlerRegistry,
): Point {
  if (shape && handle.behavior.type === "resize-axis") {
    const axis = handle.behavior.axis;
    const direction = getAxisDirection(handle);
    if (direction !== null) {
      const ops = registry.get(shape.type)?.selection;
      const axisPoint = ops?.getAxisHandlePoint?.(
        shape as Shape & { geometry: unknown },
        axis,
        direction,
      );
      if (axisPoint) return axisPoint;
      const localBounds = getGeometryLocalBounds(
        shape as Shape & { geometry: unknown },
        registry,
      );
      if (localBounds) {
        const half =
          axis === "x" ? localBounds.width / 2 : localBounds.height / 2;
        const local =
          axis === "x"
            ? { x: direction * half, y: 0 }
            : { x: 0, y: direction * half };
        return applyTransformToPoint(local, shape.transform);
      }
    }
  }
  return {
    x: bounds.minX + bounds.width * handle.position.u,
    y: bounds.minY + bounds.height * handle.position.v,
  };
}
