export interface GradientStop {
  offset: number; // 0-1
  color: string;
  opacity?: number;
}

export interface SolidFill {
  type: "solid";
  color: string;
}

export interface GradientFill {
  type: "gradient";
  stops: GradientStop[];
  angle: number;
}

export type Fill = SolidFill | GradientFill;

export interface BrushStyle {
  type: "brush";
  color: string;
  size: number;
  brushId?: string;
}

export type StrokeStyle = BrushStyle;
