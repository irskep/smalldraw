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
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface AnyGeometry {
  type: string;
}

export interface PenGeometry {
  type: "pen";
  points: Point[];
  intensity?: boolean;
}

export interface RectGeometry {
  type: "rect";
  size: Size;
}
