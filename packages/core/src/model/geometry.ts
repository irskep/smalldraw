import type { Bounds, Point } from './primitives';

export interface PenGeometry {
  type: 'pen';
  points: Point[];
  simulatePressure?: boolean;
}

export interface StrokeGeometry {
  type: 'stroke';
  points: Point[];
}

export interface RectGeometry {
  type: 'rect';
  bounds: Bounds;
}

export interface CircleGeometry {
  type: 'circle';
  center: Point;
  radius: number;
}

export interface EllipseGeometry {
  type: 'ellipse';
  bounds: Bounds;
}

export interface RegularPolygonGeometry {
  type: 'regularPolygon';
  center: Point;
  radius: number;
  sides: number;
  rotation?: number;
}

export interface PolygonGeometry {
  type: 'polygon';
  points: Point[];
  closed?: boolean;
}

export interface BezierNode {
  anchor: Point;
  handleIn?: Point;
  handleOut?: Point;
}

export interface BezierGeometry {
  type: 'bezier';
  nodes: BezierNode[];
  closed?: boolean;
}

export interface PathSegment {
  type: 'move' | 'line' | 'bezier';
  points: Point[];
}

export interface PathGeometry {
  type: 'path';
  segments: PathSegment[];
}

export type Geometry =
  | PenGeometry
  | StrokeGeometry
  | RectGeometry
  | CircleGeometry
  | EllipseGeometry
  | RegularPolygonGeometry
  | PolygonGeometry
  | BezierGeometry
  | PathGeometry;
