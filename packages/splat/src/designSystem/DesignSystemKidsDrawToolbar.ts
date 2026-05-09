import type { SyncIndicatorState } from "@smalldraw/design-system";
import {
  createSplatContext,
  type DropdownMenuEntry,
  type PagedButtonGridLargeLayout,
  type SplatContext,
  type SplatToolItem,
} from "@smalldraw/design-system";
import type { ReadableAtom } from "nanostores";
import {
  Download,
  FilePlus,
  FolderOpen,
  Redo2,
  Share2,
  Trash2,
  Undo2,
} from "lucide";
import type { UiIntentStore } from "../controller/stores/createUiIntentStore";
import type {
  KidsToolConfig,
  KidsToolFamilyConfig,
  ToolbarItem,
} from "../tools/kidsTools";
import {
  resolveNearestStrokeWidthOption,
  TOOLBAR_COLOR_SWATCHES,
  TOOLBAR_STROKE_WIDTH_OPTIONS,
} from "../ui/toolbarPresentation";
import type { ToolbarUiState } from "../ui/stores/toolbarUiStore";
import type { KidsDrawToolbar } from "../view/KidsDrawToolbar";

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

type SidebarSelection =
  | { kind: "family"; id: string }
  | { kind: "tool"; id: string };

export class DesignSystemKidsDrawToolbarView implements KidsDrawToolbar {
  readonly el: HTMLDivElement;
  readonly responsiveLayoutOwner = "toolbar" as const;

  private readonly context: SplatContext;
  private readonly toolById: Map<string, KidsToolConfig>;
  private readonly familyById: Map<string, KidsToolFamilyConfig>;
  private readonly familyIdByToolId: Map<string, string>;
  private readonly familyIds: Set<string>;
  private readonly sidebarSelectionByToolId = new Map<string, SidebarSelection>();
  private readonly toolItems: SplatToolItem[];
  private readonly fallbackToolId: string;
  private readonly fallbackFamilyId: string;

  constructor(options: {
    tools: KidsToolConfig[];
    families: KidsToolFamilyConfig[];
    sidebarItems: ToolbarItem[];
    uiIntentStore: Pick<UiIntentStore, "publish">;
  }) {
    this.toolById = new Map(
      options.tools.map((tool) => [tool.id, tool] as const),
    );
    this.familyById = new Map(
      options.families.map((family) => [family.id, family] as const),
    );
    this.familyIdByToolId = new Map(
      options.tools.map((tool) => [tool.id, tool.familyId] as const),
    );
    this.familyIds = new Set(options.families.map((family) => family.id));
    this.fallbackFamilyId = options.families[0]?.id ?? "";
    this.fallbackToolId =
      options.tools[0]?.id ?? options.families[0]?.defaultToolId ?? "";

    this.toolItems = options.sidebarItems.flatMap<SplatToolItem>((item) => {
      if (item.kind === "family") {
        const family = this.familyById.get(item.familyId);
        if (!family) {
          return [];
        }
        return [
          {
            id: `family:${family.id}`,
            label: family.label,
            icon: family.icon,
            attributes: {
              "data-tool-family": family.id,
              title: family.label,
            },
          },
        ];
      }
      const tool = this.toolById.get(item.toolId);
      if (!tool) {
        return [];
      }
      return [
        {
          id: `tool:${tool.id}`,
          label: tool.label,
          icon: tool.icon,
          attributes: {
            "data-tool-id": tool.id,
            "data-tool-family": tool.familyId,
            title: tool.label,
          },
        },
      ];
    });

    for (const item of options.sidebarItems) {
      if (item.kind === "family") {
        const family = this.familyById.get(item.familyId);
        if (family) {
          for (const toolId of family.toolIds) {
            if (!this.sidebarSelectionByToolId.has(toolId)) {
              this.sidebarSelectionByToolId.set(toolId, {
                kind: "family",
                id: family.id,
              });
            }
          }
        }
        continue;
      }
      const tool = this.toolById.get(item.toolId);
      if (tool) {
        this.sidebarSelectionByToolId.set(tool.id, {
          kind: "tool",
          id: tool.id,
        });
      }
    }

    const status = document.createElement("output");
    status.hidden = true;
    this.context = createSplatContext({
      tools: this.toolItems,
      activeToolId: this.resolveSidebarSelectionItemId(this.fallbackToolId),
      variants: this.resolveVariantItems(this.fallbackFamilyId),
      activeVariantId: this.fallbackToolId,
      ...this.resolveVariantGridPresentation(this.fallbackFamilyId),
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
      onSelectTool: (itemId) => {
        if (itemId.startsWith("family:")) {
          options.uiIntentStore.publish({
            type: "activate_family_tool",
            familyId: itemId.slice("family:".length),
          });
          return;
        }
        if (itemId.startsWith("tool:")) {
          options.uiIntentStore.publish({
            type: "activate_tool_and_remember",
            toolId: itemId.slice("tool:".length),
          });
        }
      },
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
      onSelectAction: (actionId) => {
        options.uiIntentStore.publish({
          type: toUiActionIntent(actionId) as
            | "undo"
            | "redo"
            | "clear"
            | "export"
            | "new_drawing"
            | "browse"
            | "share",
        });
      },
    });
    this.el = this.context.el;
    this.syncLegacyHooks(this.fallbackFamilyId);
  }

  bindUiState(state: ReadableAtom<ToolbarUiState>): () => void {
    this.applyState(state.get());
    return state.subscribe((nextState) => this.applyState(nextState));
  }

  setCollaborationStatus(status: { visible: boolean; label?: string }): void {
    this.context.setSyncState(resolveSyncState(status));
  }

  syncLayout(): void {
    this.context.syncLayout();
    this.scheduleLegacyHookSync(this.resolveActiveFamilyIdFromDom());
  }

  setCanvasContent(content: HTMLElement): void {
    content.classList.add("kids-draw-stage--design-system");
    this.context.setCanvasContent(content);
    this.scheduleLegacyHookSync(this.resolveActiveFamilyIdFromDom());
  }

  destroy(): void {
    this.context.onunmount();
  }

  private applyState(state: ToolbarUiState): void {
    const activeToolId = this.resolveActiveToolId(state.activeToolId);
    const activeFamilyId = this.resolveActiveFamilyId(activeToolId);
    const variantGridPresentation =
      this.resolveVariantGridPresentation(activeFamilyId);
    this.context.setActiveToolId(this.resolveSidebarSelectionItemId(activeToolId));
    this.context.setVariantGridPresentation(variantGridPresentation);
    this.context.setVariants(this.resolveVariantItems(activeFamilyId));
    this.context.setActiveVariantId(activeToolId);
    this.context.setSelectedColor(state.strokeColor);
    this.context.setColorPickerDisabled(!state.supportsStrokeColor);
    this.context.setSelectedStrokeWidth(
      resolveNearestStrokeWidthOption(
        state.strokeWidth,
        TOOLBAR_STROKE_WIDTH_OPTIONS,
      ),
    );
    this.context.setStrokePickerDisabled(!state.supportsStrokeWidth);
    this.context.setActionDisabled("undo", !state.canUndo);
    this.context.setActionDisabled("redo", !state.canRedo);
    this.context.setActionDisabled("new-drawing", state.newDrawingPending);
    this.context.setActionDisabled("share", state.sharePending);
    this.syncLegacyHooks(activeFamilyId);
  }

  private resolveActiveFamilyId(activeToolId: string): string {
    const activeFamilyId = this.familyIdByToolId.get(activeToolId);
    if (activeFamilyId && this.familyIds.has(activeFamilyId)) {
      return activeFamilyId;
    }
    return this.fallbackFamilyId;
  }

  private resolveActiveToolId(activeToolId: string): string {
    return this.toolById.has(activeToolId) ? activeToolId : this.fallbackToolId;
  }

  private resolveSidebarSelectionItemId(activeToolId: string): string {
    const selection = this.sidebarSelectionByToolId.get(activeToolId);
    if (!selection) {
      return `family:${this.fallbackFamilyId}`;
    }
    if (selection.kind === "tool") {
      return `tool:${selection.id}`;
    }
    return `family:${selection.id}`;
  }

  private resolveVariantItems(familyId: string): SplatToolItem[] {
    const family = this.familyById.get(familyId);
    if (!family) {
      return [];
    }
    return family.toolIds.flatMap((toolId) => {
      const tool = this.toolById.get(toolId);
      if (!tool) {
        return [];
      }
      return [
        {
          id: tool.id,
          label: tool.label,
          icon: tool.icon,
          attributes: {
            "data-tool-variant": tool.id,
            "data-tool-family": tool.familyId,
            title: tool.label,
          },
        },
      ] as const;
    });
  }

  private resolveVariantGridPresentation(familyId: string): {
    largeLayout: PagedButtonGridLargeLayout;
    paginateInLarge: boolean;
    buttonLayout: "small" | "large";
  } {
    const family = this.familyById.get(familyId);
    if (family?.variantGrid) {
      return {
        largeLayout: family.variantGrid.largeLayout,
        paginateInLarge: family.variantGrid.paginateInLarge ?? false,
        buttonLayout: family.variantGrid.buttonLayout ?? "large",
      };
    }
    return {
      largeLayout: "single-row",
      paginateInLarge: false,
      buttonLayout: "large",
    };
  }

  private resolveActiveFamilyIdFromDom(): string {
    return (
      this.el
        .querySelector('[data-tool-family-toolbar]')
        ?.getAttribute("data-tool-family-toolbar") ?? this.fallbackFamilyId
    );
  }

  private scheduleLegacyHookSync(familyId: string): void {
    window.requestAnimationFrame(() => {
      this.syncLegacyHooks(familyId);
    });
  }

  private syncLegacyHooks(familyId: string): void {
    const family = this.familyById.get(familyId);
    const variantStrips = Array.from(
      this.el.querySelectorAll(".kids-draw-toolbar-bottom"),
    );
    for (const strip of variantStrips) {
      if (!(strip instanceof HTMLElement)) {
        continue;
      }
      strip.setAttribute("data-tool-family-toolbar", familyId);
      const prev = strip.querySelector('[data-button-grid-nav="prev"]');
      const next = strip.querySelector('[data-button-grid-nav="next"]');
      if (prev instanceof HTMLElement) {
        prev.setAttribute("data-tool-family-prev", familyId);
      }
      if (next instanceof HTMLElement) {
        next.setAttribute("data-tool-family-next", familyId);
      }
    }
  }
}

function resolveSyncState(status: {
  visible: boolean;
  label?: string;
}): SyncIndicatorState {
  if (!status.visible) {
    return "unknown";
  }
  if (status.label?.includes("(online)")) {
    return "online";
  }
  return "synced-to-server-but-offline";
}

function toUiActionIntent(actionId: string): string {
  if (actionId === "new-drawing") {
    return "new_drawing";
  }
  return actionId;
}
