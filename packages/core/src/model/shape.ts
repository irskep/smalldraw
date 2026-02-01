import {
  type AnyGeometry,
  BoxOperations,
  type Vec2Tuple,
  toVec2Like,
  getX,
  getY,
} from "@smalldraw/geometry";
import { Vec2 } from "gl-matrix";
import type { ShapeHandlerRegistry } from "./shapeHandlers";
import type { Fill, StrokeStyle } from "./style";

export interface CanonicalShapeTransform {
  translation: Vec2Tuple;
  rotation: number;
  scale: Vec2Tuple;
  origin: Vec2Tuple;
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
  translation: Vec2Tuple;
  rotation?: number;
  scale?: Vec2Tuple;
  // TODO: Consider switching origin to normalized 0..1 space (default 0.5,0.5)
  // instead of local geometry units; current behavior assumes canonicalized
  // geometry centered at [0,0] with origin in local units.
  origin?: Vec2Tuple;
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
    translation: transform?.translation
      ? toVec2Like(transform.translation)
      : [0, 0],
    rotation: transform?.rotation ?? 0,
    scale: transform?.scale ? toVec2Like(transform.scale) : [1, 1],
    origin: transform?.origin ? toVec2Like(transform.origin) : [0, 0],
  };
}

export function getPatchedTransform(
  base: ShapeTransform,
  patch: Partial<ShapeTransform> = {},
): ShapeTransform {
  const next: ShapeTransform = { translation: base.translation };
  if (base.rotation !== undefined) next.rotation = base.rotation;
  if (base.scale !== undefined) next.scale = base.scale;
  if (base.origin !== undefined) next.origin = base.origin;

  if (patch.translation !== undefined) next.translation = patch.translation;
  if (patch.rotation !== undefined) next.rotation = patch.rotation;
  if (patch.scale !== undefined) next.scale = patch.scale;
  if (patch.origin !== undefined) next.origin = patch.origin;

  return next;
}

export function cloneTransform(transform: ShapeTransform): ShapeTransform {
  const clone = (value: [number, number]): [number, number] => [
    value[0],
    value[1],
  ];
  const next: ShapeTransform = { translation: clone(transform.translation) };
  if (transform.rotation !== undefined) next.rotation = transform.rotation;
  if (transform.scale !== undefined) next.scale = clone(transform.scale);
  if (transform.origin !== undefined) next.origin = clone(transform.origin);
  return next;
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
      translation: toVec2Like(
        new Vec2(getX(transform.translation), getY(transform.translation)).add(
          center,
        ),
      ),
    },
  };
}
