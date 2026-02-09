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
  familyId: string;
  label: string;
  icon: IconNode;
  cursorMode: KidsToolCursorMode;
  createTool: () => ToolDefinition;
}

export interface KidsToolFamilyConfig {
  id: string;
  label: string;
  icon: IconNode;
  defaultToolId: string;
  toolIds: string[];
}

export const KIDS_DRAW_TOOLS: KidsToolConfig[] = [
  {
    id: "pen",
    familyId: "brush",
    label: "Pen",
    icon: Pen,
    cursorMode: "hide-while-drawing",
    createTool: () => createPenTool(),
  },
  {
    id: "marker",
    familyId: "brush",
    label: "Marker",
    icon: Highlighter,
    cursorMode: "hide-while-drawing",
    createTool: () => createMarkerTool(),
  },
  {
    id: "eraser",
    familyId: "eraser",
    label: "Eraser",
    icon: Eraser,
    cursorMode: "always-visible",
    createTool: () => createEraserTool(),
  },
];

export const KIDS_DRAW_TOOL_FAMILIES: KidsToolFamilyConfig[] = [
  {
    id: "brush",
    label: "Brush",
    icon: Pen,
    defaultToolId: "pen",
    toolIds: ["pen", "marker"],
  },
  {
    id: "eraser",
    label: "Eraser",
    icon: Eraser,
    defaultToolId: "eraser",
    toolIds: ["eraser"],
  },
];

export const DEFAULT_KIDS_DRAW_FAMILY_ID =
  KIDS_DRAW_TOOL_FAMILIES[0]?.id ?? "brush";

export function getDefaultToolIdForFamily(familyId: string): string {
  const family = KIDS_DRAW_TOOL_FAMILIES.find((item) => item.id === familyId);
  if (!family) {
    return KIDS_DRAW_TOOLS[0]?.id ?? "pen";
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
