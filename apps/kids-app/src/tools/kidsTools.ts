import type { ToolDefinition, ToolStyleSupport } from "@smalldraw/core";
import {
  Circle,
  Eraser,
  Highlighter,
  type IconNode,
  Pen,
  SprayCan,
  Square,
} from "lucide";
import {
  createEllipseTool,
  createEllipseOutlineTool,
  createEraserTool,
  createEvenSpraycanTool,
  createMarkerTool,
  createPenTool,
  createRectangleTool,
  createRectangleOutlineTool,
  createUnevenSpraycanTool,
} from "./drawingTools";

export type KidsToolCursorMode = "hide-while-drawing" | "always-visible";

export interface KidsToolConfig {
  id: string;
  familyId: string;
  shapeVariant?: "rect" | "ellipse";
  label: string;
  icon: IconNode;
  cursorMode: KidsToolCursorMode;
  tool: ToolDefinition;
}

export interface KidsToolFamilyConfig {
  id: string;
  label: string;
  icon: IconNode;
  shapeFamilyGroup?: "shape";
  defaultToolId: string;
  toolIds: string[];
}

export type ToolbarItem =
  | { kind: "family"; familyId: string }
  | { kind: "tool"; toolId: string };

const PEN_TOOL = createPenTool();
const MARKER_TOOL = createMarkerTool();
const EVEN_SPRAYCAN_TOOL = createEvenSpraycanTool();
const UNEVEN_SPRAYCAN_TOOL = createUnevenSpraycanTool();
const ERASER_TOOL = createEraserTool();
const RECTANGLE_TOOL = createRectangleTool();
const ELLIPSE_TOOL = createEllipseTool();
const RECTANGLE_OUTLINE_TOOL = createRectangleOutlineTool();
const ELLIPSE_OUTLINE_TOOL = createEllipseOutlineTool();

const FILLED_SHAPE_FAMILY_ICON: IconNode = [
  [
    "rect",
    {
      x: "2.5",
      y: "2.5",
      width: "19",
      height: "19",
      rx: "3",
      ry: "3",
      fill: "currentColor",
      stroke: "none",
    },
  ],
];

const FILLED_RECT_ICON: IconNode = [
  [
    "rect",
    {
      x: "2.5",
      y: "2.5",
      width: "19",
      height: "19",
      rx: "2",
      ry: "2",
      fill: "currentColor",
      stroke: "none",
    },
  ],
];

const FILLED_ELLIPSE_ICON: IconNode = [
  [
    "ellipse",
    {
      cx: "12",
      cy: "12",
      rx: "9.5",
      ry: "9.5",
      fill: "currentColor",
      stroke: "none",
    },
  ],
];

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
    id: EVEN_SPRAYCAN_TOOL.id,
    familyId: "brush",
    label: "Spray (Move)",
    icon: SprayCan,
    cursorMode: "hide-while-drawing",
    tool: EVEN_SPRAYCAN_TOOL,
  },
  {
    id: UNEVEN_SPRAYCAN_TOOL.id,
    familyId: "brush",
    label: "Spray (Hold)",
    icon: SprayCan,
    cursorMode: "hide-while-drawing",
    tool: UNEVEN_SPRAYCAN_TOOL,
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
    familyId: "shape.filled",
    shapeVariant: "rect",
    label: "Rectangle",
    icon: FILLED_RECT_ICON,
    cursorMode: "hide-while-drawing",
    tool: RECTANGLE_TOOL,
  },
  {
    id: ELLIPSE_TOOL.id,
    familyId: "shape.filled",
    shapeVariant: "ellipse",
    label: "Ellipse",
    icon: FILLED_ELLIPSE_ICON,
    cursorMode: "hide-while-drawing",
    tool: ELLIPSE_TOOL,
  },
  {
    id: RECTANGLE_OUTLINE_TOOL.id,
    familyId: "shape.outline",
    shapeVariant: "rect",
    label: "Rectangle",
    icon: Square,
    cursorMode: "hide-while-drawing",
    tool: RECTANGLE_OUTLINE_TOOL,
  },
  {
    id: ELLIPSE_OUTLINE_TOOL.id,
    familyId: "shape.outline",
    shapeVariant: "ellipse",
    label: "Ellipse",
    icon: Circle,
    cursorMode: "hide-while-drawing",
    tool: ELLIPSE_OUTLINE_TOOL,
  },
];

export const KIDS_DRAW_TOOL_FAMILIES: KidsToolFamilyConfig[] = [
  {
    id: "brush",
    label: "Brush",
    icon: Pen,
    defaultToolId: "brush.freehand",
    toolIds: [
      "brush.freehand",
      "brush.marker",
      "brush.even-spraycan",
      "brush.uneven-spraycan",
    ],
  },
  {
    id: "eraser",
    label: "Eraser",
    icon: Eraser,
    defaultToolId: "eraser.basic",
    toolIds: ["eraser.basic"],
  },
  {
    id: "shape.filled",
    label: "Filled",
    icon: FILLED_SHAPE_FAMILY_ICON,
    shapeFamilyGroup: "shape",
    defaultToolId: "rect",
    toolIds: ["rect", "ellipse"],
  },
  {
    id: "shape.outline",
    label: "Outline",
    icon: Circle,
    shapeFamilyGroup: "shape",
    defaultToolId: "rect.outline",
    toolIds: ["rect.outline", "ellipse.outline"],
  },
];

export const KIDS_DRAW_SIDEBAR_ITEMS: ToolbarItem[] = [
  { kind: "family", familyId: "brush" },
  { kind: "family", familyId: "eraser" },
  { kind: "family", familyId: "shape.filled" },
  { kind: "family", familyId: "shape.outline" },
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

export function getToolShapeVariant(
  toolId: string,
): KidsToolConfig["shapeVariant"] | undefined {
  return getToolConfig(toolId)?.shapeVariant;
}

export function getMatchingShapeFamilyToolId(options: {
  familyId: string;
  shapeVariant: KidsToolConfig["shapeVariant"] | undefined;
}): string | null {
  const family = KIDS_DRAW_TOOL_FAMILIES.find(
    (item) => item.id === options.familyId,
  );
  if (!family?.shapeFamilyGroup || !options.shapeVariant) {
    return null;
  }
  const toolId = family.toolIds.find((id) => {
    const tool = getToolConfig(id);
    return tool?.shapeVariant === options.shapeVariant;
  });
  return toolId ?? null;
}

export function getToolStyleSupport(toolId: string): ToolStyleSupport {
  const toolConfig = getToolConfig(toolId);
  const support = toolConfig?.tool.styleSupport ?? {};
  return {
    ...support,
    transparentStrokeColor: support.transparentStrokeColor ?? false,
    transparentFillColor: support.transparentFillColor ?? false,
  };
}
