import {
  type Box,
  BoxOperations,
  getX,
  getY,
  toVec2,
  toVec2Like,
} from "@smalldraw/geometry";
import { Mat2d, Vec2 } from "gl-matrix";
import type {
  AnyShape,
  CanonicalShapeTransform,
  Shape,
  ShapeTransform,
} from "./shape";
import { normalizeShapeTransform } from "./shape";
import type { ShapeHandlerRegistry } from "./shapeHandlers";

export function getGeometryLocalBounds(
  shape: AnyShape,
  registry: ShapeHandlerRegistry,
): Box | null {
  const ops = registry.get(shape.type)?.geometry;
  if (ops?.getBounds) {
    return ops.getBounds(shape);
  }
  return null;
}

export function applyTransformToPoint(
  point: Vec2,
  transform?: ShapeTransform | CanonicalShapeTransform | null,
): Vec2 {
  return Vec2.transformMat2d(
    new Vec2(),
    point,
    buildTransformMatrix(transform),
  ) as Vec2;
}

export function buildTransformMatrix(
  transform?: ShapeTransform | CanonicalShapeTransform | null,
): Mat2d {
  const normalized = normalizeShapeTransform(transform ?? undefined);
  const { translation, rotation, scale, origin } = normalized;
  const translationMatrix = Mat2d.fromTranslation(
    new Mat2d(),
    toVec2(translation),
  );
  const originMatrix = Mat2d.fromTranslation(new Mat2d(), toVec2(origin));
  const rotationMatrix = Mat2d.fromRotation(new Mat2d(), rotation);
  const scaleMatrix = Mat2d.fromScaling(new Mat2d(), toVec2(scale));
  const negativeOrigin = new Vec2(-getX(origin), -getY(origin));
  const inverseOriginMatrix = Mat2d.fromTranslation(
    new Mat2d(),
    negativeOrigin,
  );
  const matrix = new Mat2d();
  Mat2d.multiply(matrix, translationMatrix, originMatrix);
  Mat2d.multiply(matrix, matrix, rotationMatrix);
  Mat2d.multiply(matrix, matrix, scaleMatrix);
  Mat2d.multiply(matrix, matrix, inverseOriginMatrix);
  return matrix;
}

export function getShapeBounds(
  shape: AnyShape,
  registry: ShapeHandlerRegistry,
  transformOverride?: ShapeTransform | CanonicalShapeTransform | null,
): Box {
  const transform = normalizeShapeTransform(
    transformOverride ?? shape.transform,
  );
  const matrix = buildTransformMatrix(transform);
  const geometryBounds = getGeometryLocalBounds(shape, registry);
  const corners: Vec2[] = geometryBounds
    ? [
        new Vec2(getX(geometryBounds.min), getY(geometryBounds.min)),
        new Vec2(getX(geometryBounds.max), getY(geometryBounds.min)),
        new Vec2(getX(geometryBounds.max), getY(geometryBounds.max)),
        new Vec2(getX(geometryBounds.min), getY(geometryBounds.max)),
      ]
    : [new Vec2()];
  const baseBounds = BoxOperations.fromPointArray(
    corners.map(
      (corner) => Vec2.transformMat2d(new Vec2(), corner, matrix) as Vec2,
    ),
  );
  if (!baseBounds) {
    const { translation } = transform;
    return {
      min: toVec2Like(translation),
      max: toVec2Like(translation),
    };
  }
  return applyStrokePadding(baseBounds, shape);
}

function applyStrokePadding(bounds: Box, shape: Shape): Box {
  const strokeWidth = shape.stroke?.size ?? 0;
  if (!strokeWidth) {
    return bounds;
  }
  const padding = strokeWidth / 2;
  return {
    min: new Vec2().add(toVec2(bounds.min)).sub(new Vec2(padding)),
    max: new Vec2().add(toVec2(bounds.max)).add(new Vec2(padding)),
  };
}
