import {
  BoxOperations,
  type Box,
  getX,
  getY,
  toVec2Like,
} from "@smalldraw/geometry";
import { Vec2 } from "gl-matrix";
import { buildTransformMatrix } from "../geometryShapeUtils";
import { type Shape, normalizeShapeTransform } from "../shape";

export function getHitTestBounds(shape: Shape, localBounds: Box | null): Box {
  const transform = normalizeShapeTransform(shape.transform);
  const matrix = buildTransformMatrix(transform);
  const corners: Vec2[] = localBounds
    ? [
        new Vec2(getX(localBounds.min), getY(localBounds.min)),
        new Vec2(getX(localBounds.max), getY(localBounds.min)),
        new Vec2(getX(localBounds.max), getY(localBounds.max)),
        new Vec2(getX(localBounds.min), getY(localBounds.max)),
      ]
    : [new Vec2()];
  const baseBounds = BoxOperations.fromPointArray(
    corners.map(
      (corner) => Vec2.transformMat2d(new Vec2(), corner, matrix) as Vec2,
    ),
  );
  const resolvedBounds = baseBounds ?? {
    min: toVec2Like(transform.translation),
    max: toVec2Like(transform.translation),
  };
  return resolvedBounds;
}
