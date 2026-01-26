import {
  type AnyGeometry,
  BoxOperations,
  makePoint,
  type Point,
} from "@smalldraw/geometry";
import type { ShapeHandlerRegistry } from "./shapeHandlers";
import type { Fill, StrokeStyle } from "./style";

export interface CanonicalShapeTransform {
  translation: Point;
  rotation: number;
  scale: Point;
  origin: Point;
}

export interface ShapeInteractions {
  resizable?: boolean;
  rotatable?: boolean;
}

export interface ShapeTransform {
  /**
   * Translation stores the world-space center of the shape's geometry. Tools should not
   * mix coordinate origins (e.g. top-left) because selection/rotation math assumes this
   * pivot when computing bounds.
   */
  translation: Point;
  rotation?: number;
  scale?: Point;
  origin?: Point;
}

export interface Shape {
  id: string;
  type: string;
  fill?: Fill;
  stroke?: StrokeStyle;
  opacity?: number;
  zIndex: string;
  interactions?: ShapeInteractions;
  transform?: ShapeTransform;
}

export type AnyShape = Shape & { geometry: AnyGeometry };

export function normalizeShapeTransform(
  transform?: ShapeTransform | CanonicalShapeTransform | null,
): CanonicalShapeTransform {
  return {
    translation: transform?.translation ?? makePoint(),
    rotation: transform?.rotation ?? 0,
    scale: transform?.scale ?? makePoint(1, 1),
    origin: transform?.origin ?? makePoint(),
  };
}

export function canonicalizeShape(
  shape: AnyShape,
  registry: ShapeHandlerRegistry,
): AnyShape {
  const transform = normalizeShapeTransform(shape.transform);
  const ops = registry.get(shape.type)?.geometry;

  if (!ops) return { ...shape, transform };

  const bounds = ops.getBounds(shape);

  if (!bounds || !ops.canonicalize) {
    // No handler or no canonicalization - return with normalized transform
    return { ...shape, transform };
  }
  const center = new BoxOperations(bounds).center;

  return {
    ...shape,
    geometry: ops.canonicalize(shape, center) as AnyGeometry,
    transform: {
      ...transform,
      translation: makePoint(transform.translation).add(center),
    },
  };
}
