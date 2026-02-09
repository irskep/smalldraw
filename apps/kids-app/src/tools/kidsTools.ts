import {
  createEraserTool,
  createMarkerTool,
  createPenTool,
  type ToolDefinition,
} from "@smalldraw/core";
import { Eraser, Highlighter, type IconNode, Pen } from "lucide";

export type KidsToolCursorMode = "hide-while-drawing" | "always-visible";

export interface KidsToolConfig {
  id: string;
  label: string;
  icon: IconNode;
  cursorMode: KidsToolCursorMode;
  createTool: () => ToolDefinition;
}

export const KIDS_DRAW_TOOLS: KidsToolConfig[] = [
  {
    id: "pen",
    label: "Pen",
    icon: Pen,
    cursorMode: "hide-while-drawing",
    createTool: () => createPenTool(),
  },
  {
    id: "marker",
    label: "Marker",
    icon: Highlighter,
    cursorMode: "hide-while-drawing",
    createTool: () => createMarkerTool(),
  },
  {
    id: "eraser",
    label: "Eraser",
    icon: Eraser,
    cursorMode: "always-visible",
    createTool: () => createEraserTool(),
  },
];

export const DEFAULT_KIDS_DRAW_TOOL_ID = KIDS_DRAW_TOOLS[0]?.id ?? "pen";
