import { type Box, BoxOperations, toVec2 } from "@smalldraw/geometry";
import { Vec2 } from "gl-matrix";
import {
  buildTransformMatrix,
  getGeometryLocalBounds,
} from "../model/geometryShapeUtils";
import type { AnyShape } from "../model/shape";
import type { ShapeHandlerRegistry } from "../model/shapeHandlers";
import type { HandleDescriptor } from "./types";

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
  bounds: Box,
  handle: HandleDescriptor,
  shape: AnyShape | undefined,
  registry: ShapeHandlerRegistry,
): Vec2 {
  if (shape && handle.behavior.type === "resize-axis") {
    const axis = handle.behavior.axis;
    const direction = getAxisDirection(handle);
    if (direction !== null) {
      const ops = registry.get(shape.type)?.selection;
      const axisPoint = ops?.getAxisHandlePoint?.(shape, axis, direction);
      if (axisPoint) return axisPoint;
      const localBounds = getGeometryLocalBounds(shape, registry);
      if (localBounds) {
        const localBoundsOps = new BoxOperations(localBounds);
        const half =
          axis === "x" ? localBoundsOps.width / 2 : localBoundsOps.height / 2;
        const local =
          axis === "x"
            ? new Vec2(direction * half, 0)
            : new Vec2(0, direction * half);
        const matrix = buildTransformMatrix(shape.transform);
        return Vec2.transformMat2d(new Vec2(), local, matrix) as Vec2;
      }
    }
  }
  const boundsOps = new BoxOperations(bounds);
  return new Vec2().add(toVec2(bounds.min)).add(
    boundsOps.size.mul(new Vec2(handle.position.u, handle.position.v)),
  );
}
