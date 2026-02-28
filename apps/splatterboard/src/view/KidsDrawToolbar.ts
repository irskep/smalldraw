import "./KidsDrawToolbar.css";

import { computed, type ReadableAtom } from "nanostores";
import { el, mount } from "redom";
import type { KidsDrawUiIntent } from "../controller/KidsDrawUiIntent";
import type { UiIntentStore } from "../controller/stores/createUiIntentStore";
import type {
  KidsToolConfig,
  KidsToolFamilyConfig,
  ToolbarItem,
} from "../tools/kidsTools";
import type { ToolbarUiState } from "../ui/stores/toolbarUiStore";
import type { MobilePortraitActionsView } from "./MobilePortraitActionsView";
import type { PagedButtonGridMode } from "./PagedButtonGrid";
import type { ReDomLike } from "./ReDomLike";
import { ToolbarActionPane } from "./toolbar/ToolbarActionPane";
import { ToolbarStylePane } from "./toolbar/ToolbarStylePane";
import { ToolbarToolSelectorPane } from "./toolbar/ToolbarToolSelectorPane";
import { ToolbarVariantStripPane } from "./toolbar/ToolbarVariantStripPane";

export type KidsDrawToolbarIntent = Extract<
  KidsDrawUiIntent,
  | { type: "activate_family_tool" }
  | { type: "activate_tool_and_remember" }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "clear" }
  | { type: "export" }
  | { type: "new_drawing" }
  | { type: "browse" }
  | { type: "set_stroke_color" }
  | { type: "set_stroke_width" }
>;

export {
  resolveNearestStrokeWidthOption,
  resolveSelectedColorSwatchIndex,
  STROKE_WIDTH_OPTIONS,
} from "./toolbar/ToolbarStylePane";

export class KidsDrawToolbarView implements ReDomLike<HTMLDivElement> {
  readonly el: HTMLDivElement;
  private readonly topElement: HTMLDivElement;
  private readonly topContentElement: HTMLDivElement;
  private readonly bottomElement: HTMLDivElement;
  private readonly toolSelectorElement: HTMLDivElement;
  private readonly actionPanelElement: HTMLDivElement;
  private readonly actionPane: ToolbarActionPane;
  private readonly stylePane: ToolbarStylePane;
  private readonly toolSelectorPane: ToolbarToolSelectorPane;
  private readonly variantStripPane: ToolbarVariantStripPane;
  private readonly toolById: Map<string, KidsToolConfig>;
  private readonly familyIdByToolId: Map<string, string>;
  private readonly familyIds: Set<string>;
  private readonly fallbackToolId: string;
  private readonly fallbackFamilyId: string;
  private unbindToolSelectorSelection: (() => void) | null = null;
  private unbindToolSelectorUiState: (() => void) | null = null;
  private unbindVariantSelections: Array<() => void> = [];
  private unbindVariantUiState: (() => void) | null = null;

  constructor(options: {
    tools: KidsToolConfig[];
    families: KidsToolFamilyConfig[];
    sidebarItems: ToolbarItem[];
    uiIntentStore: Pick<UiIntentStore, "publish">;
  }) {
    this.toolById = new Map(
      options.tools.map((tool) => [tool.id, tool] as const),
    );
    this.familyIdByToolId = new Map(
      options.tools.map((tool) => [tool.id, tool.familyId] as const),
    );
    this.familyIds = new Set(options.families.map((family) => family.id));
    this.fallbackFamilyId = options.families[0]?.id ?? "";
    this.fallbackToolId =
      options.tools[0]?.id ?? options.families[0]?.defaultToolId ?? "";

    this.el = document.createElement("div");
    this.el.className = "kids-draw-toolbar-view";
    this.el.hidden = true;
    this.topElement = el(
      "div.kids-draw-toolbar.kids-draw-toolbar-top",
    ) as HTMLDivElement;
    this.topContentElement = el(
      "div.kids-draw-toolbar-top-content",
    ) as HTMLDivElement;
    this.bottomElement = el(
      "div.kids-draw-toolbar.kids-draw-toolbar-bottom",
    ) as HTMLDivElement;
    this.actionPane = new ToolbarActionPane({
      uiIntentStore: options.uiIntentStore,
    });
    this.stylePane = new ToolbarStylePane({
      uiIntentStore: options.uiIntentStore,
    });
    this.actionPanelElement = this.actionPane.el;
    this.toolSelectorPane = new ToolbarToolSelectorPane({
      sidebarItems: options.sidebarItems,
      families: options.families,
      toolById: this.toolById,
      uiIntentStore: options.uiIntentStore,
    });
    this.toolSelectorElement = this.toolSelectorPane.el;
    this.variantStripPane = new ToolbarVariantStripPane({
      families: options.families,
      toolById: this.toolById,
      uiIntentStore: options.uiIntentStore,
    });
    mount(this.topContentElement, this.stylePane);
    mount(this.topElement, this.topContentElement);
    mount(this.bottomElement, this.variantStripPane);
    mount(this.el, this.topElement);
    mount(this.el, this.actionPanelElement);
    mount(this.el, this.toolSelectorElement);
    mount(this.el, this.bottomElement);
  }

  bindUiState(state: ReadableAtom<ToolbarUiState>): () => void {
    this.unbindToolSelectorSelection?.();
    this.unbindToolSelectorUiState?.();
    this.unbindToolSelectorUiState = null;
    for (const unbind of this.unbindVariantSelections) {
      unbind();
    }
    this.unbindVariantUiState?.();
    this.unbindVariantUiState = null;
    const selectedToolIdStore = computed(state, (nextState) =>
      this.resolveActiveToolId(nextState.activeToolId),
    );
    const activeFamilyIdStore = computed(selectedToolIdStore, (activeToolId) =>
      this.resolveActiveFamilyId(activeToolId),
    );
    const toolSelectorSelectionStore = computed(state, (nextState) => {
      const activeToolId = this.resolveActiveToolId(nextState.activeToolId);
      const activeFamilyId = this.resolveActiveFamilyId(activeToolId);
      return this.toolSelectorPane.resolveSelectionItemId(
        activeToolId,
        activeFamilyId,
      );
    });
    this.unbindToolSelectorSelection = this.toolSelectorPane.bindSelection(
      toolSelectorSelectionStore,
    );
    this.unbindToolSelectorUiState = this.toolSelectorPane.bindUiState({
      activeToolIdStore: selectedToolIdStore,
      activeFamilyIdStore,
    });
    this.unbindVariantSelections =
      this.variantStripPane.bindSelection(selectedToolIdStore);
    this.unbindVariantUiState = this.variantStripPane.bindUiState({
      activeToolIdStore: selectedToolIdStore,
      activeFamilyIdStore,
      onSyncVisibleFamily: () => this.toolSelectorPane.syncLayout(),
    });
    this.applyState(state.get());
    const unbindUiState = state.subscribe((next) => this.applyState(next));
    return () => {
      unbindUiState();
      this.unbindToolSelectorSelection?.();
      this.unbindToolSelectorSelection = null;
      this.unbindToolSelectorUiState?.();
      this.unbindToolSelectorUiState = null;
      for (const unbind of this.unbindVariantSelections) {
        unbind();
      }
      this.unbindVariantSelections = [];
      this.unbindVariantUiState?.();
      this.unbindVariantUiState = null;
    };
  }

  mountDesktopLayout(options: {
    topSlot: HTMLElement;
    rightSlot: HTMLElement;
    bottomSlot: HTMLElement;
    leftSlot: HTMLElement;
  }): void {
    this.toolSelectorPane.setResolvedOrientation("vertical");
    options.topSlot.replaceChildren(this.topElement);
    options.leftSlot.replaceChildren(this.toolSelectorElement);
    options.rightSlot.replaceChildren(this.actionPanelElement);
    options.bottomSlot.replaceChildren(this.bottomElement);
  }

  mountMobilePortraitLayout(options: {
    topSlot: HTMLElement;
    bottomSlot: HTMLElement;
    mobilePortraitActionsView: MobilePortraitActionsView;
    actionsOpen: boolean;
  }): void {
    this.toolSelectorPane.setResolvedOrientation("horizontal");
    options.mobilePortraitActionsView.mountMobileLayout({
      topSlot: options.topSlot,
      bottomSlot: options.bottomSlot,
      toolbarTopElement: this.topElement,
      toolbarBottomElement: this.bottomElement,
      toolSelectorElement: this.toolSelectorElement,
      actionsOpen: options.actionsOpen,
    });
  }

  setMobileTopPanel(panel: "colors" | "strokes"): void {
    this.stylePane.setMobileTopPanel(panel);
  }

  showDesktopTopPanels(): void {
    this.stylePane.showDesktopPanels();
  }

  setGridMode(mode: PagedButtonGridMode): void {
    this.toolSelectorPane.setGridMode(mode);
    this.variantStripPane.setGridMode(mode);
  }

  syncLayout(): void {
    this.toolSelectorPane.syncLayout();
    this.variantStripPane.syncLayout();
  }

  destroy(): void {
    this.unbindToolSelectorSelection?.();
    this.unbindToolSelectorSelection = null;
    this.unbindToolSelectorUiState?.();
    this.unbindToolSelectorUiState = null;
    for (const unbind of this.unbindVariantSelections) {
      unbind();
    }
    this.unbindVariantSelections = [];
    this.unbindVariantUiState?.();
    this.unbindVariantUiState = null;
    this.toolSelectorPane.destroy();
    this.variantStripPane.destroy();
    this.actionPane.destroy();
    this.stylePane.destroy();
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

  private applyState(state: ToolbarUiState): void {
    this.actionPane.update({
      canUndo: state.canUndo,
      canRedo: state.canRedo,
      newDrawingPending: state.newDrawingPending,
    });

    this.stylePane.update({
      strokeColor: state.strokeColor,
      strokeWidth: state.strokeWidth,
      supportsStrokeColor: state.supportsStrokeColor,
      supportsStrokeWidth: state.supportsStrokeWidth,
    });
  }
}
