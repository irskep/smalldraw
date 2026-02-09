import type { StrokeStyle } from "../model/style";
import type { ToolDefinition } from "./types";
import { createStrokeTool, type StrokeToolOptions } from "./strokeTool";

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
    id: "marker",
    label: "Marker",
    draftIdPrefix: "marker-draft",
    shapeIdPrefix: "marker",
    fallbackStroke: MARKER_DEFAULT_STROKE,
    runtimeOptions: options,
  });
}
