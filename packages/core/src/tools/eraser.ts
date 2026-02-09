import type { StrokeStyle } from "../model/style";
import { createStrokeTool, type StrokeToolOptions } from "./strokeTool";
import type { ToolDefinition } from "./types";

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
    id: "eraser",
    label: "Eraser",
    draftIdPrefix: "eraser-draft",
    shapeIdPrefix: "eraser",
    fallbackStroke: ERASER_DEFAULT_STROKE,
    runtimeOptions: options,
  });
}
