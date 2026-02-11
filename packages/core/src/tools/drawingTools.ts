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

export interface SpraycanToolOptions extends StrokeToolOptions {}

const EVEN_SPRAYCAN_DEFAULT_STROKE: StrokeStyle = {
  type: "brush",
  color: "#000000",
  size: 6,
  brushId: "even-spraycan",
  compositeOp: "source-over",
} as const;

const UNEVEN_SPRAYCAN_DEFAULT_STROKE: StrokeStyle = {
  type: "brush",
  color: "#000000",
  size: 6,
  brushId: "uneven-spraycan",
  compositeOp: "source-over",
} as const;

export function createEvenSpraycanTool(
  options?: SpraycanToolOptions,
): ToolDefinition {
  return createStrokeTool({
    id: "brush.even-spraycan",
    label: "Even Spraycan",
    draftIdPrefix: "brush-even-spraycan-draft",
    shapeIdPrefix: "brush-even-spraycan",
    fallbackStroke: EVEN_SPRAYCAN_DEFAULT_STROKE,
    runtimeOptions: options,
  });
}

export function createUnevenSpraycanTool(
  options?: SpraycanToolOptions,
): ToolDefinition {
  return createStrokeTool({
    id: "brush.uneven-spraycan",
    label: "Uneven Spraycan",
    draftIdPrefix: "brush-uneven-spraycan-draft",
    shapeIdPrefix: "brush-uneven-spraycan",
    fallbackStroke: UNEVEN_SPRAYCAN_DEFAULT_STROKE,
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
