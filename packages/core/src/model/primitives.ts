export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Bounds {
  origin: Point;
  size: Size;
}
