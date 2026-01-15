import type { Geometry } from './geometry';
import type { Fill, StrokeStyle } from './style';

export interface ShapeInteractions {
  resizable?: boolean;
  rotatable?: boolean;
}

export interface ShapeTransform {
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
