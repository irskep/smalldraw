import type { Vec2Like } from "gl-matrix";
export type Vec2Tuple = [number, number];

// Basics

export interface Box {
  min: Vec2Like;
  max: Vec2Like;
}

// Geometries

export interface AnyGeometry {
  type: string;
}
