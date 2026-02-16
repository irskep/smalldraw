import type { ToolDefinition, ToolStyleSupport } from "@smalldraw/core";
import type { ShapeRendererRegistry } from "@smalldraw/renderer-canvas";
import {
  Cat,
  Circle,
  Eraser,
  Highlighter,
  type IconNode,
  Minus,
  PaintBucket,
  Pen,
  SprayCan,
  Square,
} from "lucide";
import type { SquareIconSource } from "../view/SquareIconButton";
import {
  createAlphabetStampTool,
  createEllipseOutlineTool,
  createEllipseTool,
  createEraserTool,
  createEvenSpraycanTool,
  createFillTool,
  createLineTool,
  createMarkerTool,
  createPenTool,
  createPngStampTool,
  createRectangleOutlineTool,
  createRectangleTool,
  createUnevenSpraycanTool,
} from "./drawingTools";
import { getAlphabetGlyphIcon, getAlphabetLetters } from "./stampGlyphs";
import {
  getImageStampAssetIdFromToolId,
  getImageStampAssets,
  getImageStampLabel,
  getImageStampToolId,
} from "./stamps/imageStampCatalog";

export type KidsToolCursorMode =
  | "hide-while-drawing"
  | "always-visible"
  | "none";

export interface KidsToolConfig {
  id: string;
  familyId: string;
  shapeVariant?: "rect" | "ellipse";
  label: string;
  icon: SquareIconSource;
  cursorPreviewIcon?: IconNode;
  cursorMode: KidsToolCursorMode;
  tool: ToolDefinition;
}

export interface KidsToolFamilyConfig {
  id: string;
  label: string;
  icon: IconNode;
  shapeFamilyGroup?: "shape";
  variantLayout?: "default" | "two-row-single-height";
  defaultToolId: string;
  toolIds: string[];
}

export type ToolbarItem =
  | { kind: "family"; familyId: string }
  | { kind: "tool"; toolId: string };

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

export interface KidsToolCatalog {
  tools: KidsToolConfig[];
  families: KidsToolFamilyConfig[];
  sidebarItems: ToolbarItem[];
  defaultFamilyId: string;
}

export function createKidsToolCatalog(
  shapeRendererRegistry: ShapeRendererRegistry,
): KidsToolCatalog {
  const PEN_TOOL = createPenTool();
  const MARKER_TOOL = createMarkerTool();
  const EVEN_SPRAYCAN_TOOL = createEvenSpraycanTool();
  const UNEVEN_SPRAYCAN_TOOL = createUnevenSpraycanTool();
  const ERASER_TOOL = createEraserTool();
  const FILL_TOOL = createFillTool({ shapeRendererRegistry });
  const RECTANGLE_TOOL = createRectangleTool();
  const ELLIPSE_TOOL = createEllipseTool();
  const RECTANGLE_OUTLINE_TOOL = createRectangleOutlineTool();
  const ELLIPSE_OUTLINE_TOOL = createEllipseOutlineTool();
  const LINE_TOOL = createLineTool();
  const ALPHABET_STAMP_TOOL_CONFIGS = getAlphabetLetters().map((letter) => {
    const icon = getAlphabetGlyphIcon(letter);
    const tool = createAlphabetStampTool({ letter });
    return {
      id: tool.id,
      familyId: "stamp.alphabet",
      label: letter,
      icon,
      cursorPreviewIcon: icon,
      cursorMode: "always-visible" as const,
      tool,
    };
  });
  const IMAGE_STAMP_TOOL_CONFIGS = getImageStampAssets().map((asset) => {
    const tool = createPngStampTool({ assetId: asset.id });
    return {
      id: tool.id,
      familyId: "stamp.images",
      label: getImageStampLabel(asset.id),
      icon: {
        kind: "image" as const,
        src: asset.src,
      },
      cursorMode: "always-visible" as const,
      tool,
    };
  });

  const tools: KidsToolConfig[] = [
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
      id: FILL_TOOL.id,
      familyId: "fill",
      label: "Fill",
      icon: PaintBucket,
      cursorMode: "none",
      tool: FILL_TOOL,
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
    {
      id: LINE_TOOL.id,
      familyId: "shape.outline",
      label: "Line",
      icon: Minus,
      cursorMode: "hide-while-drawing",
      tool: LINE_TOOL,
    },
    ...ALPHABET_STAMP_TOOL_CONFIGS,
    ...IMAGE_STAMP_TOOL_CONFIGS,
  ];

  const families: KidsToolFamilyConfig[] = [
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
      id: "fill",
      label: "Fill",
      icon: PaintBucket,
      defaultToolId: "fill.basic",
      toolIds: ["fill.basic"],
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
      toolIds: ["rect.outline", "ellipse.outline", "line"],
    },
    {
      id: "stamp.alphabet",
      label: "Letters",
      icon: getAlphabetGlyphIcon("A"),
      variantLayout: "two-row-single-height",
      defaultToolId: "stamp.letter.a",
      toolIds: ALPHABET_STAMP_TOOL_CONFIGS.map((tool) => tool.id),
    },
    {
      id: "stamp.images",
      label: "Stamps",
      icon: Cat,
      variantLayout: "two-row-single-height",
      defaultToolId: getImageStampToolId(
        getImageStampAssets()[0]?.id ?? "cat1",
      ),
      toolIds: IMAGE_STAMP_TOOL_CONFIGS.map((tool) => tool.id),
    },
  ];

  const sidebarItems: ToolbarItem[] = [
    { kind: "family", familyId: "brush" },
    { kind: "family", familyId: "eraser" },
    { kind: "family", familyId: "fill" },
    { kind: "family", familyId: "shape.filled" },
    { kind: "family", familyId: "shape.outline" },
    { kind: "family", familyId: "stamp.alphabet" },
    { kind: "family", familyId: "stamp.images" },
  ];

  const defaultFamilyId =
    families.find((family) => family.id === "stamp.images")?.id ??
    families[0]?.id ??
    "brush";

  return { tools, families, sidebarItems, defaultFamilyId };
}

export function getDefaultToolIdForFamily(
  familyId: string,
  catalog: KidsToolCatalog,
): string {
  const family = catalog.families.find((item) => item.id === familyId);
  if (!family) {
    return catalog.tools[0]?.id ?? "brush.freehand";
  }
  return family.defaultToolId;
}

export function getFamilyIdForTool(
  toolId: string,
  catalog: KidsToolCatalog,
): string | null {
  const tool = catalog.tools.find((item) => item.id === toolId);
  return tool?.familyId ?? null;
}

export function getToolConfig(
  toolId: string,
  catalog: KidsToolCatalog,
): KidsToolConfig | null {
  return catalog.tools.find((item) => item.id === toolId) ?? null;
}

export function getToolShapeVariant(
  toolId: string,
  catalog: KidsToolCatalog,
): KidsToolConfig["shapeVariant"] | undefined {
  return getToolConfig(toolId, catalog)?.shapeVariant;
}

export function getMatchingShapeFamilyToolId(options: {
  familyId: string;
  shapeVariant: KidsToolConfig["shapeVariant"] | undefined;
  catalog: KidsToolCatalog;
}): string | null {
  const family = options.catalog.families.find(
    (item) => item.id === options.familyId,
  );
  if (!family?.shapeFamilyGroup || !options.shapeVariant) {
    return null;
  }
  const toolId = family.toolIds.find((id) => {
    const tool = getToolConfig(id, options.catalog);
    return tool?.shapeVariant === options.shapeVariant;
  });
  return toolId ?? null;
}

export function getToolStyleSupport(
  toolId: string,
  catalog: KidsToolCatalog,
): ToolStyleSupport {
  const toolConfig = getToolConfig(toolId, catalog);
  const support = toolConfig?.tool.styleSupport ?? {};
  return {
    ...support,
    transparentStrokeColor: support.transparentStrokeColor ?? false,
    transparentFillColor: support.transparentFillColor ?? false,
  };
}

export function isImageStampToolId(toolId: string): boolean {
  return getImageStampAssetIdFromToolId(toolId) !== null;
}
