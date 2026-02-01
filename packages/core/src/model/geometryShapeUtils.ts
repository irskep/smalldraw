import { Mat2d, Vec2 } from "gl-matrix";
import {
  type Box,
  BoxOperations,
  makePoint,
  type Point,
} from "@smalldraw/geometry";
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
  point: Point,
  transform?: ShapeTransform | CanonicalShapeTransform | null,
): Point {
  const matrix = buildTransformMatrix(transform);
  return Vec2.transformMat2d(makePoint(), point, matrix);
}

export function buildTransformMatrix(
  transform?: ShapeTransform | CanonicalShapeTransform | null,
): Mat2d {
  const normalized = normalizeShapeTransform(transform ?? undefined);
  const { translation, rotation, scale, origin } = normalized;
  const translationMatrix = Mat2d.fromTranslation(new Mat2d(), translation);
  const originMatrix = Mat2d.fromTranslation(new Mat2d(), origin);
  const rotationMatrix = Mat2d.fromRotation(new Mat2d(), rotation);
  const scaleMatrix = Mat2d.fromScaling(new Mat2d(), scale);
  const negativeOrigin = makePoint(-origin.x, -origin.y);
  const inverseOriginMatrix = Mat2d.fromTranslation(new Mat2d(), negativeOrigin);
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
  const corners: Point[] = geometryBounds
    ? [
        makePoint(geometryBounds.min.x, geometryBounds.min.y),
        makePoint(geometryBounds.max.x, geometryBounds.min.y),
        makePoint(geometryBounds.max.x, geometryBounds.max.y),
        makePoint(geometryBounds.min.x, geometryBounds.max.y),
      ]
    : [makePoint()];
  const baseBounds = BoxOperations.fromPointArray(
    corners.map((corner) =>
      Vec2.transformMat2d(makePoint(), corner, matrix),
    ),
  );
  if (!baseBounds) {
    const { translation } = transform;
    return { min: translation, max: translation };
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
    min: makePoint(bounds.min.sub(makePoint(padding))),
    max: makePoint(bounds.max.add(makePoint(padding))),
  };
}
