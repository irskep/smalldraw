import type { Vec2 } from "gl-matrix";

// Basics

export type Point = Vec2;

export interface Box {
  min: Point;
  max: Point;
}

// Geometries

export interface AnyGeometry {
  type: string;
}

export interface PenGeometry {
  type: "pen";
  points: Point[];
  pressures?: number[]; // same length as points
}

export interface RectGeometry {
  type: "rect";
  size: Point;
}
