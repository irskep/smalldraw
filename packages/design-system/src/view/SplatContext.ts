import type { IconNode } from "lucide";
import { Redo2, Share2, Undo2 } from "lucide";
import { atom, type WritableAtom } from "nanostores";
import { el } from "redom";
import { type Button, createButton } from "./Button";
import {
  type ColorPicker,
  type ColorPickerSwatch,
  createColorPicker,
} from "./ColorPicker";
import { createDocumentAccessState } from "./DocumentAccessState";
import {
  createDropdownMenu,
  type DropdownMenu,
  type DropdownMenuEntry,
} from "./DropdownMenu";
import { type ButtonGridItemSpec, PagedButtonGrid } from "./PagedButtonGrid";
import type { ReDomLike } from "./ReDomLike";
import {
  createIconButton,
  type IconButton,
  type IconButtonLayout,
  type IconButtonSource,
} from "./SquareIconButton";
import { createStrokePicker, type StrokePicker } from "./StrokePicker";
import {
  createSyncIndicator,
  type SyncIndicator,
  type SyncIndicatorState,
} from "./SyncIndicator";
import type { SplatContextLayout } from "./splatContextLayout";
import { SplatContextResponsiveController } from "./SplatContextResponsiveController";
import { ToolPickerPopover } from "./ToolPickerPopover";
import { createToolbar } from "./toolbar/Toolbar";
import type { PagedButtonGridLargeLayout } from "./PagedButtonGrid";

export interface SplatToolItem extends ButtonGridItemSpec {
  label: string;
  icon: IconButtonSource;
  attributes?: Record<string, string>;
}

export interface SplatContextOptions {
  tools: SplatToolItem[];
  activeToolId: string;
  variants: SplatToolItem[];
  activeVariantId: string;
  colors: readonly ColorPickerSwatch[];
  selectedColor: string;
  strokeWidths: readonly number[];
  selectedStrokeWidth: number;
  desktopMenuEntries: readonly DropdownMenuEntry[];
  mobileMenuEntries: readonly DropdownMenuEntry[];
  syncState: SyncIndicatorState;
  status: HTMLOutputElement;
  variantLargeLayout?: PagedButtonGridLargeLayout;
  paginateVariantsInLarge?: boolean;
  variantButtonLayout?: IconButtonLayout;
  onSelectTool?: (toolId: string) => void;
  onSelectVariant?: (variantId: string) => void;
  onSelectColor?: (color: string) => void;
  onSelectStrokeWidth?: (strokeWidth: number) => void;
  onSelectAction?: (actionId: string) => void;
}

type Layout = SplatContextLayout;
type VariantGridPresentation = {
  largeLayout: PagedButtonGridLargeLayout;
  paginateInLarge: boolean;
  buttonLayout: IconButtonLayout;
};

export type SplatContextDocumentSlot =
  | {
      type: "document";
      content: HTMLElement;
    }
  | {
      type: "loading" | "error" | "none";
      title: string;
      description: string;
      message?: string;
    };

export class SplatContext implements ReDomLike<HTMLDivElement> {
  readonly el: HTMLDivElement;

  private readonly scene: HTMLDivElement;
  private readonly resizeObserver: ResizeObserver;
  private readonly responsiveController: SplatContextResponsiveController;
  private readonly disposers: Array<() => void> = [];
  private pendingResizeFrame: number | null = null;

  private readonly opts: SplatContextOptions;
  private readonly toolItemsStore: WritableAtom<SplatToolItem[]>;
  private readonly activeToolIdStore: WritableAtom<string>;
  private readonly variantItemsStore: WritableAtom<SplatToolItem[]>;
  private readonly activeVariantIdStore: WritableAtom<string>;
  private readonly variantPresentationStore: WritableAtom<VariantGridPresentation>;
  private readonly documentSlotStore: WritableAtom<SplatContextDocumentSlot>;

  private colorPicker!: ColorPicker;
  private strokePicker!: StrokePicker;
  private desktopMenu!: DropdownMenu;
  private mobileMenu!: DropdownMenu;
  private syncIndicator!: SyncIndicator;
  private desktopUndoButton?: Button;
  private desktopRedoButton?: Button;
  private desktopShareButton?: Button;
  private mobileShareButton?: Button;
  private canvasHost?: HTMLDivElement;

  private toolGrid?: PagedButtonGrid<SplatToolItem>;
  private mobileToolGrid?: PagedButtonGrid<SplatToolItem>;
  private mobileDropdownToolGrid?: PagedButtonGrid<SplatToolItem>;
  private mobileToolPicker?: ToolPickerPopover;

  private desktopVariantGrid?: PagedButtonGrid<SplatToolItem>;
  private mobileVariantGrid?: PagedButtonGrid<SplatToolItem>;
  private documentStateHost?: HTMLDivElement;

  constructor(options: SplatContextOptions) {
    this.opts = options;
    this.toolItemsStore = atom([...options.tools]);
    this.activeToolIdStore = atom(options.activeToolId);
    this.variantItemsStore = atom([...options.variants]);
    this.activeVariantIdStore = atom(options.activeVariantId);
    this.variantPresentationStore = atom({
      largeLayout: options.variantLargeLayout ?? "single-row",
      paginateInLarge: options.paginateVariantsInLarge ?? false,
      buttonLayout: options.variantButtonLayout ?? "large",
    });
    this.documentSlotStore = atom({
      type: "document",
      content: el("div.ds-splat-context__paper") as HTMLElement,
    });
    this.el = el("div.ds-splat-context__frame") as HTMLDivElement;
    this.scene = el("div.ds-splat-context__scene") as HTMLDivElement;
    this.el.append(this.scene);
    this.responsiveController = new SplatContextResponsiveController();

    this.initSharedComponents();
    this.bindState();

    this.resizeObserver = new ResizeObserver(() => {
      this.scheduleResizeSync();
    });
    this.resizeObserver.observe(this.el);

    this.rebuild();
    this.scheduleResizeSync();
  }

  onunmount(): void {
    this.resizeObserver.disconnect();
    if (this.pendingResizeFrame !== null) {
      this.cancelAnimationFrame(this.pendingResizeFrame);
      this.pendingResizeFrame = null;
    }
    for (const dispose of this.disposers) {
      dispose();
    }
    this.destroyOwnedViews();
  }

  setColors(colors: readonly ColorPickerSwatch[]): void {
    this.colorPicker.setColors(colors);
  }

  setSelectedColor(color: string): void {
    this.colorPicker.setSelectedColor(color);
  }

  setStrokeWidths(widths: readonly number[]): void {
    this.strokePicker.setStrokeWidths(widths);
  }

  setSelectedStrokeWidth(width: number): void {
    this.strokePicker.setSelectedStrokeWidth(width);
  }

  setColorPickerDisabled(disabled: boolean): void {
    this.colorPicker.setDisabled(disabled);
  }

  setStrokePickerDisabled(disabled: boolean): void {
    this.strokePicker.setDisabled(disabled);
  }

  setSyncState(state: SyncIndicatorState, description?: string): void {
    this.syncIndicator.setState(state, description);
  }

  setTools(tools: readonly SplatToolItem[]): void {
    this.toolItemsStore.set([...tools]);
  }

  setActiveToolId(toolId: string): void {
    this.activeToolIdStore.set(toolId);
  }

  setVariants(variants: readonly SplatToolItem[]): void {
    this.variantItemsStore.set([...variants]);
  }

  setActiveVariantId(variantId: string): void {
    this.activeVariantIdStore.set(variantId);
  }

  setVariantGridPresentation(options: {
    largeLayout: PagedButtonGridLargeLayout;
    paginateInLarge: boolean;
    buttonLayout: IconButtonLayout;
  }): void {
    const current = this.variantPresentationStore.get();
    if (
      options.largeLayout === current.largeLayout &&
      options.paginateInLarge === current.paginateInLarge &&
      options.buttonLayout === current.buttonLayout
    ) {
      return;
    }
    this.variantPresentationStore.set({ ...options });
  }

  setActionDisabled(actionId: string, disabled: boolean): void {
    switch (actionId) {
      case "undo":
        this.desktopUndoButton?.setDisabled(disabled);
        break;
      case "redo":
        this.desktopRedoButton?.setDisabled(disabled);
        break;
      case "share":
        this.desktopShareButton?.setDisabled(disabled);
        this.mobileShareButton?.setDisabled(disabled);
        break;
    }
    this.desktopMenu.setItemDisabled(actionId, disabled);
    this.mobileMenu.setItemDisabled(actionId, disabled);
  }

  setDocumentSlot(slot: SplatContextDocumentSlot): void {
    const current = this.documentSlotStore.get();
    if (isSameDocumentSlot(current, slot)) {
      return;
    }
    this.documentSlotStore.set(slot);
  }

  syncLayout(): void {
    this.scheduleResizeSync();
  }

  private setStatus(value: string): void {
    this.opts.status.value = value;
    this.opts.status.textContent = value;
  }

  private initSharedComponents(): void {
    this.colorPicker = createColorPicker({
      className: "ds-splat-context__top-picker",
      colors: this.opts.colors,
      selectedColor: this.opts.selectedColor,
      triggerLabel: "Colors",
    });
    this.colorPicker.setOnSelect((color) => {
      this.setStatus(`Color: ${color}`);
      this.opts.onSelectColor?.(color);
    });

    this.strokePicker = createStrokePicker({
      className: "ds-splat-context__top-picker",
      strokeWidths: this.opts.strokeWidths,
      selectedStrokeWidth: this.opts.selectedStrokeWidth,
      triggerLabel: "Strokes",
    });
    this.strokePicker.setOnSelect((width) => {
      this.setStatus(`Stroke width: ${width}px`);
      this.opts.onSelectStrokeWidth?.(width);
    });

    this.desktopMenu = createDropdownMenu({
      triggerKind: "button",
      triggerLabel: "Menu",
      triggerIcon: null,
      menuLabel: "More actions",
      entries: [...this.opts.desktopMenuEntries],
    });
    this.desktopMenu.setOnSelect((itemId) => {
      this.setStatus(`Desktop menu: ${itemId}`);
      this.desktopMenu.setOpen(false);
      this.opts.onSelectAction?.(itemId);
    });

    this.mobileMenu = createDropdownMenu({
      triggerKind: "button",
      triggerLabel: "Menu",
      triggerIcon: null,
      menuLabel: "More actions",
      entries: [...this.opts.mobileMenuEntries],
    });
    this.mobileMenu.setOnSelect((itemId) => {
      this.setStatus(`Mobile action: ${itemId}`);
      this.mobileMenu.setOpen(false);
      this.mobileToolPicker?.setOpen(false);
      this.opts.onSelectAction?.(itemId);
    });

    this.syncIndicator = createSyncIndicator({
      state: this.opts.syncState,
      kind: "caption",
    });
    this.syncIndicator.el.classList.add("ds-splat-context__sync-indicator");
  }

  private bindState(): void {
    this.disposers.push(
      this.toolItemsStore.subscribe(() => this.syncToolGrids()),
      this.activeToolIdStore.subscribe(() => this.syncToolGrids()),
      this.variantItemsStore.subscribe(() => this.syncVariantGrids()),
      this.activeVariantIdStore.subscribe(() => this.syncVariantGrids()),
      this.variantPresentationStore.subscribe(() => {
        this.syncVariantGridPresentation();
        this.scheduleResizeSync();
      }),
      this.documentSlotStore.subscribe(() => {
        this.rebuild();
        this.scheduleResizeSync();
      }),
    );
  }

  private scheduleResizeSync(): void {
    if (this.pendingResizeFrame !== null) {
      return;
    }

    this.pendingResizeFrame = this.requestAnimationFrame(() => {
      this.pendingResizeFrame = null;
      this.syncResponsiveLayout();
    });
  }

  private syncResponsiveLayout(): void {
    const rect = this.el.getBoundingClientRect();
    const update = this.responsiveController.update(rect.width, rect.height);

    if (update.effect === "sync-only") {
      this.syncVisibleResponsiveState();
      this.syncOwnedGridLayouts();
      return;
    }

    if (update.effect === "rebuild") {
      this.rebuild();
    } else {
      this.scene.dataset.mobileLayout = update.layout;
      this.syncVisibleResponsiveState();
    }
  }

  private syncVisibleResponsiveState(): void {
    this.syncMobileShareVisibility(
      this.responsiveController.getState().showMobileShare,
    );
  }

  private syncMobileShareVisibility(showMobileShare: boolean): void {
    if (!this.mobileShareButton) {
      return;
    }
    this.mobileShareButton.el.hidden = !showMobileShare;
  }

  private syncOwnedGridLayouts(): void {
    for (const grid of this.getOwnedGrids()) {
      grid.syncLayout();
    }
  }

  private createToolGrid(
    _items: SplatToolItem[],
    mode: "large" | "medium" | "mobile",
    orientation: "horizontal" | "vertical",
    largeLayout?: "two-row" | "two-row-xlarge" | "single-row",
  ): PagedButtonGrid<SplatToolItem> {
    return new PagedButtonGrid<SplatToolItem>({
      initialMode: mode,
      orientation,
      largeLayout,
      createItemComponent: (item) => {
        const btn = createIconButton({ label: item.label, icon: item.icon });
        for (const [name, value] of Object.entries(item.attributes ?? {})) {
          btn.el.setAttribute(name, value);
        }
        btn.setOnPress(() => this.selectTool(item.id));
        return btn;
      },
      updateItemComponent: (component, item) => {
        const btn = component as IconButton;
        btn.setPressed(item.id === this.activeToolIdStore.get());
      },
    });
  }

  private selectTool(toolId: string): void {
    this.activeToolIdStore.set(toolId);
    this.setStatus(`Tool: ${toolId}`);
    this.mobileToolPicker?.setOpen(false);
    this.opts.onSelectTool?.(toolId);
  }

  private syncToolGrids(): void {
    this.syncButtonGridGroup(
      this.getToolGrids(),
      this.toolItemsStore.get(),
      this.activeToolIdStore.get(),
    );
  }

  private initToolGrids(): void {
    const tools = [...this.toolItemsStore.get()];

    this.toolGrid = this.createToolGrid(tools, "large", "vertical");
    this.addClasses(
      this.toolGrid.el,
      "ds-splat-context__tool-selector",
      "ds-splat-context__grid-panel",
    );

    this.mobileToolGrid = this.createToolGrid(tools, "mobile", "horizontal");
    this.addClasses(
      this.mobileToolGrid.el,
      "ds-splat-context__tool-selector",
      "ds-splat-context__grid-panel",
      "ds-splat-context__tool-selector--mobile",
    );

    this.mobileDropdownToolGrid = this.createToolGrid(
      tools,
      "mobile",
      "horizontal",
    );
    this.addClasses(
      this.mobileDropdownToolGrid.el,
      "ds-splat-context__tool-selector",
      "ds-splat-context__tool-selector--mobile",
      "ds-splat-context__tool-selector--dropdown",
    );

    this.mobileToolPicker = new ToolPickerPopover();
    this.mobileToolPicker.setContent(this.mobileDropdownToolGrid.el);

    this.syncToolGrids();
  }

  private createVariantGrid(
    _items: SplatToolItem[],
    mode: "large" | "medium" | "mobile",
  ): PagedButtonGrid<SplatToolItem> {
    const presentation = this.variantPresentationStore.get();
    return new PagedButtonGrid<SplatToolItem>({
      initialMode: mode,
      orientation: "horizontal",
      largeLayout: presentation.largeLayout,
      paginateInLarge: mode === "large" && presentation.paginateInLarge,
      createItemComponent: (item) => {
        const btn = createIconButton({
          label: item.label,
          icon: item.icon,
          layout:
            mode === "large" ? presentation.buttonLayout : undefined,
        });
        for (const [name, value] of Object.entries(item.attributes ?? {})) {
          btn.el.setAttribute(name, value);
        }
        btn.setOnPress(() => this.selectVariant(item.id));
        return btn;
      },
      updateItemComponent: (component, item) => {
        const btn = component as IconButton;
        btn.setPressed(item.id === this.activeVariantIdStore.get());
        btn.setLayout(
          mode === "large"
            ? this.variantPresentationStore.get().buttonLayout
            : "small",
        );
      },
    });
  }

  private selectVariant(variantId: string): void {
    this.activeVariantIdStore.set(variantId);
    this.setStatus(`Variant: ${variantId}`);
    this.opts.onSelectVariant?.(variantId);
  }

  private syncVariantGrids(): void {
    this.syncButtonGridGroup(
      this.getVariantGrids(),
      this.variantItemsStore.get(),
      this.activeVariantIdStore.get(),
    );
  }

  private initVariantGrids(): void {
    const variants = [...this.variantItemsStore.get()];
    const presentation = this.variantPresentationStore.get();

    this.desktopVariantGrid = this.createVariantGrid(variants, "large");
    this.addClasses(
      this.desktopVariantGrid.el,
      "ds-splat-context__variant-strip",
    );
    this.desktopVariantGrid.el.setAttribute(
      "data-button-layout",
      presentation.buttonLayout,
    );
    if (presentation.buttonLayout === "large") {
      this.desktopVariantGrid.el.classList.add(
        "ds-splat-context__toolbar-scale-large",
      );
    }

    this.mobileVariantGrid = this.createVariantGrid(variants, "mobile");
    this.addClasses(
      this.mobileVariantGrid.el,
      "ds-splat-context__variant-strip",
      "ds-splat-context__variant-bar--mobile",
    );
    this.mobileVariantGrid.el.setAttribute("data-button-layout", "small");

    this.syncVariantGrids();
  }

  private syncVariantGridPresentation(): void {
    const presentation = this.variantPresentationStore.get();
    if (this.desktopVariantGrid) {
      this.desktopVariantGrid.setLargeLayout(presentation.largeLayout);
      this.desktopVariantGrid.setPaginateInLarge(
        presentation.paginateInLarge,
      );
      this.desktopVariantGrid.el.setAttribute(
        "data-button-layout",
        presentation.buttonLayout,
      );
      this.desktopVariantGrid.el.classList.toggle(
        "ds-splat-context__toolbar-scale-large",
        presentation.buttonLayout === "large",
      );
    }
    if (this.mobileVariantGrid) {
      this.mobileVariantGrid.setLargeLayout(presentation.largeLayout);
      this.mobileVariantGrid.setPaginateInLarge(false);
      this.mobileVariantGrid.el.setAttribute("data-button-layout", "small");
    }
    this.syncVariantGrids();
  }

  private rebuild(): void {
    this.destroyOwnedViews();
    this.scene.replaceChildren();

    if (this.responsiveController.getState().layout === "desktop") {
      this.buildDesktop();
    } else {
      this.buildMobile();
    }
  }

  private buildDesktop(): void {
    this.scene.className =
      "ds-splat-context__scene ds-splat-context__scene--desktop";
    const documentSlot = this.documentSlotStore.get();
    if (documentSlot.type !== "document") {
      this.scene.classList.add("ds-splat-context__scene--no-document");
      this.scene.append(
        this.createDesktopMenuTopSlot(),
        this.createNoDocumentShell(documentSlot),
      );
      return;
    }

    this.initToolGrids();
    this.initVariantGrids();

    this.scene.append(
      this.createDesktopTopSlot(),
      this.createDesktopLeftSlot(),
      this.createCanvasShell(documentSlot.content),
      this.createDesktopBottomLeftSlot(),
      this.createDesktopBottomSlot(),
    );
  }

  private buildMobile(): void {
    const { layout } = this.responsiveController.getState();

    this.scene.className =
      "ds-splat-context__scene ds-splat-context__scene--mobile ds-splat-context__scene--mobile-responsive";
    this.scene.dataset.mobileLayout = layout;
    const documentSlot = this.documentSlotStore.get();
    if (documentSlot.type !== "document") {
      this.scene.classList.add("ds-splat-context__scene--no-document");
      this.scene.append(
        this.createMobileMenuTopSection(),
        this.createNoDocumentShell(documentSlot, true),
      );
      this.syncVisibleResponsiveState();
      return;
    }

    this.initToolGrids();
    this.initVariantGrids();

    this.scene.append(
      this.createMobileTopSection(),
      this.createCanvasShell(documentSlot.content, true),
      this.createMobileBottomSection(),
    );
    this.syncVisibleResponsiveState();
  }

  private createDesktopTopSlot(): HTMLDivElement {
    const top = el(
      "div.ds-splat-context__slot ds-splat-context__slot--top",
    ) as HTMLDivElement;
    top.append(this.createDesktopTopBar().el);
    return top;
  }

  private createDesktopMenuTopSlot(): HTMLDivElement {
    const top = el(
      "div.ds-splat-context__slot ds-splat-context__slot--top",
    ) as HTMLDivElement;
    top.append(this.createDesktopMenuOnlyBar().el);
    return top;
  }

  private createDesktopTopBar() {
    const topBar = createToolbar({
      className: "ds-splat-context__top-actions",
    });
    const topBarStart = el(
      "div.ds-splat-context__top-actions-group ds-splat-context__top-actions-group--start",
      this.colorPicker.el,
      this.strokePicker.el,
    ) as HTMLDivElement;
    const topBarHistory = this.createDesktopHistoryActions();
    const topBarMenu = this.createDesktopMenuActions();

    topBar.el.append(topBarStart, topBarHistory, topBarMenu);
    return topBar;
  }

  private createDesktopMenuOnlyBar() {
    const topBar = createToolbar({
      className:
        "ds-splat-context__top-actions ds-splat-context__top-actions--menu-only",
    });
    topBar.el.append(this.createDesktopMenuOnlyActions());
    return topBar;
  }

  private createDesktopHistoryActions(): HTMLDivElement {
    const history = el(
      "div.ds-splat-context__top-actions-group ds-splat-context__top-actions-group--history",
    ) as HTMLDivElement;
    this.desktopUndoButton = this.createActionButton(
      "Undo",
      Undo2,
      "Desktop action",
      "undo",
    );
    this.desktopRedoButton = this.createActionButton(
      "Redo",
      Redo2,
      "Desktop action",
      "redo",
    );
    history.append(this.desktopUndoButton.el, this.desktopRedoButton.el);
    return history;
  }

  private createDesktopMenuActions(): HTMLDivElement {
    const actions = el(
      "div.ds-splat-context__top-actions-group ds-splat-context__top-actions-group--menu",
    ) as HTMLDivElement;
    this.desktopShareButton = this.createActionButton(
      "Share",
      Share2,
      "Desktop action",
      "share",
    );
    actions.append(
      this.syncIndicator.el,
      this.desktopShareButton.el,
      this.desktopMenu.el,
    );
    return actions;
  }

  private createDesktopMenuOnlyActions(): HTMLDivElement {
    return el(
      "div.ds-splat-context__top-actions-group ds-splat-context__top-actions-group--menu",
      this.desktopMenu.el,
    ) as HTMLDivElement;
  }

  private createDesktopLeftSlot(): HTMLDivElement {
    const left = el(
      "div.ds-splat-context__slot ds-splat-context__slot--left",
    ) as HTMLDivElement;
    const leftRail = createToolbar({
      orientation: "vertical",
      className: "ds-splat-context__left-rail",
    });
    const leftControls = el(
      "div.ds-splat-context__left-controls",
    ) as HTMLDivElement;
    leftRail.el.append(leftControls, this.toolGrid!.el);
    left.append(leftRail.el);
    return left;
  }

  private createDesktopBottomLeftSlot(): HTMLDivElement {
    return el(
      "div.ds-splat-context__slot ds-splat-context__slot--bottom-left",
    ) as HTMLDivElement;
  }

  private createDesktopBottomSlot(): HTMLDivElement {
    const bottom = el(
      "div.ds-splat-context__slot ds-splat-context__slot--bottom",
    ) as HTMLDivElement;
    bottom.append(this.desktopVariantGrid!.el);
    return bottom;
  }

  private createMobileTopSection(): HTMLDivElement {
    const top = el("div.ds-splat-context__mobile-top") as HTMLDivElement;
    top.append(
      this.createMobileTopControls(),
      this.createMobileInlineToolHost(),
    );
    return top;
  }

  private createMobileMenuTopSection(): HTMLDivElement {
    const top = el("div.ds-splat-context__mobile-top") as HTMLDivElement;
    top.append(this.createMobileMenuOnlyControls());
    return top;
  }

  private createMobileTopControls(): HTMLDivElement {
    const topControls = el(
      "div.ds-splat-context__mobile-top-controls",
      this.colorPicker.el,
      this.strokePicker.el,
      this.mobileToolPicker!.el,
      this.createMobileTrailingActions(),
    ) as HTMLDivElement;
    return topControls;
  }

  private createMobileMenuOnlyControls(): HTMLDivElement {
    return el(
      "div.ds-splat-context__mobile-top-controls ds-splat-context__mobile-top-controls--menu-only",
      this.mobileMenu.el,
    ) as HTMLDivElement;
  }

  private createMobileInlineToolHost(): HTMLDivElement {
    const inlineToolHost = el(
      "div.ds-splat-context__mobile-tool-inline-host",
    ) as HTMLDivElement;
    inlineToolHost.append(this.mobileToolGrid!.el);
    return inlineToolHost;
  }

  private createMobileTrailingActions(): HTMLDivElement {
    const trailingActions = el(
      "div.ds-splat-context__mobile-trailing-actions",
      this.syncIndicator.el,
    ) as HTMLDivElement;
    this.mobileShareButton = this.createActionButton(
      "Share",
      Share2,
      "Mobile action",
      "share",
    );
    trailingActions.append(this.mobileShareButton.el, this.mobileMenu.el);
    return trailingActions;
  }

  private createMobileBottomSection(): HTMLDivElement {
    const bottom = el("div.ds-splat-context__mobile-bottom") as HTMLDivElement;
    bottom.append(this.mobileVariantGrid!.el);
    return bottom;
  }

  private createCanvasShell(content: HTMLElement, mobile = false): HTMLDivElement {
    const canvas = el(
      mobile
        ? "div.ds-splat-context__canvas-shell ds-splat-context__canvas-shell--mobile"
        : "div.ds-splat-context__canvas-shell",
    ) as HTMLDivElement;
    this.canvasHost = el("div.ds-splat-context__canvas-host") as HTMLDivElement;
    canvas.append(this.canvasHost);
    this.canvasHost.replaceChildren(content);
    return canvas;
  }

  private createNoDocumentShell(
    slot: Exclude<SplatContextDocumentSlot, { type: "document" }>,
    mobile = false,
  ): HTMLDivElement {
    const shell = el(
      mobile
        ? "div.ds-splat-context__no-document-shell ds-splat-context__no-document-shell--mobile"
        : "div.ds-splat-context__no-document-shell",
    ) as HTMLDivElement;
    this.documentStateHost = el(
      "div.ds-splat-context__no-document-host",
    ) as HTMLDivElement;
    this.documentStateHost.append(createDocumentAccessState(slot).el);
    shell.append(this.documentStateHost);
    return shell;
  }

  private getToolGrids(): PagedButtonGrid<SplatToolItem>[] {
    return [
      this.toolGrid,
      this.mobileToolGrid,
      this.mobileDropdownToolGrid,
    ].filter((grid): grid is PagedButtonGrid<SplatToolItem> => Boolean(grid));
  }

  private getVariantGrids(): PagedButtonGrid<SplatToolItem>[] {
    return [this.desktopVariantGrid, this.mobileVariantGrid].filter(
      (grid): grid is PagedButtonGrid<SplatToolItem> => Boolean(grid),
    );
  }

  private getOwnedGrids(): PagedButtonGrid<SplatToolItem>[] {
    return [...this.getToolGrids(), ...this.getVariantGrids()];
  }

  private syncButtonGridGroup(
    grids: PagedButtonGrid<SplatToolItem>[],
    items: readonly SplatToolItem[],
    activeItemId: string,
  ): void {
    const nextItems = [...items];
    for (const grid of grids) {
      grid.setItems(nextItems);
      grid.setActiveItemId(activeItemId);
    }
  }

  private addClasses(element: HTMLElement, ...classNames: string[]): void {
    element.classList.add(...classNames);
  }

  private destroyOwnedViews(): void {
    for (const grid of this.getOwnedGrids()) {
      grid.destroy();
    }
    this.mobileToolPicker?.onunmount();
    this.toolGrid = undefined;
    this.mobileToolGrid = undefined;
    this.mobileDropdownToolGrid = undefined;
    this.mobileToolPicker = undefined;
    this.desktopVariantGrid = undefined;
    this.mobileVariantGrid = undefined;
    this.desktopUndoButton = undefined;
    this.desktopRedoButton = undefined;
    this.desktopShareButton = undefined;
    this.mobileShareButton = undefined;
    this.canvasHost = undefined;
    this.documentStateHost = undefined;
  }

  private createActionButton(
    label: string,
    icon: IconNode,
    statusPrefix: string,
    actionId: string,
  ): Button {
    const button = createButton({ label, icon });
    button.el.setAttribute("data-action", actionId);
    button.setOnPress(() => {
      this.setStatus(`${statusPrefix}: ${label}`);
      this.opts.onSelectAction?.(actionId);
    });
    return button;
  }

  private requestAnimationFrame(callback: FrameRequestCallback): number {
    if (typeof globalThis.requestAnimationFrame === "function") {
      return globalThis.requestAnimationFrame(callback);
    }
    return setTimeout(() => callback(Date.now()), 16) as unknown as number;
  }

  private cancelAnimationFrame(handle: number): void {
    if (typeof globalThis.cancelAnimationFrame === "function") {
      globalThis.cancelAnimationFrame(handle);
      return;
    }
    clearTimeout(handle);
  }
}

export function createSplatContext(options: SplatContextOptions): SplatContext {
  return new SplatContext(options);
}

function isSameDocumentSlot(
  a: SplatContextDocumentSlot,
  b: SplatContextDocumentSlot,
): boolean {
  if (a.type !== b.type) {
    return false;
  }
  if (a.type === "document" && b.type === "document") {
    return a.content === b.content;
  }
  if (a.type !== "document" && b.type !== "document") {
    return (
      a.title === b.title &&
      a.description === b.description &&
      a.message === b.message
    );
  }
  return false;
}
