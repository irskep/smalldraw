import type { Point, Size } from "./primitives";

export interface PenGeometry {
  type: "pen";
  points: Point[];
  simulatePressure?: boolean;
}

export interface StrokeGeometry {
  type: "stroke";
  points: Point[];
}

export interface RectGeometry {
  type: "rect";
  size: Size;
}

export interface EllipseGeometry {
  type: "ellipse";
  radiusX: number;
  radiusY: number;
}

export interface RegularPolygonGeometry {
  type: "regularPolygon";
  radius: number;
  sides: number;
}

export interface PolygonGeometry {
  type: "polygon";
  points: Point[];
  closed?: boolean;
}

export interface BezierNode {
  anchor: Point;
  handleIn?: Point;
  handleOut?: Point;
}

export interface BezierGeometry {
  type: "bezier";
  nodes: BezierNode[];
  closed?: boolean;
}

export interface PathSegment {
  type: "move" | "line" | "bezier";
  points: Point[];
}

export interface PathGeometry {
  type: "path";
  segments: PathSegment[];
}

/**
 * Base interface for custom geometry types. To create a custom geometry,
 * define an interface that extends Geometry with a specific type literal:
 *
 * @example
 * ```typescript
 * interface StarGeometry extends Geometry {
 *   type: 'star';
 *   radius: number;
 *   points: number;
 * }
 * ```
 */
export interface CustomGeometry {
  type: string;
}

export type Geometry =
  | PenGeometry
  | StrokeGeometry
  | RectGeometry
  | EllipseGeometry
  | RegularPolygonGeometry
  | PolygonGeometry
  | BezierGeometry
  | PathGeometry
  | CustomGeometry;
