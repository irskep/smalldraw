import type { StrokeStyle } from "../model/style";
import { createStrokeTool, type StrokeToolOptions } from "./strokeTool";
import type { ToolDefinition } from "./types";

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
