import {
  type AnyShape,
  buildTransformMatrix,
  createPenJSONGeometry,
  getPenGeometryPoints,
  getPenStrokeBounds,
  getPointFromLayout,
  normalizeShapeTransform,
  type PenGeometry,
  type PenShape,
  type Shape,
  type ShapeHandler,
} from "@smalldraw/core";
import {
  type Box,
  BoxOperations,
  getX,
  getY,
  toVec2,
  toVec2Like,
  type Vec2Tuple,
} from "@smalldraw/geometry";
import { Vec2 } from "gl-matrix";

export const KidsPenShapeHandler: ShapeHandler<PenGeometry, unknown> = {
  geometry: {
    getBounds: (shape: PenShape) =>
      getPenStrokeBounds(shape) ??
      BoxOperations.fromPointArray(getPenGeometryPoints(shape.geometry)),
    canonicalize(shape: PenShape, center) {
      const points = getPenGeometryPoints(shape.geometry);
      const localPoints = points.map((pt) =>
        toVec2Like(new Vec2().add(toVec2(pt)).sub(center)),
      );
      return createPenJSONGeometry(localPoints, shape.geometry.pressures);
    },
  },
  shape: {
    hitTest(shape: PenShape, point: Vec2) {
      const points = getPenGeometryPoints(shape.geometry);
      const localBounds =
        getPenStrokeBounds(shape) ?? BoxOperations.fromPointArray(points);
      const bounds = getHitTestBounds(shape, localBounds);
      return new BoxOperations(bounds).containsPoint(point);
    },
  },
  selection: {
    canResize: (shape) => shape.interactions?.resizable !== false,
    prepareResize: (shape: PenShape) => {
      return {
        geometry: shape.geometry,
      };
    },
    resize({ selectionScale, nextBounds, layout, transform }) {
      const translation = layout
        ? toVec2Like(getPointFromLayout(layout, nextBounds))
        : transform.translation;
      return {
        transform: {
          ...transform,
          translation,
          scale: toVec2Like(
            new Vec2(getX(transform.scale), getY(transform.scale)).mul(
              selectionScale,
            ),
          ),
        },
      };
    },
    supportsAxisResize: () => false,
  },
  serialization: {
    toJSON(shape: PenShape) {
      return {
        ...shape,
        geometry: shape.geometry,
        ...(shape.transform
          ? {
              transform: shape.transform,
            }
          : {}),
      };
    },
    fromJSON(shape: AnyShape) {
      const penShape = shape as PenShape;
      if (penShape.geometry.type !== "pen-json") {
        throw new Error(
          `Invalid pen geometry type '${penShape.geometry.type}'. Expected 'pen-json'.`,
        );
      }
      return {
        ...penShape,
        geometry: penShape.geometry,
        ...(penShape.transform
          ? {
              transform: penShape.transform,
            }
          : {}),
      };
    },
  },
};

function getHitTestBounds(shape: Shape, localBounds: Box | null): Box {
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
  return (
    baseBounds ?? {
      min: toVec2Like(transform.translation),
      max: toVec2Like(transform.translation),
    }
  );
}

export type { PenGeometry, PenShape, Vec2Tuple };
