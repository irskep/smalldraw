import type { SyncIndicatorState } from "@smalldraw/design-system";
import {
  createSplatContext,
  type DropdownMenuEntry,
  type SplatContext,
  type SplatContextDocumentSlot,
} from "@smalldraw/design-system";
import {
  Download,
  FilePlus,
  FolderOpen,
  Redo2,
  Share2,
  Trash2,
  Undo2,
} from "lucide";
import type { ReadableAtom } from "nanostores";
import type { KidsDrawUiIntent } from "../controller/KidsDrawUiIntent";
import type { CollaborationStatus } from "../controller/stores/createCollaborationStatusStore";
import type { UiIntentStore } from "../controller/stores/createUiIntentStore";
import type {
  KidsToolConfig,
  KidsToolFamilyConfig,
  ToolbarItem,
} from "../tools/kidsTools";
import type { ToolbarUiState } from "../ui/stores/toolbarUiStore";
import {
  TOOLBAR_COLOR_SWATCHES,
  TOOLBAR_STROKE_WIDTH_OPTIONS,
} from "../ui/toolbarPresentation";
import type { KidsDrawToolbar } from "../view/KidsDrawToolbar";
import {
  createToolbarProjectionModel,
  resolveFamilyPresentation,
  resolveToolbarPresentationState,
  resolveToolPresentation,
  type ToolbarProjectionModel,
} from "./toolbarProjection";

const DESKTOP_MENU_ENTRIES: readonly DropdownMenuEntry[] = [
  { id: "new-drawing", label: "New Drawing", icon: FilePlus },
  { id: "browse", label: "Browse Drawings", icon: FolderOpen },
  { id: "export", label: "Export PNG", icon: Download },
  { type: "separator" },
  { id: "clear", label: "Clear Canvas", icon: Trash2, danger: true },
];

const MOBILE_MENU_ENTRIES: readonly DropdownMenuEntry[] = [
  {
    type: "row",
    label: "History",
    items: [
      { id: "undo", label: "Undo", icon: Undo2 },
      { id: "redo", label: "Redo", icon: Redo2 },
    ],
  },
  { type: "separator" },
  { id: "new-drawing", label: "New Drawing", icon: FilePlus },
  { id: "browse", label: "Browse Drawings", icon: FolderOpen },
  { id: "export", label: "Export PNG", icon: Download },
  { id: "share", label: "Share", icon: Share2 },
  { type: "separator" },
  { id: "clear", label: "Clear Canvas", icon: Trash2, danger: true },
];

export class DesignSystemKidsDrawToolbarView implements KidsDrawToolbar {
  readonly el: HTMLDivElement;
  readonly responsiveLayoutOwner = "toolbar" as const;

  private readonly context: SplatContext;
  private readonly projectionModel: ToolbarProjectionModel;

  constructor(options: {
    tools: KidsToolConfig[];
    families: KidsToolFamilyConfig[];
    sidebarItems: ToolbarItem[];
    uiIntentStore: Pick<UiIntentStore, "publish">;
  }) {
    this.projectionModel = createToolbarProjectionModel({
      tools: options.tools,
      families: options.families,
      sidebarItems: options.sidebarItems,
    });

    const status = document.createElement("output");
    status.hidden = true;
    const publishActionIntent = createToolbarActionIntentPublisher(
      options.uiIntentStore,
    );
    const publishToolSelectionIntent = createToolbarToolIntentPublisher(
      options.uiIntentStore,
    );
    this.context = createSplatContext({
      tools: this.projectionModel.toolItems,
      activeToolId: resolveToolPresentation(
        this.projectionModel.fallbackToolId,
        this.projectionModel,
      ).activeSidebarItemId,
      variants: resolveFamilyPresentation(
        this.projectionModel.fallbackFamilyId,
        this.projectionModel,
      ).variantItems,
      activeVariantId: this.projectionModel.fallbackToolId,
      ...resolveFamilyPresentation(
        this.projectionModel.fallbackFamilyId,
        this.projectionModel,
      ).variantGridPresentation,
      colors: TOOLBAR_COLOR_SWATCHES.map((swatch) => ({
        color: swatch.value,
        label: swatch.label,
      })),
      selectedColor: TOOLBAR_COLOR_SWATCHES[0]?.value ?? "#000000",
      strokeWidths: TOOLBAR_STROKE_WIDTH_OPTIONS,
      selectedStrokeWidth: TOOLBAR_STROKE_WIDTH_OPTIONS[0] ?? 2,
      desktopMenuEntries: DESKTOP_MENU_ENTRIES,
      mobileMenuEntries: MOBILE_MENU_ENTRIES,
      syncState: "unknown",
      status,
      onSelectTool: publishToolSelectionIntent,
      onSelectVariant: (toolId) => {
        options.uiIntentStore.publish({
          type: "activate_tool_and_remember",
          toolId,
        });
      },
      onSelectColor: (strokeColor) => {
        options.uiIntentStore.publish({
          type: "set_stroke_color",
          strokeColor,
        });
      },
      onSelectStrokeWidth: (strokeWidth) => {
        options.uiIntentStore.publish({
          type: "set_stroke_width",
          strokeWidth,
        });
      },
      onSelectAction: publishActionIntent,
    });
    this.el = this.context.el;
  }

  bindUiState(state: ReadableAtom<ToolbarUiState>): () => void {
    this.applyState(state.get());
    return state.subscribe((nextState) => this.applyState(nextState));
  }

  setCollaborationStatus(status: CollaborationStatus): void {
    this.context.setSyncState(
      resolveSyncState(status),
      status.visible ? status.message : undefined,
    );
  }

  syncLayout(): void {
    this.context.syncLayout();
  }

  setCanvasContent(content: HTMLElement): void {
    content.classList.add("kids-draw-stage--design-system");
    this.setDocumentSlot({ type: "document", content });
  }

  setDocumentSlot(slot: SplatContextDocumentSlot): void {
    this.context.setDocumentSlot(slot);
  }

  setSharingFeaturesVisible(visible: boolean): void {
    this.context.setSharingFeaturesVisible(visible);
  }

  private applyState(state: ToolbarUiState): void {
    const presentation = resolveToolbarPresentationState({
      state,
      model: this.projectionModel,
    });
    this.context.setActiveToolId(presentation.activeSidebarItemId);
    this.context.setVariantGridPresentation(
      presentation.familyPresentation.variantGridPresentation,
    );
    this.context.setVariants(presentation.familyPresentation.variantItems);
    this.context.setActiveVariantId(presentation.activeToolId);
    this.context.setSelectedColor(state.strokeColor);
    this.context.setColorPickerDisabled(
      !state.hasLoadedDocument || !state.supportsStrokeColor,
    );
    this.context.setSelectedStrokeWidth(presentation.selectedStrokeWidth);
    this.context.setStrokePickerDisabled(
      !state.hasLoadedDocument || !state.supportsStrokeWidth,
    );
    this.context.setActionDisabled(
      "undo",
      !state.hasLoadedDocument || !state.canUndo,
    );
    this.context.setActionDisabled(
      "redo",
      !state.hasLoadedDocument || !state.canRedo,
    );
    this.context.setActionDisabled("new-drawing", state.newDrawingPending);
    this.context.setActionDisabled("export", !state.hasLoadedDocument);
    this.context.setActionDisabled("clear", !state.hasLoadedDocument);
    this.context.setActionDisabled(
      "share",
      !state.hasLoadedDocument || state.sharePending,
    );
  }
}

function createToolbarToolIntentPublisher(
  uiIntentStore: Pick<UiIntentStore, "publish">,
): (itemId: string) => void {
  return (itemId: string): void => {
    if (itemId.startsWith("family:")) {
      uiIntentStore.publish({
        type: "activate_family_tool",
        familyId: itemId.slice("family:".length),
      });
      return;
    }
    if (itemId.startsWith("tool:")) {
      uiIntentStore.publish({
        type: "activate_tool_and_remember",
        toolId: itemId.slice("tool:".length),
      });
    }
  };
}

function createToolbarActionIntentPublisher(
  uiIntentStore: Pick<UiIntentStore, "publish">,
): (actionId: string) => void {
  return (actionId: string): void => {
    uiIntentStore.publish({ type: toUiActionIntent(actionId) });
  };
}

function resolveSyncState(status: CollaborationStatus): SyncIndicatorState {
  if (!status.visible) {
    return "unknown";
  }
  if (status.state === "error") {
    return "error";
  }
  if (status.state === "online") {
    return "online";
  }
  return "synced-to-server-but-offline";
}

function toUiActionIntent(actionId: string): Extract<
  KidsDrawUiIntent,
  {
    type:
      | "undo"
      | "redo"
      | "clear"
      | "export"
      | "new_drawing"
      | "browse"
      | "share";
  }
>["type"] {
  if (actionId === "new-drawing") {
    return "new_drawing";
  }
  return actionId as Extract<
    KidsDrawUiIntent,
    {
      type: "undo" | "redo" | "clear" | "export" | "browse" | "share";
    }
  >["type"];
}
