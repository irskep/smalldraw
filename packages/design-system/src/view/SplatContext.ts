import type { IconNode } from "lucide";
import { Redo2, Share2, Undo2 } from "lucide";
import { el } from "redom";
import { type Button, createButton } from "./Button";
import {
  type ColorPicker,
  type ColorPickerSwatch,
  createColorPicker,
} from "./ColorPicker";
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

export interface SplatToolItem extends ButtonGridItemSpec {
  label: string;
  icon: IconButtonSource;
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
}

type Layout = SplatContextLayout;

export class SplatContext implements ReDomLike<HTMLDivElement> {
  readonly el: HTMLDivElement;

  private readonly scene: HTMLDivElement;
  private readonly resizeObserver: ResizeObserver;
  private readonly responsiveController: SplatContextResponsiveController;
  private pendingResizeFrame: number | null = null;

  private readonly opts: SplatContextOptions;

  private colorPicker!: ColorPicker;
  private strokePicker!: StrokePicker;
  private desktopMenu!: DropdownMenu;
  private mobileMenu!: DropdownMenu;
  private syncIndicator!: SyncIndicator;
  private mobileShareButton?: Button;

  private activeToolId = "";

  private toolGrid?: PagedButtonGrid<SplatToolItem>;
  private mobileToolGrid?: PagedButtonGrid<SplatToolItem>;
  private mobileDropdownToolGrid?: PagedButtonGrid<SplatToolItem>;
  private mobileToolPicker?: ToolPickerPopover;

  private activeVariantId = "";

  private desktopVariantGrid?: PagedButtonGrid<SplatToolItem>;
  private mobileVariantGrid?: PagedButtonGrid<SplatToolItem>;

  constructor(options: SplatContextOptions) {
    this.opts = options;
    this.el = el("div.ds-splat-context__frame") as HTMLDivElement;
    this.scene = el("div.ds-splat-context__scene") as HTMLDivElement;
    this.el.append(this.scene);
    this.responsiveController = new SplatContextResponsiveController();

    this.initSharedComponents();

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
      cancelAnimationFrame(this.pendingResizeFrame);
      this.pendingResizeFrame = null;
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

  setSyncState(state: SyncIndicatorState): void {
    this.syncIndicator.setState(state);
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
    });

    this.strokePicker = createStrokePicker({
      className: "ds-splat-context__top-picker",
      strokeWidths: this.opts.strokeWidths,
      selectedStrokeWidth: this.opts.selectedStrokeWidth,
      triggerLabel: "Strokes",
    });
    this.strokePicker.setOnSelect((width) => {
      this.setStatus(`Stroke width: ${width}px`);
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
    });

    this.syncIndicator = createSyncIndicator({
      state: this.opts.syncState,
      kind: "caption",
    });
    this.syncIndicator.el.classList.add("ds-splat-context__sync-indicator");
  }

  private scheduleResizeSync(): void {
    if (this.pendingResizeFrame !== null) {
      return;
    }

    this.pendingResizeFrame = requestAnimationFrame(() => {
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
        btn.setOnPress(() => this.selectTool(item.id));
        return btn;
      },
      updateItemComponent: (component, item) => {
        const btn = component as IconButton;
        btn.setPressed(item.id === this.activeToolId);
      },
    });
  }

  private selectTool(toolId: string): void {
    this.activeToolId = toolId;
    this.setStatus(`Tool: ${toolId}`);
    this.syncToolGrids();
    this.mobileToolPicker?.setOpen(false);
  }

  private syncToolGrids(): void {
    this.syncButtonGridGroup(
      this.getToolGrids(),
      this.opts.tools,
      this.activeToolId,
    );
  }

  private initToolGrids(): void {
    this.activeToolId = this.opts.activeToolId;
    const tools = [...this.opts.tools];

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
    return new PagedButtonGrid<SplatToolItem>({
      initialMode: mode,
      orientation: "horizontal",
      largeLayout: "single-row",
      paginateInLarge: mode === "large",
      createItemComponent: (item) => {
        const btn = createIconButton({
          label: item.label,
          icon: item.icon,
          layout: mode === "large" ? "large" : undefined,
        });
        btn.setOnPress(() => this.selectVariant(item.id));
        return btn;
      },
      updateItemComponent: (component, item) => {
        const btn = component as IconButton;
        btn.setPressed(item.id === this.activeVariantId);
      },
    });
  }

  private selectVariant(variantId: string): void {
    this.activeVariantId = variantId;
    this.setStatus(`Variant: ${variantId}`);
    this.syncVariantGrids();
  }

  private syncVariantGrids(): void {
    this.syncButtonGridGroup(
      this.getVariantGrids(),
      this.opts.variants,
      this.activeVariantId,
    );
  }

  private initVariantGrids(): void {
    this.activeVariantId = this.opts.activeVariantId;
    const variants = [...this.opts.variants];

    this.desktopVariantGrid = this.createVariantGrid(variants, "large");
    this.addClasses(
      this.desktopVariantGrid.el,
      "ds-splat-context__variant-strip",
      "ds-splat-context__toolbar-scale-large",
    );

    this.mobileVariantGrid = this.createVariantGrid(variants, "mobile");
    this.addClasses(
      this.mobileVariantGrid.el,
      "ds-splat-context__variant-strip",
      "ds-splat-context__variant-bar--mobile",
    );

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
    this.initToolGrids();
    this.initVariantGrids();

    this.scene.append(
      this.createDesktopTopSlot(),
      this.createDesktopLeftSlot(),
      this.createCanvasShell(),
      this.createDesktopBottomLeftSlot(),
      this.createDesktopBottomSlot(),
    );
  }

  private buildMobile(): void {
    const { layout } = this.responsiveController.getState();

    this.scene.className =
      "ds-splat-context__scene ds-splat-context__scene--mobile ds-splat-context__scene--mobile-responsive";
    this.scene.dataset.mobileLayout = layout;
    this.initToolGrids();
    this.initVariantGrids();

    this.scene.append(
      this.createMobileTopSection(),
      this.createCanvasShell(true),
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

  private createDesktopHistoryActions(): HTMLDivElement {
    const history = el(
      "div.ds-splat-context__top-actions-group ds-splat-context__top-actions-group--history",
    ) as HTMLDivElement;
    const undoButton = this.createActionButton("Undo", Undo2, "Desktop action");
    const redoButton = this.createActionButton("Redo", Redo2, "Desktop action");
    history.append(undoButton.el, redoButton.el);
    return history;
  }

  private createDesktopMenuActions(): HTMLDivElement {
    const actions = el(
      "div.ds-splat-context__top-actions-group ds-splat-context__top-actions-group--menu",
    ) as HTMLDivElement;
    const shareButton = this.createActionButton(
      "Share",
      Share2,
      "Desktop action",
    );
    actions.append(this.syncIndicator.el, shareButton.el, this.desktopMenu.el);
    return actions;
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
    );
    trailingActions.append(this.mobileShareButton.el, this.mobileMenu.el);
    return trailingActions;
  }

  private createMobileBottomSection(): HTMLDivElement {
    const bottom = el("div.ds-splat-context__mobile-bottom") as HTMLDivElement;
    bottom.append(this.mobileVariantGrid!.el);
    return bottom;
  }

  private createCanvasShell(mobile = false): HTMLDivElement {
    const canvas = el(
      mobile
        ? "div.ds-splat-context__canvas-shell ds-splat-context__canvas-shell--mobile"
        : "div.ds-splat-context__canvas-shell",
    ) as HTMLDivElement;
    canvas.append(
      el(
        mobile
          ? "div.ds-splat-context__paper ds-splat-context__paper--mobile"
          : "div.ds-splat-context__paper",
      ),
    );
    return canvas;
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
    this.mobileShareButton = undefined;
  }

  private createActionButton(
    label: string,
    icon: IconNode,
    statusPrefix: string,
  ): Button {
    const button = createButton({ label, icon });
    button.setOnPress(() => {
      this.setStatus(`${statusPrefix}: ${label}`);
    });
    return button;
  }
}

export function createSplatContext(options: SplatContextOptions): SplatContext {
  return new SplatContext(options);
}
