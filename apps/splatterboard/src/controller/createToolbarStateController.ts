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
  type ToolbarUiStore,
  loadPersistedToolbarUiState,
  type PersistedKidsUiStateV1,
} from "../ui/stores/toolbarUiStore";
import {
  getToolbarUiPersistSignature,
  toPersistedToolbarUiState,
} from "../ui/stores/toolbarUiPersistence";
import { STROKE_WIDTH_OPTIONS, type KidsDrawToolbar } from "../view/KidsDrawToolbar";

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

  constructor(
    private readonly options: {
      store: DrawingStore;
      toolbarUiStore: ToolbarUiStore;
      toolbar: KidsDrawToolbar;
      catalog: KidsToolCatalog;
      families: KidsToolFamilyConfig[];
      getCurrentDocUrl: () => string;
      cursorOverlaySync: () => void;
      mobilePortraitUndoMenuItem: HTMLButtonElement;
      mobilePortraitRedoMenuItem: HTMLButtonElement;
      mobilePortraitNewMenuItem: HTMLButtonElement;
      opaqueStrokeColor: string;
      opaqueFillColor: string;
      normalDefaultToolId: string;
      coloringDefaultToolId: string;
      normalDefaultStrokeWidth: number;
      coloringDefaultStrokeWidth: number;
    },
  ) {
    this.selectedToolIdByFamily = new Map(
      options.families.map((family) => [family.id, family.defaultToolId] as const),
    );
  }

  syncToolbarUi(): void {
    this.options.toolbarUiStore.syncFromDrawingStore(this.options.store, {
      resolveActiveFamilyId: (toolId) => getFamilyIdForTool(toolId, this.options.catalog),
      resolveToolStyleSupport: (toolId) =>
        getToolStyleSupport(toolId, this.options.catalog),
    });
    const toolbarUiState = this.options.toolbarUiStore.get();
    this.options.mobilePortraitUndoMenuItem.disabled = !toolbarUiState.canUndo;
    this.options.mobilePortraitRedoMenuItem.disabled = !toolbarUiState.canRedo;
    this.options.mobilePortraitNewMenuItem.disabled =
      this.options.toolbar.newDrawingButton.el.disabled;
    this.options.cursorOverlaySync();
  }

  activateToolAndRemember(toolId: string): void {
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
        ? this.options.coloringDefaultStrokeWidth
        : this.options.normalDefaultStrokeWidth;
    const defaultToolId =
      presentation.mode === "coloring"
        ? this.options.coloringDefaultToolId
        : this.options.normalDefaultToolId;
    const docUrl = this.options.getCurrentDocUrl();
    const shared = this.options.store.getSharedSettings();
    const resolvedInitialToolbarUiState = resolveInitialToolbarUiStateFromPersistence(
      {
        catalog: this.options.catalog,
        current: {
          activeToolId: defaultToolId,
          strokeColor: this.options.opaqueStrokeColor,
          strokeWidth: getNearestStrokeWidthOption(defaultStrokeWidth),
        },
        persisted: options?.forceDefaults
          ? null
          : loadPersistedToolbarUiState(docUrl),
      },
    );
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
      nextSettings.strokeColor = this.options.opaqueStrokeColor;
    }
    if (shared.fillColor === "transparent" && !support.transparentFillColor) {
      nextSettings.fillColor = this.options.opaqueFillColor;
    }
    if (Object.keys(nextSettings).length > 0) {
      this.options.store.updateSharedSettings(nextSettings);
    }
  }
}
