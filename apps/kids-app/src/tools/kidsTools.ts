import {
  createEllipseTool,
  createEraserTool,
  createMarkerTool,
  createPenTool,
  createRectangleTool,
  type ToolDefinition,
  type ToolStyleSupport,
} from "@smalldraw/core";
import {
  Circle,
  Eraser,
  Highlighter,
  type IconNode,
  Pen,
  Square,
} from "lucide";

export type KidsToolCursorMode = "hide-while-drawing" | "always-visible";

export interface KidsToolConfig {
  id: string;
  familyId: string;
  label: string;
  icon: IconNode;
  cursorMode: KidsToolCursorMode;
  tool: ToolDefinition;
}

export interface KidsToolFamilyConfig {
  id: string;
  label: string;
  icon: IconNode;
  defaultToolId: string;
  toolIds: string[];
}

export type ToolbarItem =
  | { kind: "family"; familyId: string }
  | { kind: "tool"; toolId: string };

const PEN_TOOL = createPenTool();
const MARKER_TOOL = createMarkerTool();
const ERASER_TOOL = createEraserTool();
const RECTANGLE_TOOL = createRectangleTool();
const ELLIPSE_TOOL = createEllipseTool();

export const KIDS_DRAW_TOOLS: KidsToolConfig[] = [
  {
    id: PEN_TOOL.id,
    familyId: "brush",
    label: "Pen",
    icon: Pen,
    cursorMode: "hide-while-drawing",
    tool: PEN_TOOL,
  },
  {
    id: MARKER_TOOL.id,
    familyId: "brush",
    label: "Marker",
    icon: Highlighter,
    cursorMode: "hide-while-drawing",
    tool: MARKER_TOOL,
  },
  {
    id: ERASER_TOOL.id,
    familyId: "eraser",
    label: "Eraser",
    icon: Eraser,
    cursorMode: "always-visible",
    tool: ERASER_TOOL,
  },
  {
    id: RECTANGLE_TOOL.id,
    familyId: "shape",
    label: "Rectangle",
    icon: Square,
    cursorMode: "hide-while-drawing",
    tool: RECTANGLE_TOOL,
  },
  {
    id: ELLIPSE_TOOL.id,
    familyId: "shape",
    label: "Ellipse",
    icon: Circle,
    cursorMode: "hide-while-drawing",
    tool: ELLIPSE_TOOL,
  },
];

export const KIDS_DRAW_TOOL_FAMILIES: KidsToolFamilyConfig[] = [
  {
    id: "brush",
    label: "Brush",
    icon: Pen,
    defaultToolId: "brush.freehand",
    toolIds: ["brush.freehand", "brush.marker"],
  },
  {
    id: "eraser",
    label: "Eraser",
    icon: Eraser,
    defaultToolId: "eraser.basic",
    toolIds: ["eraser.basic"],
  },
  {
    id: "shape",
    label: "Shapes",
    icon: Square,
    defaultToolId: "rect",
    toolIds: ["rect", "ellipse"],
  },
];

export const KIDS_DRAW_SIDEBAR_ITEMS: ToolbarItem[] = [
  { kind: "family", familyId: "brush" },
  { kind: "family", familyId: "shape" },
  { kind: "family", familyId: "eraser" },
];

export const DEFAULT_KIDS_DRAW_FAMILY_ID =
  KIDS_DRAW_TOOL_FAMILIES[0]?.id ?? "brush";

export function getDefaultToolIdForFamily(familyId: string): string {
  const family = KIDS_DRAW_TOOL_FAMILIES.find((item) => item.id === familyId);
  if (!family) {
    return KIDS_DRAW_TOOLS[0]?.id ?? "brush.freehand";
  }
  return family.defaultToolId;
}

export function getFamilyIdForTool(toolId: string): string | null {
  const tool = KIDS_DRAW_TOOLS.find((item) => item.id === toolId);
  return tool?.familyId ?? null;
}

export function getToolConfig(toolId: string): KidsToolConfig | null {
  return KIDS_DRAW_TOOLS.find((item) => item.id === toolId) ?? null;
}

export function getToolStyleSupport(toolId: string): ToolStyleSupport {
  return getToolConfig(toolId)?.tool.styleSupport ?? {};
}
