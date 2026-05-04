import type { IconNode } from "lucide";
import { Pen, Redo2, Share2, Undo2 } from "lucide";
import { el } from "redom";
import { AnchoredPopoverController } from "./AnchoredPopoverController";
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

type Layout = "desktop" | "mobile-standard" | "mobile-landscape-short";

const MOBILE_THRESHOLD_PX = 580;
const MOBILE_SHORT_HEIGHT_PX = 360;
const MOBILE_SHARE_THRESHOLD_PX = 480;

class ToolPickerPopover {
  readonly el: HTMLDivElement;
  readonly trigger: IconButton;

  private readonly popover: HTMLDivElement;
  private readonly panel: HTMLDivElement;
  private readonly controller: AnchoredPopoverController;
  private isOpen = false;

  constructor() {
    this.el = el("div.ds-splat-context__tool-dropdown") as HTMLDivElement;
    this.trigger = createIconButton({
      className: "ds-splat-context__tool-menu-trigger",
      label: "Tools",
      icon: Pen,
      dropdown: true,
      attributes: {
        "aria-haspopup": "dialog",
        "aria-expanded": "false",
        title: "Show tools",
      },
    });
    this.panel = el("div.ds-splat-context__tool-dropdown-panel", {
      role: "dialog",
      "aria-label": "Tool picker",
    }) as HTMLDivElement;
    this.popover = el(
      "div.ds-splat-context__tool-dropdown-popover",
      { "aria-hidden": "true" },
      this.panel,
    ) as HTMLDivElement;
    this.popover.dataset.open = "false";
    this.popover.hidden = true;
    this.controller = new AnchoredPopoverController({
      trigger: this.trigger,
      root: this.el,
      popover: this.popover,
      panel: this.panel,
      closeOnPointerLeave: true,
      onOpenChange: (open) => {
        this.isOpen = open;
      },
    });

    this.trigger.setOnPress(() => {
      this.setOpen(!this.isOpen);
    });
    this.el.append(this.trigger.el, this.popover);
  }

  setContent(content: HTMLElement): void {
    this.panel.replaceChildren(content);
  }

  setOpen(open: boolean): void {
    this.controller.setOpen(open);
  }
}

export class SplatContext implements ReDomLike<HTMLDivElement> {
  readonly el: HTMLDivElement;

  private readonly scene: HTMLDivElement;
  private readonly resizeObserver: ResizeObserver;
  private pendingResizeFrame: number | null = null;
  private currentLayout: Layout = "desktop";

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

  private initSharedComponents(): void {
    this.colorPicker = createColorPicker({
      className: "ds-splat-context__top-picker",
      colors: this.opts.colors,
      selectedColor: this.opts.selectedColor,
      triggerLabel: "Colors",
    });
    this.colorPicker.setOnSelect((color) => {
      this.opts.status.value = `Color: ${color}`;
      this.opts.status.textContent = this.opts.status.value;
    });

    this.strokePicker = createStrokePicker({
      className: "ds-splat-context__top-picker",
      strokeWidths: this.opts.strokeWidths,
      selectedStrokeWidth: this.opts.selectedStrokeWidth,
      triggerLabel: "Strokes",
    });
    this.strokePicker.setOnSelect((width) => {
      this.opts.status.value = `Stroke width: ${width}px`;
      this.opts.status.textContent = this.opts.status.value;
    });

    this.desktopMenu = createDropdownMenu({
      triggerKind: "button",
      triggerLabel: "Menu",
      triggerIcon: null,
      menuLabel: "More actions",
      entries: [...this.opts.desktopMenuEntries],
    });
    this.desktopMenu.setOnSelect((itemId) => {
      this.opts.status.value = `Desktop menu: ${itemId}`;
      this.opts.status.textContent = this.opts.status.value;
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
      this.opts.status.value = `Mobile action: ${itemId}`;
      this.opts.status.textContent = this.opts.status.value;
      this.mobileMenu.setOpen(false);
      this.mobileToolPicker?.setOpen(false);
    });

    this.syncIndicator = createSyncIndicator({
      state: this.opts.syncState,
      kind: "caption",
    });
    this.syncIndicator.el.classList.add("ds-splat-context__sync-indicator");
  }

  private resolveLayout(width: number, height: number): Layout {
    if (width >= MOBILE_THRESHOLD_PX && height >= MOBILE_THRESHOLD_PX)
      return "desktop";
    if (width > height && height < MOBILE_SHORT_HEIGHT_PX)
      return "mobile-landscape-short";
    return "mobile-standard";
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
    const nextLayout = this.resolveLayout(rect.width, rect.height);
    if (nextLayout === this.currentLayout) {
      this.syncMobileShareVisibility(rect.width);
      this.toolGrid?.syncLayout();
      this.mobileToolGrid?.syncLayout();
      this.mobileDropdownToolGrid?.syncLayout();
      this.desktopVariantGrid?.syncLayout();
      this.mobileVariantGrid?.syncLayout();
      return;
    }

    const wasDesktop = this.currentLayout === "desktop";
    const isDesktop = nextLayout === "desktop";
    this.currentLayout = nextLayout;

    if (wasDesktop || isDesktop) {
      this.rebuild();
    } else {
      this.scene.dataset.mobileLayout = nextLayout;
      this.syncMobileShareVisibility(rect.width);
    }
  }

  private syncMobileShareVisibility(width: number): void {
    if (!this.mobileShareButton) {
      return;
    }
    this.mobileShareButton.el.hidden = width < MOBILE_SHARE_THRESHOLD_PX;
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
    this.opts.status.value = `Tool: ${toolId}`;
    this.opts.status.textContent = this.opts.status.value;
    this.syncToolGrids();
    this.mobileToolPicker?.setOpen(false);
  }

  private syncToolGrids(): void {
    const tools = [...this.opts.tools];
    this.toolGrid?.setItems(tools);
    this.toolGrid?.setActiveItemId(this.activeToolId);
    this.mobileToolGrid?.setItems(tools);
    this.mobileToolGrid?.setActiveItemId(this.activeToolId);
    this.mobileDropdownToolGrid?.setItems(tools);
    this.mobileDropdownToolGrid?.setActiveItemId(this.activeToolId);
  }

  private initToolGrids(): void {
    this.activeToolId = this.opts.activeToolId;
    const tools = [...this.opts.tools];

    this.toolGrid = this.createToolGrid(tools, "large", "vertical");
    this.toolGrid.el.classList.add(
      "ds-splat-context__tool-selector",
      "ds-splat-context__grid-panel",
    );

    this.mobileToolGrid = this.createToolGrid(tools, "mobile", "horizontal");
    this.mobileToolGrid.el.classList.add(
      "ds-splat-context__tool-selector",
      "ds-splat-context__grid-panel",
      "ds-splat-context__tool-selector--mobile",
    );

    this.mobileDropdownToolGrid = this.createToolGrid(
      tools,
      "mobile",
      "horizontal",
    );
    this.mobileDropdownToolGrid.el.classList.add(
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
    this.opts.status.value = `Variant: ${variantId}`;
    this.opts.status.textContent = this.opts.status.value;
    this.syncVariantGrids();
  }

  private syncVariantGrids(): void {
    const variants = [...this.opts.variants];
    this.desktopVariantGrid?.setItems(variants);
    this.desktopVariantGrid?.setActiveItemId(this.activeVariantId);
    this.mobileVariantGrid?.setItems(variants);
    this.mobileVariantGrid?.setActiveItemId(this.activeVariantId);
  }

  private initVariantGrids(): void {
    this.activeVariantId = this.opts.activeVariantId;
    const variants = [...this.opts.variants];

    this.desktopVariantGrid = this.createVariantGrid(variants, "large");
    this.desktopVariantGrid.el.classList.add(
      "ds-splat-context__variant-strip",
      "ds-splat-context__toolbar-scale-large",
    );

    this.mobileVariantGrid = this.createVariantGrid(variants, "mobile");
    this.mobileVariantGrid.el.classList.add(
      "ds-splat-context__variant-strip",
      "ds-splat-context__variant-bar--mobile",
    );

    this.syncVariantGrids();
  }

  private rebuild(): void {
    this.scene.replaceChildren();
    this.toolGrid = undefined;
    this.mobileToolGrid = undefined;
    this.mobileDropdownToolGrid = undefined;
    this.mobileToolPicker = undefined;
    this.desktopVariantGrid = undefined;
    this.mobileVariantGrid = undefined;
    this.mobileShareButton = undefined;

    if (this.currentLayout === "desktop") {
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

    const top = el(
      "div.ds-splat-context__slot ds-splat-context__slot--top",
    ) as HTMLDivElement;
    const topBar = createToolbar({
      className: "ds-splat-context__top-actions",
    });
    const topBarStart = el(
      "div.ds-splat-context__top-actions-group ds-splat-context__top-actions-group--start",
    ) as HTMLDivElement;
    const topBarHistory = el(
      "div.ds-splat-context__top-actions-group ds-splat-context__top-actions-group--history",
    ) as HTMLDivElement;
    const topBarMenu = el(
      "div.ds-splat-context__top-actions-group ds-splat-context__top-actions-group--menu",
    ) as HTMLDivElement;

    topBarStart.append(this.colorPicker.el, this.strokePicker.el);

    const undoButton = this.createActionButton("Undo", Undo2, "Desktop action");
    const redoButton = this.createActionButton("Redo", Redo2, "Desktop action");
    topBarHistory.append(undoButton.el, redoButton.el);

    const shareButton = this.createActionButton(
      "Share",
      Share2,
      "Desktop action",
    );
    topBarMenu.append(
      this.syncIndicator.el,
      shareButton.el,
      this.desktopMenu.el,
    );

    topBar.el.append(topBarStart, topBarHistory, topBarMenu);
    top.append(topBar.el);

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
    leftRail.el.append(leftControls);
    leftRail.el.append(this.toolGrid!.el);
    left.append(leftRail.el);

    const canvas = el("div.ds-splat-context__canvas-shell") as HTMLDivElement;
    canvas.append(el("div.ds-splat-context__paper"));

    const bottomLeft = el(
      "div.ds-splat-context__slot ds-splat-context__slot--bottom-left",
    ) as HTMLDivElement;

    const bottom = el(
      "div.ds-splat-context__slot ds-splat-context__slot--bottom",
    ) as HTMLDivElement;
    bottom.append(this.desktopVariantGrid!.el);

    this.scene.append(top, left, canvas, bottomLeft, bottom);
  }

  private buildMobile(): void {
    this.scene.className =
      "ds-splat-context__scene ds-splat-context__scene--mobile ds-splat-context__scene--mobile-responsive";
    this.scene.dataset.mobileLayout = this.currentLayout;
    this.initToolGrids();
    this.initVariantGrids();

    const top = el("div.ds-splat-context__mobile-top") as HTMLDivElement;
    const topControls = el(
      "div.ds-splat-context__mobile-top-controls",
    ) as HTMLDivElement;

    const inlineToolHost = el(
      "div.ds-splat-context__mobile-tool-inline-host",
    ) as HTMLDivElement;
    inlineToolHost.append(this.mobileToolGrid!.el);

    const trailingActions = el(
      "div.ds-splat-context__mobile-trailing-actions",
      this.syncIndicator.el,
    ) as HTMLDivElement;
    this.mobileShareButton = this.createActionButton("Share", Share2, "Mobile action");
    trailingActions.append(this.mobileShareButton.el, this.mobileMenu.el);

    topControls.append(
      this.colorPicker.el,
      this.strokePicker.el,
      this.mobileToolPicker!.el,
      trailingActions,
    );
    top.append(topControls, inlineToolHost);

    const canvas = el(
      "div.ds-splat-context__canvas-shell ds-splat-context__canvas-shell--mobile",
    ) as HTMLDivElement;
    canvas.append(
      el("div.ds-splat-context__paper ds-splat-context__paper--mobile"),
    );

    const bottom = el("div.ds-splat-context__mobile-bottom") as HTMLDivElement;
    bottom.append(this.mobileVariantGrid!.el);

    this.scene.append(top, canvas, bottom);
    this.syncMobileShareVisibility(this.el.getBoundingClientRect().width);
  }

  private createActionButton(
    label: string,
    icon: IconNode,
    statusPrefix: string,
  ): Button {
    const button = createButton({ label, icon });
    button.setOnPress(() => {
      this.opts.status.value = `${statusPrefix}: ${label}`;
      this.opts.status.textContent = this.opts.status.value;
    });
    return button;
  }
}

export function createSplatContext(options: SplatContextOptions): SplatContext {
  return new SplatContext(options);
}
