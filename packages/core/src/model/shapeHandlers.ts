import type { Bounds, Point } from './primitives';
import type { Geometry, RectGeometry, EllipseGeometry, RegularPolygonGeometry, PenGeometry } from './geometry';
import type { Shape, CanonicalShapeTransform } from './shape';
import { getBoundsFromPoints } from './geometryUtils';

/**
 * Operations that work on Geometry alone (no transform/style needed)
 */
export interface GeometryOperations<T extends Geometry = Geometry> {
  /** Compute local bounds for this geometry */
  getBounds: (geometry: T) => Bounds | null;

  /** Canonicalize geometry (convert world coords to local) */
  canonicalize?: (geometry: T, center: Point) => T;

  /** Validate geometry data */
  validate?: (geometry: T) => boolean;
}

/**
 * Operations that need the full Shape (with transform/style)
 */
export interface ShapeOperations<T extends Geometry = Geometry> {
  /**
   * Test if a world-space point is inside the shape.
   * Returns true if the point hits the shape (considering fill, stroke, transform).
   */
  hitTest?: (shape: Shape & { geometry: T }, point: Point) => boolean;
}

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
export interface ResizeResult {
  geometry?: Geometry;
  translation?: Point;
  transform?: CanonicalShapeTransform;
}

/**
 * Snapshot of a shape before resize begins
 */
export interface ResizeSnapshot<TGeometry extends Geometry = Geometry, TData = unknown> {
  geometry: TGeometry;
  data?: TData;
}

/**
 * Parameters for a resize operation
 */
export interface ResizeOperation<TGeometry extends Geometry = Geometry, TData = unknown> {
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
 * Selection and resize operations
 */
export interface SelectionOperations<T extends Geometry = Geometry, TData = unknown> {
  /** Check if this shape can be resized */
  canResize?: (shape: Shape & { geometry: T }) => boolean;

  /** Prepare a snapshot before resize begins */
  prepareResize?: (shape: Shape & { geometry: T }) => ResizeSnapshot<T, TData>;

  /** Perform a resize operation */
  resize?: (operation: ResizeOperation<T, TData>) => ResizeResult | null;

  /** Check if this shape supports axis-aligned resize (mid-handles) */
  supportsAxisResize?: (shape: Shape & { geometry: T }) => boolean;
}

/**
 * Complete handler for a shape type - all operations optional except getBounds
 */
export interface ShapeHandler<T extends Geometry = Geometry, TResizeData = unknown> {
  /** Operations on geometry alone (REQUIRED) */
  geometry: GeometryOperations<T>;

  /** Operations needing the full shape (OPTIONAL) */
  shape?: ShapeOperations<T>;

  /** Selection and resize operations (OPTIONAL) */
  selection?: SelectionOperations<T, TResizeData>;
}

export class ShapeHandlerRegistry {
  private handlers = new Map<string, ShapeHandler>();

  register<T extends Geometry>(type: string, handler: ShapeHandler<T>): void {
    this.handlers.set(type, handler as unknown as ShapeHandler);
  }

  get(type: string): ShapeHandler | undefined {
    return this.handlers.get(type);
  }

  has(type: string): boolean {
    return this.handlers.has(type);
  }

  /** Convenience: get geometry operations */
  getGeometryOps(type: string): GeometryOperations | undefined {
    return this.handlers.get(type)?.geometry;
  }

  /** Convenience: get shape operations */
  getShapeOps(type: string): ShapeOperations | undefined {
    return this.handlers.get(type)?.shape;
  }

  /** Convenience: get selection operations */
  getSelectionOps(type: string): SelectionOperations | undefined {
    return this.handlers.get(type)?.selection;
  }

  clone(): ShapeHandlerRegistry {
    const registry = new ShapeHandlerRegistry();
    for (const [type, handler] of this.handlers) {
      registry.register(type, handler);
    }
    return registry;
  }
}

// Helper functions
function createBounds(minX: number, minY: number, maxX: number, maxY: number): Bounds {
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function shiftPoint<T extends Point>(point: T, center: Point): T {
  return {
    ...point,
    x: point.x - center.x,
    y: point.y - center.y,
  };
}

function getPointFromLayout(layout: NormalizedLayout, bounds: Bounds): Point {
  const width = bounds.width;
  const height = bounds.height;
  return {
    x: bounds.minX + width * layout.offsetU,
    y: bounds.minY + height * layout.offsetV,
  };
}

function getRotatedRectAabbSize(
  width: number,
  height: number,
  rotation: number
): { width: number; height: number } {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const absCos = Math.abs(cos);
  const absSin = Math.abs(sin);
  return {
    width: width * absCos + height * absSin,
    height: width * absSin + height * absCos,
  };
}

function solveRectSizeForAabb(
  targetWidth: number,
  targetHeight: number,
  rotation: number,
  baseSize: { width: number; height: number }
): { width: number; height: number } {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const absCos = Math.abs(cos);
  const absSin = Math.abs(sin);
  const det = absCos * absCos - absSin * absSin;
  if (det !== 0) {
    const width = (absCos * targetWidth - absSin * targetHeight) / det;
    const height = (absCos * targetHeight - absSin * targetWidth) / det;
    return {
      width: Math.max(0, width),
      height: Math.max(0, height),
    };
  }
  const sum = absCos === 0 ? 0 : (targetWidth + targetHeight) / (2 * absCos);
  const baseWidth = baseSize.width;
  const baseHeight = baseSize.height;
  if (baseWidth === 0 && baseHeight === 0) {
    return { width: 0, height: 0 };
  }
  if (baseHeight === 0) {
    return { width: sum, height: 0 };
  }
  if (baseWidth === 0) {
    return { width: 0, height: sum };
  }
  const ratio = baseWidth / baseHeight;
  const height = sum / (1 + ratio);
  const width = sum - height;
  return { width, height };
}

function getRotatedEllipseAabbSize(
  radiusX: number,
  radiusY: number,
  rotation: number
): { width: number; height: number } {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const width = 2 * Math.sqrt((radiusX * cos) ** 2 + (radiusY * sin) ** 2);
  const height = 2 * Math.sqrt((radiusX * sin) ** 2 + (radiusY * cos) ** 2);
  return { width, height };
}

function solveEllipseRadiiForAabb(
  targetWidth: number,
  targetHeight: number,
  rotation: number,
  baseRadii: { radiusX: number; radiusY: number }
): { radiusX: number; radiusY: number } {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const cos2 = cos * cos;
  const sin2 = sin * sin;
  const det = cos2 - sin2;
  const halfWidth = targetWidth / 2;
  const halfHeight = targetHeight / 2;
  const w2 = halfWidth * halfWidth;
  const h2 = halfHeight * halfHeight;
  if (det !== 0) {
    const rx2 = (cos2 * w2 - sin2 * h2) / det;
    const ry2 = (cos2 * h2 - sin2 * w2) / det;
    return {
      radiusX: Math.sqrt(Math.max(0, rx2)),
      radiusY: Math.sqrt(Math.max(0, ry2)),
    };
  }
  const sumSq = cos2 === 0 ? 0 : (w2 + h2) / (2 * cos2);
  const baseX = baseRadii.radiusX;
  const baseY = baseRadii.radiusY;
  if (baseX === 0 && baseY === 0) {
    return { radiusX: 0, radiusY: 0 };
  }
  if (baseY === 0) {
    return { radiusX: Math.sqrt(Math.max(0, sumSq)), radiusY: 0 };
  }
  if (baseX === 0) {
    return { radiusX: 0, radiusY: Math.sqrt(Math.max(0, sumSq)) };
  }
  const ratio = (baseX * baseX) / (baseY * baseY);
  const ry2 = sumSq / (1 + ratio);
  const rx2 = sumSq - ry2;
  return {
    radiusX: Math.sqrt(Math.max(0, rx2)),
    radiusY: Math.sqrt(Math.max(0, ry2)),
  };
}

// Point-based geometries share the same bounds logic
const pointBasedBoundsHandler = (geometry: Geometry) => {
  const g = geometry as Extract<Geometry, { type: 'pen' | 'stroke' | 'polygon' }>;
  return getBoundsFromPoints(g.points);
};

// Create default registry with built-in handlers
const defaultRegistry = new ShapeHandlerRegistry();

// Rectangle - full featured with geometry, selection (including axis-resize)
defaultRegistry.register('rect', {
  geometry: {
    getBounds(geometry) {
      const g = geometry as RectGeometry;
      const halfWidth = g.size.width / 2;
      const halfHeight = g.size.height / 2;
      return createBounds(-halfWidth, -halfHeight, halfWidth, halfHeight);
    },
  },
  selection: {
    canResize: (shape) => shape.interactions?.resizable !== false,
    prepareResize: (shape) => {
      const g = shape.geometry as RectGeometry;
      return {
        geometry: {
          type: 'rect',
          size: { ...g.size },
        },
      };
    },
    resize({ snapshotGeometry, selectionScale, nextBounds, layout, transform }) {
      if (!layout) return null;
      const g = snapshotGeometry as RectGeometry;
      const scaleX = Math.abs(transform.scale.x);
      const scaleY = Math.abs(transform.scale.y);
      const baseWidth = g.size.width * scaleX;
      const baseHeight = g.size.height * scaleY;
      const currentAabb = getRotatedRectAabbSize(baseWidth, baseHeight, transform.rotation);
      const targetAabbWidth = currentAabb.width * selectionScale.x;
      const targetAabbHeight = currentAabb.height * selectionScale.y;
      const solved = solveRectSizeForAabb(
        targetAabbWidth,
        targetAabbHeight,
        transform.rotation,
        { width: baseWidth, height: baseHeight }
      );
      const geometry: RectGeometry = {
        type: 'rect',
        size: {
          width: scaleX === 0 ? 0 : solved.width / scaleX,
          height: scaleY === 0 ? 0 : solved.height / scaleY,
        },
      };
      const translation = getPointFromLayout(layout, nextBounds);
      return { geometry, translation };
    },
    supportsAxisResize: () => true,
  },
});

// Ellipse - geometry + selection (no axis-resize)
defaultRegistry.register('ellipse', {
  geometry: {
    getBounds(geometry) {
      const g = geometry as EllipseGeometry;
      return createBounds(-g.radiusX, -g.radiusY, g.radiusX, g.radiusY);
    },
  },
  selection: {
    canResize: (shape) => shape.interactions?.resizable !== false,
    prepareResize: (shape) => {
      const g = shape.geometry as EllipseGeometry;
      return {
        geometry: {
          type: 'ellipse',
          radiusX: g.radiusX,
          radiusY: g.radiusY,
        },
      };
    },
    resize({ snapshotGeometry, selectionScale, nextBounds, layout, transform }) {
      if (!layout) return null;
      const g = snapshotGeometry as EllipseGeometry;
      const scaleX = Math.abs(transform.scale.x);
      const scaleY = Math.abs(transform.scale.y);
      const baseRadiusX = g.radiusX * scaleX;
      const baseRadiusY = g.radiusY * scaleY;
      const currentAabb = getRotatedEllipseAabbSize(baseRadiusX, baseRadiusY, transform.rotation);
      const targetAabbWidth = currentAabb.width * selectionScale.x;
      const targetAabbHeight = currentAabb.height * selectionScale.y;
      const solved = solveEllipseRadiiForAabb(
        targetAabbWidth,
        targetAabbHeight,
        transform.rotation,
        { radiusX: baseRadiusX, radiusY: baseRadiusY }
      );
      const geometry: EllipseGeometry = {
        type: 'ellipse',
        radiusX: scaleX === 0 ? 0 : solved.radiusX / scaleX,
        radiusY: scaleY === 0 ? 0 : solved.radiusY / scaleY,
      };
      const translation = getPointFromLayout(layout, nextBounds);
      return { geometry, translation };
    },
    supportsAxisResize: () => false,
  },
});

// Regular Polygon - geometry + selection (resize via transform)
defaultRegistry.register('regularPolygon', {
  geometry: {
    getBounds(geometry) {
      const g = geometry as RegularPolygonGeometry;
      return createBounds(-g.radius, -g.radius, g.radius, g.radius);
    },
  },
  selection: {
    canResize: (shape) => shape.interactions?.resizable !== false,
    prepareResize: (shape) => {
      const g = shape.geometry as RegularPolygonGeometry;
      return {
        geometry: {
          type: 'regularPolygon',
          radius: g.radius,
          sides: g.sides,
        },
      };
    },
    resize({ selectionScale, nextBounds, layout, transform }) {
      const translation = layout
        ? getPointFromLayout(layout, nextBounds)
        : transform.translation;
      const newScale = {
        x: transform.scale.x * selectionScale.x,
        y: transform.scale.y * selectionScale.y,
      };
      return {
        transform: {
          ...transform,
          translation,
          scale: newScale,
        },
      };
    },
    supportsAxisResize: () => false,
  },
});

// Pen - geometry + canonicalize + selection (resize via transform)
defaultRegistry.register('pen', {
  geometry: {
    getBounds: pointBasedBoundsHandler,
    canonicalize(geometry, center) {
      const g = geometry as PenGeometry;
      return {
        ...g,
        points: g.points.map((pt) => shiftPoint(pt, center)),
      };
    },
  },
  selection: {
    canResize: (shape) => shape.interactions?.resizable !== false,
    prepareResize: (shape) => {
      const g = shape.geometry as PenGeometry;
      return {
        geometry: {
          type: 'pen',
          points: g.points.map((pt) => ({ ...pt })),
          simulatePressure: g.simulatePressure,
        },
      };
    },
    resize({ selectionScale, nextBounds, layout, transform }) {
      const translation = layout
        ? getPointFromLayout(layout, nextBounds)
        : transform.translation;
      return {
        transform: {
          ...transform,
          translation,
          scale: {
            x: transform.scale.x * selectionScale.x,
            y: transform.scale.y * selectionScale.y,
          },
        },
      };
    },
    supportsAxisResize: () => false,
  },
});

// Stroke - geometry + canonicalize only (no selection)
defaultRegistry.register('stroke', {
  geometry: {
    getBounds: pointBasedBoundsHandler,
    canonicalize(geometry, center) {
      const g = geometry as Extract<Geometry, { type: 'stroke' }>;
      return {
        ...g,
        points: g.points.map((pt) => shiftPoint(pt, center)),
      };
    },
  },
});

// Polygon - geometry + canonicalize only (no selection)
defaultRegistry.register('polygon', {
  geometry: {
    getBounds: pointBasedBoundsHandler,
    canonicalize(geometry, center) {
      const g = geometry as Extract<Geometry, { type: 'polygon' }>;
      return {
        ...g,
        points: g.points.map((pt) => shiftPoint(pt, center)),
      };
    },
  },
});

// Path - geometry + canonicalize only (no selection)
defaultRegistry.register('path', {
  geometry: {
    getBounds(geometry) {
      const g = geometry as Extract<Geometry, { type: 'path' }>;
      return getBoundsFromPoints(g.segments.flatMap((seg) => seg.points));
    },
    canonicalize(geometry, center) {
      const g = geometry as Extract<Geometry, { type: 'path' }>;
      return {
        ...g,
        segments: g.segments.map((seg) => ({
          ...seg,
          points: seg.points.map((pt) => shiftPoint(pt, center)),
        })),
      };
    },
  },
});

// Bezier - geometry + canonicalize only (no selection)
defaultRegistry.register('bezier', {
  geometry: {
    getBounds(geometry) {
      const g = geometry as Extract<Geometry, { type: 'bezier' }>;
      const points = g.nodes.flatMap((node) =>
        [node.anchor, node.handleIn, node.handleOut].filter((pt): pt is Point => Boolean(pt))
      );
      return getBoundsFromPoints(points);
    },
    canonicalize(geometry, center) {
      const g = geometry as Extract<Geometry, { type: 'bezier' }>;
      return {
        ...g,
        nodes: g.nodes.map((node) => ({
          anchor: shiftPoint(node.anchor, center),
          handleIn: node.handleIn ? shiftPoint(node.handleIn, center) : undefined,
          handleOut: node.handleOut ? shiftPoint(node.handleOut, center) : undefined,
        })),
      };
    },
  },
});

// Lazy singleton
let _defaultInstance: ShapeHandlerRegistry | null = null;

export function getDefaultShapeHandlerRegistry(): ShapeHandlerRegistry {
  if (!_defaultInstance) {
    _defaultInstance = defaultRegistry.clone();
  }
  return _defaultInstance;
}
