import type { IconNode } from "lucide";
import {
  Cat,
  Circle,
  Download,
  Eraser,
  FilePlus,
  FolderOpen,
  Highlighter,
  PaintBucket,
  Palette,
  Pen,
  Redo2,
  Share2,
  SlidersHorizontal,
  SprayCan,
  Trash2,
  Type,
  Undo2,
} from "lucide";
import { el } from "redom";
import {
  Button,
  createButton,
  createColorPicker,
  createDropdownMenu,
  createIconButton,
  createSyncIndicator,
  createStrokePicker,
  createToolbar,
  type DropdownMenuEntry,
  type IconButton,
  type SyncIndicatorState,
} from "../../src";
import { AnchoredPopoverController } from "../../src/view/AnchoredPopoverController";
import { buildGridDemo, type DemoGridItem } from "./gridDemo";
import { createResizeHandle } from "./ResizeHandle";
import type { HarnessStory } from "./types";

const MOBILE_SHORT_HEIGHT_PX = 360;

type ResponsiveMobileLayout = "mobile-standard" | "mobile-landscape-short";

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

const DESKTOP_TOOL_ITEMS: DemoGridItem[] = [
  { id: "brush", label: "Brush", icon: Pen },
  { id: "eraser", label: "Eraser", icon: Eraser },
  { id: "fill", label: "Fill", icon: PaintBucket },
  { id: "filled", label: "Filled", icon: FILLED_RECT_ICON },
  { id: "outline", label: "Outline", icon: Circle },
  { id: "letters", label: "Letters", icon: Type },
  { id: "stamps", label: "Stamps", icon: Cat },
];

const BRUSH_VARIANT_ITEMS: DemoGridItem[] = [
  { id: "marker", label: "Marker", icon: Highlighter },
  { id: "pen", label: "Pen", icon: Pen },
  { id: "spray-move", label: "Spray (Move)", icon: SprayCan },
  { id: "spray-hold", label: "Spray (Hold)", icon: SprayCan },
];

const MOBILE_TOOL_ITEMS: DemoGridItem[] = [
  { id: "brush", label: "Brush", icon: Pen },
  { id: "eraser", label: "Eraser", icon: Eraser },
  { id: "fill", label: "Fill", icon: PaintBucket },
  { id: "filled", label: "Filled", icon: FILLED_RECT_ICON },
  { id: "outline", label: "Outline", icon: Circle },
  { id: "letters", label: "Letters", icon: Type },
  { id: "stamps", label: "Stamps", icon: Cat },
];

const COLOR_SWATCHES = [
  "#000000",
  "#ffffff",
  "#9c682f",
  "#ff4a6a",
  "#ff8f0f",
  "#ffd95a",
  "#63c430",
  "#11b79b",
  "#3483ea",
  "#6755db",
  "#ea58b7",
  "#98a2b3",
] as const;

const STROKE_WIDTHS = [2, 4, 8, 16, 24, 48, 96, 200] as const;

const DESKTOP_MENU_ENTRIES: DropdownMenuEntry[] = [
  { id: "new-drawing", label: "New Drawing", icon: FilePlus },
  { id: "browse", label: "Browse Drawings", icon: FolderOpen },
  { id: "export", label: "Export PNG", icon: Download },
  { type: "separator" },
  { id: "clear", label: "Clear Canvas", icon: Trash2, danger: true },
];

const MOBILE_ACTIONS_MENU_ENTRIES: DropdownMenuEntry[] = [
  {
    type: "row",
    label: "History",
    items: [
      { id: "undo", label: "Undo", icon: Undo2 },
      { id: "redo", label: "Redo", icon: Redo2, disabled: true },
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

function createColorPickerControl(options: {
  className?: string;
  triggerLabel?: string;
  status: HTMLOutputElement;
}): HTMLElement {
  const picker = createColorPicker({
    className: options.className,
    colors: COLOR_SWATCHES.map((color) => ({ color })),
    selectedColor: "#000000",
    triggerLabel: options.triggerLabel ?? "Colors",
  });
  picker.setOnSelect((color) => {
    options.status.value = `Color: ${color}`;
    options.status.textContent = options.status.value;
  });
  return picker.el;
}

function createStrokePickerControl(options: {
  className?: string;
  triggerLabel?: string;
  status: HTMLOutputElement;
}): HTMLElement {
  const picker = createStrokePicker({
    className: options.className,
    strokeWidths: STROKE_WIDTHS,
    selectedStrokeWidth: 16,
    triggerLabel: options.triggerLabel ?? "Strokes",
  });
  picker.setOnSelect((strokeWidth) => {
    options.status.value = `Stroke width: ${strokeWidth}px`;
    options.status.textContent = options.status.value;
  });
  return picker.el;
}

function createTopActionButton(options: {
  label: string;
  icon: IconNode;
  status: HTMLOutputElement;
}): Button {
  const button = createButton({
    label: options.label,
    icon: options.icon,
  });
  button.setOnPress(() => {
    options.status.value = `Desktop action: ${options.label}`;
    options.status.textContent = options.status.value;
  });
  return button;
}

function createContextSyncIndicator(
  state: SyncIndicatorState,
): HTMLDivElement {
  const indicator = createSyncIndicator({
    state,
    kind: "caption",
  });
  indicator.el.classList.add("ds-splat-context__sync-indicator");
  return indicator.el;
}

class ToolPickerPopover {
  readonly el: HTMLDivElement;
  readonly triggerButton: IconButton;

  private readonly popover: HTMLDivElement;
  private readonly panel: HTMLDivElement;
  private readonly popoverController: AnchoredPopoverController;
  private isOpen = false;

  constructor() {
    this.el = el("div.ds-splat-context__tool-dropdown") as HTMLDivElement;
    this.triggerButton = createIconButton({
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
    this.popoverController = new AnchoredPopoverController({
      trigger: this.triggerButton,
      root: this.el,
      popover: this.popover,
      panel: this.panel,
      closeOnPointerLeave: true,
      onOpenChange: (open) => {
        this.isOpen = open;
      },
    });

    this.triggerButton.setOnPress(() => {
      this.setOpen(!this.isOpen);
    });
    this.el.append(this.triggerButton.el, this.popover);
  }

  setContent(content: HTMLElement): void {
    this.panel.replaceChildren(content);
  }

  setOpen(open: boolean): void {
    this.popoverController.setOpen(open);
  }
}

function createDesktopFrame(status: HTMLOutputElement): HTMLElement {
  const frame = el("section.ds-splat-context__frame") as HTMLElement;
  const stage = el(
    "div.ds-splat-context__scene ds-splat-context__scene--desktop",
  ) as HTMLDivElement;

  const top = el(
    "div.ds-splat-context__slot ds-splat-context__slot--top",
  ) as HTMLDivElement;
  const topBar = createToolbar({ className: "ds-splat-context__top-actions" });
  const topBarStart = el(
    "div.ds-splat-context__top-actions-group ds-splat-context__top-actions-group--start",
  ) as HTMLDivElement;
  const topBarHistory = el(
    "div.ds-splat-context__top-actions-group ds-splat-context__top-actions-group--history",
  ) as HTMLDivElement;
  const topBarMenu = el(
    "div.ds-splat-context__top-actions-group ds-splat-context__top-actions-group--menu",
  ) as HTMLDivElement;
  const undoButton = createTopActionButton({
    label: "Undo",
    icon: Undo2,
    status,
  });
  const redoButton = createTopActionButton({
    label: "Redo",
    icon: Redo2,
    status,
  });
  const shareButton = createTopActionButton({
    label: "Share",
    icon: Share2,
    status,
  });
  const syncIndicator = createContextSyncIndicator("online");
  const moreMenu = createDropdownMenu({
    triggerKind: "button",
    triggerLabel: "Menu",
    triggerIcon: null,
    menuLabel: "More actions",
    entries: DESKTOP_MENU_ENTRIES,
  });
  moreMenu.setOnSelect((itemId) => {
    status.value = `Desktop menu: ${itemId}`;
    status.textContent = status.value;
    moreMenu.setOpen(false);
  });
  topBarStart.append(
    createColorPickerControl({
      className: "ds-splat-context__top-picker",
      status,
    }),
    createStrokePickerControl({
      className: "ds-splat-context__top-picker",
      status,
    }),
  );
  topBarHistory.append(undoButton.el, redoButton.el);
  topBarMenu.append(syncIndicator, shareButton.el, moreMenu.el);
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
  const selector = buildGridDemo({
    items: DESKTOP_TOOL_ITEMS,
    mode: "large",
    orientation: "vertical",
  });
  selector.setActive("brush");
  selector.grid.el.classList.add(
    "ds-splat-context__tool-selector",
    "ds-splat-context__grid-panel",
  );
  leftRail.el.append(selector.grid.el);
  left.append(leftRail.el);

  const canvas = el("div.ds-splat-context__canvas-shell") as HTMLDivElement;
  canvas.append(el("div.ds-splat-context__paper"));

  const bottomLeft = el(
    "div.ds-splat-context__slot ds-splat-context__slot--bottom-left",
  ) as HTMLDivElement;

  const bottom = el(
    "div.ds-splat-context__slot ds-splat-context__slot--bottom",
  ) as HTMLDivElement;
  const variantBar = buildGridDemo({
    items: BRUSH_VARIANT_ITEMS,
    mode: "large",
    largeLayout: "single-row",
    itemLayout: "large",
  });
  variantBar.setActive("pen");
  variantBar.grid.el.classList.add(
    "ds-splat-context__variant-strip",
    "ds-splat-context__toolbar-scale-large",
  );
  bottom.append(variantBar.grid.el);

  stage.append(top, left, canvas, bottomLeft, bottom);
  frame.append(stage);
  return frame;
}

function createMobilePortraitFrame(status: HTMLOutputElement): HTMLElement {
  const frame = el("section.ds-splat-context__frame") as HTMLElement;
  const stage = el(
    "div.ds-splat-context__scene ds-splat-context__scene--mobile",
  ) as HTMLDivElement;

  const top = el("div.ds-splat-context__mobile-top") as HTMLDivElement;
  const selector = buildGridDemo({
    items: MOBILE_TOOL_ITEMS,
    mode: "mobile",
  });
  selector.setActive("brush");
  selector.grid.el.classList.add(
    "ds-splat-context__tool-selector",
    "ds-splat-context__grid-panel",
    "ds-splat-context__tool-selector--mobile",
  );
  const topControls = el(
    "div.ds-splat-context__mobile-top-controls",
  ) as HTMLDivElement;
  const colors = createColorPickerControl({
    className: "ds-splat-context__top-picker",
    status,
  });
  const strokes = createStrokePickerControl({
    className: "ds-splat-context__top-picker",
    status,
  });
  const actionsMenu = createDropdownMenu({
    triggerKind: "button",
    triggerLabel: "Menu",
    triggerIcon: null,
    menuLabel: "More actions",
    entries: MOBILE_ACTIONS_MENU_ENTRIES,
  });
  actionsMenu.setOnSelect((itemId) => {
    status.value = `Mobile action: ${itemId}`;
    status.textContent = status.value;
    actionsMenu.setOpen(false);
  });
  const syncIndicator = createContextSyncIndicator(
    "synced-to-server-but-offline",
  );
  const trailingActions = el(
    "div.ds-splat-context__mobile-trailing-actions",
    syncIndicator,
    actionsMenu.el,
  ) as HTMLDivElement;
  topControls.append(colors, strokes, trailingActions);
  top.append(topControls, selector.grid.el);

  const canvas = el(
    "div.ds-splat-context__canvas-shell ds-splat-context__canvas-shell--mobile",
  ) as HTMLDivElement;
  canvas.append(
    el("div.ds-splat-context__paper ds-splat-context__paper--mobile"),
  );

  const bottom = el("div.ds-splat-context__mobile-bottom") as HTMLDivElement;
  const mobileVariantBar = buildGridDemo({
    items: BRUSH_VARIANT_ITEMS,
    mode: "mobile",
  });
  mobileVariantBar.setActive("pen");
  mobileVariantBar.grid.el.classList.add(
    "ds-splat-context__variant-strip",
    "ds-splat-context__variant-bar--mobile",
  );
  bottom.append(mobileVariantBar.grid.el);

  stage.append(top, canvas, bottom);
  const resizer = createResizeHandle();
  frame.append(resizer.wrap(stage));
  return frame;
}

function resolveResponsiveMobileLayout(
  width: number,
  height: number,
): ResponsiveMobileLayout {
  if (width > height && height < MOBILE_SHORT_HEIGHT_PX) {
    return "mobile-landscape-short";
  }
  return "mobile-standard";
}

function createResponsiveMobileLandscapeFrame(
  status: HTMLOutputElement,
): HTMLElement {
  const frame = el("section.ds-splat-context__frame") as HTMLElement;
  const stage = el(
    "div.ds-splat-context__scene ds-splat-context__scene--mobile ds-splat-context__scene--mobile-responsive",
  ) as HTMLDivElement;
  stage.style.width = "640px";
  stage.style.height = "320px";

  const top = el("div.ds-splat-context__mobile-top") as HTMLDivElement;
  const topControls = el(
    "div.ds-splat-context__mobile-top-controls",
  ) as HTMLDivElement;
  const inlineToolHost = el(
    "div.ds-splat-context__mobile-tool-inline-host",
  ) as HTMLDivElement;

  const colors = createColorPickerControl({
    className: "ds-splat-context__top-picker",
    status,
  });
  const strokes = createStrokePickerControl({
    className: "ds-splat-context__top-picker",
    status,
  });
  const actionsMenu = createDropdownMenu({
    triggerKind: "button",
    triggerLabel: "Menu",
    triggerIcon: null,
    menuLabel: "More actions",
    entries: MOBILE_ACTIONS_MENU_ENTRIES,
  });
  actionsMenu.setOnSelect((itemId) => {
    status.value = `Mobile action: ${itemId}`;
    status.textContent = status.value;
    actionsMenu.setOpen(false);
  });
  const syncIndicator = createContextSyncIndicator("local-only");
  const trailingActions = el(
    "div.ds-splat-context__mobile-trailing-actions",
    syncIndicator,
    actionsMenu.el,
  ) as HTMLDivElement;

  const inlineSelector = buildGridDemo({
    items: MOBILE_TOOL_ITEMS,
    mode: "mobile",
  });
  const dropdownSelector = buildGridDemo({
    items: MOBILE_TOOL_ITEMS,
    mode: "mobile",
  });
  const setActiveTool = (toolId: string): void => {
    inlineSelector.setActive(toolId);
    dropdownSelector.setActive(toolId);
    status.value = `Tool: ${toolId}`;
    status.textContent = status.value;
    toolPickerPopover.setOpen(false);
  };
  const bindToolPickerSelection = (
    itemButtons: Map<string, IconButton>,
  ): void => {
    for (const item of MOBILE_TOOL_ITEMS) {
      itemButtons.get(item.id)?.setOnPress(() => {
        setActiveTool(item.id);
      });
    }
  };
  bindToolPickerSelection(inlineSelector.itemButtons);
  bindToolPickerSelection(dropdownSelector.itemButtons);

  inlineSelector.grid.el.classList.add(
    "ds-splat-context__tool-selector",
    "ds-splat-context__grid-panel",
    "ds-splat-context__tool-selector--mobile",
  );
  dropdownSelector.grid.el.classList.add(
    "ds-splat-context__tool-selector",
    "ds-splat-context__tool-selector--mobile",
    "ds-splat-context__tool-selector--dropdown",
  );
  inlineToolHost.append(inlineSelector.grid.el);

  const toolPickerPopover = new ToolPickerPopover();
  toolPickerPopover.setContent(dropdownSelector.grid.el);
  setActiveTool("brush");

  topControls.append(
    colors,
    strokes,
    toolPickerPopover.el,
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
  const variantBar = buildGridDemo({
    items: BRUSH_VARIANT_ITEMS,
    mode: "mobile",
  });
  variantBar.setActive("pen");
  variantBar.grid.el.classList.add(
    "ds-splat-context__variant-strip",
    "ds-splat-context__variant-bar--mobile",
  );
  bottom.append(variantBar.grid.el);

  stage.append(top, canvas, bottom);

  const applyLayout = (): void => {
    const nextLayout = resolveResponsiveMobileLayout(
      stage.clientWidth,
      stage.clientHeight,
    );
    stage.dataset.mobileLayout = nextLayout;
    if (nextLayout !== "mobile-landscape-short") {
      toolPickerPopover.setOpen(false);
    }
    status.value = `Mobile layout: ${nextLayout}`;
    status.textContent = status.value;
  };

  const resizeObserver = new ResizeObserver(() => {
    applyLayout();
  });
  resizeObserver.observe(stage);
  applyLayout();

  const resizer = createResizeHandle();
  frame.append(resizer.wrap(stage));
  return frame;
}

export const contextStories: HarnessStory[] = [
  {
    id: "desktop-context",
    title: "Desktop",
    description:
      "Reference desktop splat shell built from the ported design-system components.",
    mount: (container) => {
      const stack = el("div.ds-story-stack") as HTMLDivElement;
      const status = el(
        "output.ds-story-output",
        "Use the scene controls to inspect the desktop shell in context.",
      ) as HTMLOutputElement;

      stack.append(createDesktopFrame(status), status);
      container.replaceChildren(stack);
    },
  },
  {
    id: "mobile-portrait",
    title: "Mobile Portrait",
    description:
      "Reference mobile portrait splat shell built from the ported design-system components.",
    mount: (container) => {
      const stack = el("div.ds-story-stack") as HTMLDivElement;
      const status = el(
        "output.ds-story-output",
        "Use the scene controls to inspect the mobile portrait shell in context.",
      ) as HTMLOutputElement;

      stack.append(createMobilePortraitFrame(status), status);
      container.replaceChildren(stack);
    },
  },
  {
    id: "mobile-landscape",
    title: "Mobile Landscape",
    description:
      "Responsive mobile shell story with explicit macro-layout states. In short landscape heights below 360px, the inline tool picker is hidden and moved behind a top-bar dropdown trigger.",
    mount: (container) => {
      const stack = el("div.ds-story-stack") as HTMLDivElement;
      const status = el(
        "output.ds-story-output",
        "Resize the frame taller than 360px to return to the standard mobile layout.",
      ) as HTMLOutputElement;
      stack.append(createResponsiveMobileLandscapeFrame(status), status);
      container.replaceChildren(stack);
    },
  },
];
