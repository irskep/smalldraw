import type { Geometry, PathGeometry, PolygonGeometry, PenGeometry, StrokeGeometry, BezierGeometry } from './geometry';
import type { Fill, StrokeStyle } from './style';
import type { Point } from './primitives';
import { getBoundsCenter, getBoundsFromPoints } from './geometryBounds';

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
  geometry: Geometry;
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

export function canonicalizeShape(shape: Shape): Shape {
  const transform = normalizeShapeTransform(shape.transform);
  switch (shape.geometry.type) {
    case 'pen':
    case 'stroke':
    case 'polygon':
      return canonicalizePointListShape(
        shape as Shape & { geometry: PenGeometry | StrokeGeometry | PolygonGeometry },
        transform,
      );
    case 'path':
      return canonicalizePathShape(shape as Shape & { geometry: PathGeometry }, transform);
    case 'bezier':
      return canonicalizeBezierShape(shape as Shape & { geometry: BezierGeometry }, transform);
    default:
      return { ...shape, transform };
  }
}

function canonicalizePointListShape(
  shape: Shape & { geometry: PenGeometry | StrokeGeometry | PolygonGeometry },
  transform: CanonicalShapeTransform,
): Shape {
  const bounds = getBoundsFromPoints(shape.geometry.points);
  if (!bounds) {
    return { ...shape, transform };
  }
  const center = getBoundsCenter(bounds);
  const localPoints = shape.geometry.points.map((pt) => ({
    ...pt,
    x: pt.x - center.x,
    y: pt.y - center.y,
  }));
  return {
    ...shape,
    geometry: { ...shape.geometry, points: localPoints },
    transform: {
      ...transform,
      translation: {
        x: transform.translation.x + center.x,
        y: transform.translation.y + center.y,
      },
    },
  };
}

function canonicalizePathShape(
  shape: Shape & { geometry: PathGeometry },
  transform: CanonicalShapeTransform,
): Shape {
  const allPoints = shape.geometry.segments.flatMap((segment) => segment.points);
  const bounds = getBoundsFromPoints(allPoints);
  if (!bounds) {
    return { ...shape, transform };
  }
  const center = getBoundsCenter(bounds);
  const segments = shape.geometry.segments.map((segment) => ({
    ...segment,
    points: segment.points.map((pt) => ({
      ...pt,
      x: pt.x - center.x,
      y: pt.y - center.y,
    })),
  }));
  return {
    ...shape,
    geometry: { ...shape.geometry, segments },
    transform: {
      ...transform,
      translation: {
        x: transform.translation.x + center.x,
        y: transform.translation.y + center.y,
      },
    },
  };
}

function canonicalizeBezierShape(
  shape: Shape & { geometry: BezierGeometry },
  transform: CanonicalShapeTransform,
): Shape {
  const allPoints: Point[] = [];
  for (const node of shape.geometry.nodes) {
    allPoints.push(node.anchor);
    if (node.handleIn) allPoints.push(node.handleIn);
    if (node.handleOut) allPoints.push(node.handleOut);
  }
  const bounds = getBoundsFromPoints(allPoints);
  if (!bounds) {
    return { ...shape, transform };
  }
  const center = getBoundsCenter(bounds);
  const nodes = shape.geometry.nodes.map((node) => ({
    anchor: shiftPoint(node.anchor, center),
    handleIn: node.handleIn ? shiftPoint(node.handleIn, center) : undefined,
    handleOut: node.handleOut ? shiftPoint(node.handleOut, center) : undefined,
  }));
  return {
    ...shape,
    geometry: { ...shape.geometry, nodes },
    transform: {
      ...transform,
      translation: {
        x: transform.translation.x + center.x,
        y: transform.translation.y + center.y,
      },
    },
  };
}

function shiftPoint<T extends Point>(point: T, center: Point): T {
  return {
    ...point,
    x: point.x - center.x,
    y: point.y - center.y,
  };
}
