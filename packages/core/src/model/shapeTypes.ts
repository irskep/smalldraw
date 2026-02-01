import { type AnyGeometry, type Box, BoxOperations } from "@smalldraw/geometry";
import { Vec2 } from "gl-matrix";
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
export interface ResizeResult<TGeometry extends AnyGeometry> {
  geometry?: TGeometry;
  translation?: Vec2;
  transform?: CanonicalShapeTransform;
}

/**
 * Snapshot of a shape before resize begins
 */
export interface ResizeSnapshot<
  TGeometry extends AnyGeometry,
  TData = unknown,
> {
  geometry: TGeometry;
  data?: TData;
}

/**
 * Parameters for a resize operation
 */
export interface ResizeOperation<
  TGeometry extends AnyGeometry,
  TData = unknown,
> {
  shape: Shape & { geometry: TGeometry };
  snapshotGeometry: TGeometry;
  snapshotData?: TData;
  transform: CanonicalShapeTransform;
  initialBounds: Box;
  nextBounds: Box;
  selectionScale: Vec2;
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
export interface AxisResizeResult<TGeometry extends AnyGeometry> {
  geometry: TGeometry;
}

/**
 * Complete handler for a shape type - all operations optional except getBounds
 */
export interface ShapeHandler<T extends AnyGeometry, TResizeData = unknown> {
  /** Operations on geometry alone (REQUIRED) */
  geometry?: {
    /** Compute local bounds for this geometry */
    getBounds: (shape: Shape & { geometry: T }) => Box | null;

    /** Canonicalize geometry (convert world coords to local) */
    canonicalize?: (shape: Shape & { geometry: T }, center: Vec2) => T;

    /** Validate geometry data */
    validate?: (geometry: Shape & { geometry: T }) => boolean;
  };

  /** Operations needing the full shape (OPTIONAL) */
  shape?: {
    /**
     * Test if a world-space point is inside the shape.
     * Returns true if the point hits the shape (considering fill, stroke, transform).
     */
    hitTest?: (shape: Shape & { geometry: T }, point: Vec2) => boolean;
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

    /** Allow non-uniform scaling when the shape is rotated */
    allowNonUniformScaleWhileRotated?: (
      shape: Shape & { geometry: T },
    ) => boolean;

    /** Check if this shape supports axis-aligned resize (mid-handles) */
    supportsAxisResize?: (shape: Shape & { geometry: T }) => boolean;

    /** Resolve a world-space point for axis handles (mid-handles) */
    getAxisHandlePoint?: (
      shape: Shape & { geometry: T },
      axis: "x" | "y",
      direction: -1 | 1,
    ) => Vec2 | null;

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
  bounds: Box,
): Vec2 {
  const b = new BoxOperations(bounds);
  const width = b.width;
  const height = b.height;
  return new Vec2(
    b.minX + width * layout.offsetU,
    b.minY + height * layout.offsetV,
  );
}
