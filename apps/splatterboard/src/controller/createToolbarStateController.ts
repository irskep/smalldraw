import type { DrawingStore } from "@smalldraw/core";
import {
  getDefaultToolIdForFamily,
  getFamilyIdForTool,
  getMatchingShapeFamilyToolId,
  getToolShapeVariant,
  getToolStyleSupport,
  type KidsToolCatalog,
  type KidsToolFamilyConfig,
} from "../tools/kidsTools";
import {
  getToolbarUiPersistSignature,
  toPersistedToolbarUiState,
} from "../ui/stores/toolbarUiPersistence";
import {
  loadPersistedToolbarUiState,
  type PersistedKidsUiStateV1,
  type ToolbarUiStore,
} from "../ui/stores/toolbarUiStore";
import { STROKE_WIDTH_OPTIONS } from "../view/KidsDrawToolbar";

export type ToolbarStatePolicy = {
  opaqueStrokeColor: string;
  opaqueFillColor: string;
  normalDefaultToolId: string;
  coloringDefaultToolId: string;
  normalDefaultStrokeWidth: number;
  coloringDefaultStrokeWidth: number;
};

export const DEFAULT_TOOLBAR_STATE_POLICY: ToolbarStatePolicy = {
  opaqueStrokeColor: "#000000",
  opaqueFillColor: "#ffffff",
  normalDefaultToolId: "brush.marker",
  coloringDefaultToolId: "brush.marker",
  normalDefaultStrokeWidth: 8,
  coloringDefaultStrokeWidth: 24,
};

function getNearestStrokeWidthOption(strokeWidth: number): number {
  let nearest: number = STROKE_WIDTH_OPTIONS[0];
  let nearestDelta = Math.abs(strokeWidth - nearest);
  for (const option of STROKE_WIDTH_OPTIONS) {
    const delta = Math.abs(strokeWidth - option);
    if (delta < nearestDelta) {
      nearest = option;
      nearestDelta = delta;
    }
  }
  return nearest;
}

function resolveInitialToolbarUiStateFromPersistence(input: {
  catalog: KidsToolCatalog;
  current: {
    activeToolId: string;
    strokeColor: string;
    strokeWidth: number;
  };
  persisted: PersistedKidsUiStateV1 | null;
}): {
  activeToolId: string;
  strokeColor: string;
  strokeWidth: number;
} {
  const { catalog, current, persisted } = input;
  if (!persisted) {
    return current;
  }

  const toolIds = new Set(catalog.tools.map((tool) => tool.id));
  const activeToolId = toolIds.has(persisted.activeToolId)
    ? persisted.activeToolId
    : current.activeToolId;
  const strokeColor =
    persisted.strokeColor.trim().length > 0
      ? persisted.strokeColor.toLowerCase()
      : current.strokeColor;
  const strokeWidth =
    Number.isFinite(persisted.strokeWidth) && persisted.strokeWidth > 0
      ? getNearestStrokeWidthOption(persisted.strokeWidth)
      : current.strokeWidth;

  return {
    activeToolId,
    strokeColor,
    strokeWidth,
  };
}

export class ToolbarStateController {
  private selectedToolIdByFamily: Map<string, string>;
  private readonly policy: ToolbarStatePolicy;

  constructor(
    private readonly options: {
      store: DrawingStore;
      toolbarUiStore: ToolbarUiStore;
      catalog: KidsToolCatalog;
      families: KidsToolFamilyConfig[];
      getCurrentDocUrl: () => string;
      cursorOverlaySync: () => void;
      policy?: Partial<ToolbarStatePolicy>;
    },
  ) {
    this.selectedToolIdByFamily = new Map(
      options.families.map(
        (family) => [family.id, family.defaultToolId] as const,
      ),
    );
    this.policy = {
      ...DEFAULT_TOOLBAR_STATE_POLICY,
      ...options.policy,
    };
  }

  syncToolbarUi(): void {
    this.options.toolbarUiStore.syncFromDrawingStore(this.options.store, {
      resolveActiveFamilyId: (toolId) =>
        getFamilyIdForTool(toolId, this.options.catalog),
      resolveToolStyleSupport: (toolId) =>
        getToolStyleSupport(toolId, this.options.catalog),
    });
    this.options.cursorOverlaySync();
  }

  activateToolAndRemember(toolId: string): void {
    this.applyActiveLayerForTool(toolId);
    this.options.store.activateTool(toolId);
    this.sanitizeTransparentStylesForTool(toolId);
    const familyId = getFamilyIdForTool(toolId, this.options.catalog);
    if (!familyId) {
      return;
    }
    this.selectedToolIdByFamily.set(familyId, toolId);
  }

  activateFamilyTool(familyId: string): void {
    const activeToolId = this.options.store.getActiveToolId() ?? "";
    const activeShapeVariant =
      getToolShapeVariant(activeToolId, this.options.catalog) ??
      (activeToolId.includes("ellipse")
        ? "ellipse"
        : activeToolId.includes("rect")
          ? "rect"
          : undefined);
    const matchingShapeToolId = getMatchingShapeFamilyToolId({
      familyId,
      shapeVariant: activeShapeVariant,
      catalog: this.options.catalog,
    });
    const toolId =
      matchingShapeToolId ??
      this.selectedToolIdByFamily.get(familyId) ??
      getDefaultToolIdForFamily(familyId, this.options.catalog);
    this.activateToolAndRemember(toolId);
  }

  applyToolbarStateForCurrentDocument(
    presentation: { mode: "normal" | "coloring" | "markup" },
    options?: {
      forceDefaults?: boolean;
    },
  ): void {
    const defaultStrokeWidth =
      presentation.mode === "coloring"
        ? this.policy.coloringDefaultStrokeWidth
        : this.policy.normalDefaultStrokeWidth;
    const defaultToolId =
      presentation.mode === "coloring"
        ? this.policy.coloringDefaultToolId
        : this.policy.normalDefaultToolId;
    const docUrl = this.options.getCurrentDocUrl();
    const shared = this.options.store.getSharedSettings();
    const resolvedInitialToolbarUiState =
      resolveInitialToolbarUiStateFromPersistence({
        catalog: this.options.catalog,
        current: {
          activeToolId: defaultToolId,
          strokeColor: this.policy.opaqueStrokeColor,
          strokeWidth: getNearestStrokeWidthOption(defaultStrokeWidth),
        },
        persisted: options?.forceDefaults
          ? null
          : loadPersistedToolbarUiState(docUrl),
      });
    this.activateToolAndRemember(resolvedInitialToolbarUiState.activeToolId);
    this.options.store.updateSharedSettings({
      strokeColor: resolvedInitialToolbarUiState.strokeColor,
      strokeWidth: resolvedInitialToolbarUiState.strokeWidth,
      fillColor: shared.fillColor,
    });
    this.syncToolbarUi();
  }

  getCurrentToolbarSignature(): string {
    return getToolbarUiPersistSignature(
      toPersistedToolbarUiState(this.options.toolbarUiStore.get()),
    );
  }

  private sanitizeTransparentStylesForTool(toolId: string): void {
    const support = getToolStyleSupport(toolId, this.options.catalog);
    const shared = this.options.store.getSharedSettings();
    const nextSettings: Partial<typeof shared> = {};
    if (
      shared.strokeColor === "transparent" &&
      !support.transparentStrokeColor
    ) {
      nextSettings.strokeColor = this.policy.opaqueStrokeColor;
    }
    if (shared.fillColor === "transparent" && !support.transparentFillColor) {
      nextSettings.fillColor = this.policy.opaqueFillColor;
    }
    if (Object.keys(nextSettings).length > 0) {
      this.options.store.updateSharedSettings(nextSettings);
    }
  }

  private applyActiveLayerForTool(toolId: string): void {
    const mode = this.resolveCurrentMode();
    const layerId = this.resolveLayerIdForTool(mode, toolId);
    this.options.store.setActiveLayerId(layerId);
  }

  private resolveCurrentMode(): "normal" | "coloring" | "markup" {
    const presentation = this.options.store.getDocument().presentation;
    if (
      presentation.documentType === "normal" ||
      presentation.documentType === "coloring" ||
      presentation.documentType === "markup"
    ) {
      return presentation.documentType;
    }
    const composite = presentation.referenceImage?.composite;
    if (composite === "over-drawing") {
      return "coloring";
    }
    if (composite === "under-drawing") {
      return "markup";
    }
    return "normal";
  }

  private resolveLayerIdForTool(
    mode: "normal" | "coloring" | "markup",
    toolId: string,
  ): string {
    const familyId = getFamilyIdForTool(toolId, this.options.catalog);
    const isStampFamily = familyId?.startsWith("stamp.") ?? false;
    if (mode === "coloring") {
      return isStampFamily ? "stickers-over" : "color-under";
    }
    if (mode === "markup") {
      return isStampFamily ? "stickers-over" : "default";
    }
    return "default";
  }
}
