import { getBoundsCenter } from "@smalldraw/geometry";
import type { ShapeHandlerRegistry } from "./shapeHandlers";
import type { Fill, StrokeStyle } from "./style";

export interface CanonicalShapeTransform {
  translation: { x: number; y: number };
  rotation: number;
  scale: { x: number; y: number };
  origin: { x: number; y: number };
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
  translation: { x: number; y: number };
  rotation?: number;
  scale?: { x: number; y: number };
  origin?: { x: number; y: number };
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

export function normalizeShapeTransform(
  transform?: ShapeTransform | CanonicalShapeTransform | null,
): CanonicalShapeTransform {
  const translation = transform?.translation ?? { x: 0, y: 0 };
  const rotation = transform?.rotation ?? 0;
  const scale = transform?.scale ?? { x: 1, y: 1 };
  const origin = transform?.origin ?? { x: 0, y: 0 };
  return {
    translation: { ...translation },
    rotation,
    scale: { ...scale },
    origin: { ...origin },
  };
}

export function canonicalizeShape(
  shape: Shape,
  registry: ShapeHandlerRegistry,
): Shape & { geometry: unknown } {
  const transform = normalizeShapeTransform(shape.transform);
  const ops = registry.get(shape.type)?.geometry;

  const shapeWithGeometry = shape as Shape & { geometry: unknown };

  if (!ops) return { ...shapeWithGeometry, transform };

  const bounds = ops.getBounds(shapeWithGeometry);

  if (!bounds || !ops.canonicalize) {
    // No handler or no canonicalization - return with normalized transform
    return { ...shapeWithGeometry, transform };
  }
  const center = getBoundsCenter(bounds);

  return {
    ...shape,
    geometry: ops.canonicalize(shapeWithGeometry, center),
    transform: {
      ...transform,
      translation: {
        x: transform.translation.x + center.x,
        y: transform.translation.y + center.y,
      },
    },
  };
}
