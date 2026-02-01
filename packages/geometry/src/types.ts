import type { Vec2 } from "gl-matrix";

// Basics

export interface Box {
  min: Vec2;
  max: Vec2;
}

// Geometries

export interface AnyGeometry {
  type: string;
}

export interface PenGeometry {
  type: "pen";
  points: Vec2[];
  pressures?: number[]; // same length as points
}

export interface RectGeometry {
  type: "rect";
  size: Vec2;
}
