import type { StrokeStyle } from "../model/style";
import { createBoxedTool, type BoxedToolOptions } from "./boxed";
import { createStrokeTool, type StrokeToolOptions } from "./strokeTool";
import type { ToolDefinition } from "./types";

export interface PenToolOptions extends StrokeToolOptions {}

const PEN_DEFAULT_STROKE: StrokeStyle = {
  type: "brush",
  color: "#000000",
  size: 2,
  brushId: "freehand",
  compositeOp: "source-over",
} as const;

export function createPenTool(options?: PenToolOptions): ToolDefinition {
  return createStrokeTool({
    id: "brush.freehand",
    label: "Pen",
    draftIdPrefix: "brush-freehand-draft",
    shapeIdPrefix: "brush-freehand",
    fallbackStroke: PEN_DEFAULT_STROKE,
    runtimeOptions: options,
  });
}

export interface MarkerToolOptions extends StrokeToolOptions {}

const MARKER_DEFAULT_STROKE: StrokeStyle = {
  type: "brush",
  color: "#000000",
  size: 2,
  brushId: "marker",
  compositeOp: "source-over",
} as const;

export function createMarkerTool(options?: MarkerToolOptions): ToolDefinition {
  return createStrokeTool({
    id: "brush.marker",
    label: "Marker",
    draftIdPrefix: "brush-marker-draft",
    shapeIdPrefix: "brush-marker",
    fallbackStroke: MARKER_DEFAULT_STROKE,
    runtimeOptions: options,
  });
}

export interface SprayToolOptions extends StrokeToolOptions {}

const SPRAY_DEFAULT_STROKE: StrokeStyle = {
  type: "brush",
  color: "#000000",
  size: 6,
  brushId: "spray",
  compositeOp: "source-over",
} as const;

export function createSprayTool(options?: SprayToolOptions): ToolDefinition {
  return createStrokeTool({
    id: "brush.spray",
    label: "Spray Paint",
    draftIdPrefix: "brush-spray-draft",
    shapeIdPrefix: "brush-spray",
    fallbackStroke: SPRAY_DEFAULT_STROKE,
    runtimeOptions: options,
  });
}

export interface EraserToolOptions extends StrokeToolOptions {}

const ERASER_DEFAULT_STROKE: StrokeStyle = {
  type: "brush",
  color: "#000000",
  size: 2,
  brushId: "marker",
  compositeOp: "destination-out",
} as const;

export function createEraserTool(options?: EraserToolOptions): ToolDefinition {
  return createStrokeTool({
    id: "eraser.basic",
    label: "Eraser",
    draftIdPrefix: "eraser-basic-draft",
    shapeIdPrefix: "eraser-basic",
    fallbackStroke: ERASER_DEFAULT_STROKE,
    runtimeOptions: options,
  });
}

export interface RectangleToolOptions extends BoxedToolOptions {}

export function createRectangleTool(
  options?: RectangleToolOptions,
): ToolDefinition {
  return createBoxedTool({
    id: "rect",
    label: "Rectangle",
    kind: "rect",
    draftIdPrefix: "rect-draft",
    shapeIdPrefix: "rect",
    runtimeOptions: options,
  });
}

export interface EllipseToolOptions extends BoxedToolOptions {}

export function createEllipseTool(options?: EllipseToolOptions): ToolDefinition {
  return createBoxedTool({
    id: "ellipse",
    label: "Ellipse",
    kind: "ellipse",
    draftIdPrefix: "ellipse-draft",
    shapeIdPrefix: "ellipse",
    runtimeOptions: options,
  });
}
