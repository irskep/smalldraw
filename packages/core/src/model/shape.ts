import type { Geometry } from './geometry';
import type { Fill, StrokeStyle } from './style';

export interface Shape {
  id: string;
  geometry: Geometry;
  fill?: Fill;
  stroke?: StrokeStyle;
  opacity?: number;
  zIndex: string;
}
