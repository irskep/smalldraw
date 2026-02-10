import type { StrokeStyle } from "../model/style";
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
