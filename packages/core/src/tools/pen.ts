import type { StrokeStyle } from "../model/style";
import type { ToolDefinition } from "./types";
import { createStrokeTool, type StrokeToolOptions } from "./strokeTool";

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
    id: "pen",
    label: "Pen",
    draftIdPrefix: "pen-draft",
    shapeIdPrefix: "pen",
    fallbackStroke: PEN_DEFAULT_STROKE,
    runtimeOptions: options,
  });
}
