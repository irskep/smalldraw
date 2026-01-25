import type { Bounds, Point } from "@smalldraw/geometry";
import type { CanonicalShapeTransform, Shape } from "./shape";

/**
 * Normalized layout for positioning shapes within selection bounds
 */
export interface NormalizedLayout {
  offsetU: number;
  offsetV: number;
}

/**
 * Result of a resize operation
 */
export interface ResizeResult<TGeometry> {
  geometry?: TGeometry;
  translation?: Point;
  transform?: CanonicalShapeTransform;
}

/**
 * Snapshot of a shape before resize begins
 */
export interface ResizeSnapshot<TGeometry, TData = unknown> {
  geometry: TGeometry;
  data?: TData;
}

/**
 * Parameters for a resize operation
 */
export interface ResizeOperation<TGeometry, TData = unknown> {
  shape: Shape & { geometry: TGeometry };
  snapshotGeometry: TGeometry;
  snapshotData?: TData;
  transform: CanonicalShapeTransform;
  initialBounds: Bounds;
  nextBounds: Bounds;
  selectionScale: { x: number; y: number };
  layout?: NormalizedLayout;
}

/**
 * Parameters for an axis resize operation (mid-handle dragging)
 */
export interface AxisResizeOperation<TGeometry, TData = unknown> {
  snapshotGeometry: TGeometry;
  snapshotData?: TData;
  transform: CanonicalShapeTransform;
  axis: "x" | "y";
  /** The target world-space extent along this axis (already clamped to >= 0) */
  newExtent: number;
}

/**
 * Result of an axis resize operation
 */
export interface AxisResizeResult<TGeometry> {
  geometry: TGeometry;
}

/**
 * Complete handler for a shape type - all operations optional except getBounds
 */
export interface ShapeHandler<T, TResizeData = unknown> {
  /** Operations on geometry alone (REQUIRED) */
  geometry?: {
    /** Compute local bounds for this geometry */
    getBounds: (shape: Shape & { geometry: T }) => Bounds | null;

    /** Canonicalize geometry (convert world coords to local) */
    canonicalize?: (shape: Shape & { geometry: T }, center: Point) => T;

    /** Validate geometry data */
    validate?: (geometry: Shape & { geometry: T }) => boolean;
  };

  /** Operations needing the full shape (OPTIONAL) */
  shape?: {
    /**
     * Test if a world-space point is inside the shape.
     * Returns true if the point hits the shape (considering fill, stroke, transform).
     */
    hitTest?: (shape: Shape & { geometry: T }, point: Point) => boolean;
  };

  /** Selection and resize operations (OPTIONAL) */
  selection?: {
    /** Check if this shape can be resized */
    canResize?: (shape: Shape & { geometry: T }) => boolean;

    /** Prepare a snapshot before resize begins */
    prepareResize?: (
      shape: Shape & { geometry: T },
    ) => ResizeSnapshot<T, TResizeData>;

    /** Perform a resize operation */
    resize?: (
      operation: ResizeOperation<T, TResizeData>,
    ) => ResizeResult<T> | null;

    /** Check if this shape supports axis-aligned resize (mid-handles) */
    supportsAxisResize?: (shape: Shape & { geometry: T }) => boolean;

    /** Resolve a world-space point for axis handles (mid-handles) */
    getAxisHandlePoint?: (
      shape: Shape & { geometry: T },
      axis: "x" | "y",
      direction: -1 | 1,
    ) => Point | null;

    /** Get the world-space extent of the shape along its local axis */
    getAxisExtent?: (
      geometry: T,
      transform: CanonicalShapeTransform,
      axis: "x" | "y",
    ) => number;

    /** Apply a new extent along an axis, returning new geometry */
    axisResize?: (
      operation: AxisResizeOperation<T, TResizeData>,
    ) => AxisResizeResult<T> | null;
  };
}

export function getPointFromLayout(
  layout: NormalizedLayout,
  bounds: Bounds,
): Point {
  const width = bounds.width;
  const height = bounds.height;
  return {
    x: bounds.minX + width * layout.offsetU,
    y: bounds.minY + height * layout.offsetV,
  };
}
