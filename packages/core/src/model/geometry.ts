import type { Bounds, Point } from './primitives';

export interface StrokeGeometry {
  type: 'stroke';
  points: Point[];
}

export interface RectGeometry {
  type: 'rect';
  bounds: Bounds;
}

export interface EllipseGeometry {
  type: 'ellipse';
  bounds: Bounds;
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
  | StrokeGeometry
  | RectGeometry
  | EllipseGeometry
  | PathGeometry;
