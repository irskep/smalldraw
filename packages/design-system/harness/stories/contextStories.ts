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
  Pen,
  Redo2,
  Share2,
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
const MOBILE_SHARE_THRESHOLD_PX = 480;

type ResponsiveMobileLayout = "mobile-standard" | "mobile-landscape-short";
type ResponsiveContextLayout =
  | "desktop"
  | "mobile-portrait"
  | "mobile-landscape";

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

const TOOL_ITEMS: DemoGridItem[] = [
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

function setStoryStatus(status: HTMLOutputElement, value: string): void {
  status.value = value;
  status.textContent = value;
}

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
    setStoryStatus(options.status, `Color: ${color}`);
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
    setStoryStatus(options.status, `Stroke width: ${strokeWidth}px`);
  });
  return picker.el;
}

function createTopActionButton(options: {
  label: string;
  icon: IconNode;
  status: HTMLOutputElement;
  statusPrefix?: string;
}): Button {
  const button = createButton({
    label: options.label,
    icon: options.icon,
  });
  button.setOnPress(() => {
    setStoryStatus(
      options.status,
      `${options.statusPrefix ?? "Desktop action"}: ${options.label}`,
    );
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

function createDesktopMenu(status: HTMLOutputElement) {
  const menu = createDropdownMenu({
    triggerKind: "button",
    triggerLabel: "Menu",
    triggerIcon: null,
    menuLabel: "More actions",
    entries: DESKTOP_MENU_ENTRIES,
  });
  menu.setOnSelect((itemId) => {
    setStoryStatus(status, `Desktop menu: ${itemId}`);
    menu.setOpen(false);
  });
  return menu;
}

function createMobileActionsMenu(status: HTMLOutputElement) {
  const menu = createDropdownMenu({
    triggerKind: "button",
    triggerLabel: "Menu",
    triggerIcon: null,
    menuLabel: "More actions",
    entries: MOBILE_ACTIONS_MENU_ENTRIES,
  });
  menu.setOnSelect((itemId) => {
    setStoryStatus(status, `Mobile action: ${itemId}`);
    menu.setOpen(false);
  });
  return menu;
}

function createCanvasShell(mobile = false): HTMLDivElement {
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

function createVariantBar(options: {
  mobile: boolean;
  activeId: string;
}): ReturnType<typeof buildGridDemo> {
  const variantBar = buildGridDemo({
    items: BRUSH_VARIANT_ITEMS,
    mode: options.mobile ? "mobile" : "large",
    paginateInLarge: !options.mobile,
    ...(options.mobile
      ? {}
      : { largeLayout: "single-row" as const, itemLayout: "large" as const }),
  });
  variantBar.setActive(options.activeId);
  variantBar.grid.el.classList.add(
    "ds-splat-context__variant-strip",
    options.mobile
      ? "ds-splat-context__variant-bar--mobile"
      : "ds-splat-context__toolbar-scale-large",
  );
  return variantBar;
}

function createToolGrid(options: {
  items: DemoGridItem[];
  mode: "large" | "mobile";
  orientation?: "horizontal" | "vertical";
  activeId: string;
  classNames: string[];
}) {
  const grid = buildGridDemo({
    items: options.items,
    mode: options.mode,
    ...(options.orientation ? { orientation: options.orientation } : {}),
  });
  grid.setActive(options.activeId);
  grid.grid.el.classList.add(...options.classNames);
  return grid;
}

function createMobileTopControls(options: {
  status: HTMLOutputElement;
  syncState: SyncIndicatorState;
  extraLeading?: HTMLElement | null;
  trailingMenu?: HTMLElement | null;
  shareButton?: HTMLElement | null;
}): HTMLDivElement {
  const topControls = el(
    "div.ds-splat-context__mobile-top-controls",
  ) as HTMLDivElement;
  const colors = createColorPickerControl({
    className: "ds-splat-context__top-picker",
    status: options.status,
  });
  const strokes = createStrokePickerControl({
    className: "ds-splat-context__top-picker",
    status: options.status,
  });
  const trailingActions = el(
    "div.ds-splat-context__mobile-trailing-actions",
    createContextSyncIndicator(options.syncState),
  ) as HTMLDivElement;
  if (options.shareButton) {
    trailingActions.append(options.shareButton);
  }
  if (options.trailingMenu) {
    trailingActions.append(options.trailingMenu);
  }

  topControls.append(colors, strokes);
  if (options.extraLeading) {
    topControls.append(options.extraLeading);
  }
  topControls.append(trailingActions);
  return topControls;
}

function createDesktopTopSection(status: HTMLOutputElement): HTMLDivElement {
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
  topBarHistory.append(
    createTopActionButton({ label: "Undo", icon: Undo2, status }).el,
    createTopActionButton({ label: "Redo", icon: Redo2, status }).el,
  );
  topBarMenu.append(
    createContextSyncIndicator("online"),
    createTopActionButton({ label: "Share", icon: Share2, status }).el,
    createDesktopMenu(status).el,
  );

  topBar.el.append(topBarStart, topBarHistory, topBarMenu);
  top.append(topBar.el);
  return top;
}

function createDesktopLeftSection(): HTMLDivElement {
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
  leftRail.el.append(
    createToolGrid({
      items: TOOL_ITEMS,
      mode: "large",
      orientation: "vertical",
      activeId: "brush",
      classNames: [
        "ds-splat-context__tool-selector",
        "ds-splat-context__grid-panel",
      ],
    }).grid.el,
  );
  left.append(leftRail.el);
  return left;
}

function createDesktopBottomSection(): HTMLDivElement {
  const bottom = el(
    "div.ds-splat-context__slot ds-splat-context__slot--bottom",
  ) as HTMLDivElement;
  bottom.append(createVariantBar({ mobile: false, activeId: "pen" }).grid.el);
  return bottom;
}

function createMobileBottomSection(): HTMLDivElement {
  const bottom = el("div.ds-splat-context__mobile-bottom") as HTMLDivElement;
  bottom.append(createVariantBar({ mobile: true, activeId: "pen" }).grid.el);
  return bottom;
}

function createMobileToolSection(options: {
  status: HTMLOutputElement;
  syncState: SyncIndicatorState;
  responsive: boolean;
  shareButton: HTMLElement;
}): {
  top: HTMLDivElement;
  getActiveLayout: (() => ResponsiveMobileLayout) | null;
} {
  const top = el("div.ds-splat-context__mobile-top") as HTMLDivElement;

  if (!options.responsive) {
    const selector = createToolGrid({
      items: TOOL_ITEMS,
      mode: "mobile",
      activeId: "brush",
      classNames: [
        "ds-splat-context__tool-selector",
        "ds-splat-context__grid-panel",
        "ds-splat-context__tool-selector--mobile",
      ],
    });
    const topControls = createMobileTopControls({
      status: options.status,
      syncState: options.syncState,
      shareButton: options.shareButton,
      trailingMenu: createMobileActionsMenu(options.status).el,
    });
    top.append(topControls, selector.grid.el);
    return { top, getActiveLayout: null };
  }

  const inlineToolHost = el(
    "div.ds-splat-context__mobile-tool-inline-host",
  ) as HTMLDivElement;
  const inlineSelector = createToolGrid({
    items: TOOL_ITEMS,
    mode: "mobile",
    activeId: "brush",
    classNames: [
      "ds-splat-context__tool-selector",
      "ds-splat-context__grid-panel",
      "ds-splat-context__tool-selector--mobile",
    ],
  });
  const dropdownSelector = createToolGrid({
    items: TOOL_ITEMS,
    mode: "mobile",
    activeId: "brush",
    classNames: [
      "ds-splat-context__tool-selector",
      "ds-splat-context__tool-selector--mobile",
      "ds-splat-context__tool-selector--dropdown",
    ],
  });
  const toolPickerPopover = new ToolPickerPopover();

  const setActiveTool = (toolId: string): void => {
    inlineSelector.setActive(toolId);
    dropdownSelector.setActive(toolId);
    setStoryStatus(options.status, `Tool: ${toolId}`);
    toolPickerPopover.setOpen(false);
  };

  const bindToolPickerSelection = (
    itemButtons: Map<string, IconButton>,
  ): void => {
    for (const item of TOOL_ITEMS) {
      itemButtons.get(item.id)?.setOnPress(() => {
        setActiveTool(item.id);
      });
    }
  };

  bindToolPickerSelection(inlineSelector.itemButtons);
  bindToolPickerSelection(dropdownSelector.itemButtons);
  inlineToolHost.append(inlineSelector.grid.el);

  toolPickerPopover.setContent(dropdownSelector.grid.el);
  setActiveTool("brush");

  const topControls = createMobileTopControls({
    status: options.status,
    syncState: options.syncState,
    extraLeading: toolPickerPopover.el,
    shareButton: options.shareButton,
    trailingMenu: createMobileActionsMenu(options.status).el,
  });
  top.append(topControls, inlineToolHost);

  const getActiveLayout = (): ResponsiveMobileLayout => {
    const width = top.parentElement?.clientWidth ?? 0;
    const height = top.parentElement?.clientHeight ?? 0;
    return resolveResponsiveMobileLayout(width, height);
  };

  return { top, getActiveLayout };
}

function createMobileStage(options: {
  status: HTMLOutputElement;
  syncState: SyncIndicatorState;
  responsive: boolean;
}): HTMLDivElement {
  const stageClassName = options.responsive
    ? "div.ds-splat-context__scene ds-splat-context__scene--mobile ds-splat-context__scene--mobile-responsive"
    : "div.ds-splat-context__scene ds-splat-context__scene--mobile";
  const stage = el(stageClassName) as HTMLDivElement;
  const shareButton = createTopActionButton({
    label: "Share",
    icon: Share2,
    status: options.status,
    statusPrefix: "Mobile action",
  });
  const { top, getActiveLayout } = createMobileToolSection({
    status: options.status,
    syncState: options.syncState,
    responsive: options.responsive,
    shareButton: shareButton.el,
  });
  const canvas = createCanvasShell(true);
  const bottom = createMobileBottomSection();

  stage.append(top, canvas, bottom);

  const applyLayout = (): void => {
    shareButton.el.hidden =
      stage.getBoundingClientRect().width < MOBILE_SHARE_THRESHOLD_PX;
    if (options.responsive && getActiveLayout) {
      const nextLayout = getActiveLayout();
      stage.dataset.mobileLayout = nextLayout;
    }
  };

  const resizeObserver = new ResizeObserver(() => {
    applyLayout();
  });
  resizeObserver.observe(stage);
  applyLayout();
  return stage;
}

function createWrappedContextFrame(
  stage: HTMLElement,
  width?: number,
  height?: number,
): HTMLElement {
  if (typeof width === "number") {
    stage.style.width = `${width}px`;
  }
  if (typeof height === "number") {
    stage.style.height = `${height}px`;
  }
  const frame = el("section.ds-splat-context__frame") as HTMLElement;
  const resizer = createResizeHandle();
  frame.append(resizer.wrap(stage));
  return frame;
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
  const stage = el(
    "div.ds-splat-context__scene ds-splat-context__scene--desktop",
  ) as HTMLDivElement;
  const top = createDesktopTopSection(status);
  const left = createDesktopLeftSection();
  const canvas = createCanvasShell();
  const bottomLeft = el(
    "div.ds-splat-context__slot ds-splat-context__slot--bottom-left",
  ) as HTMLDivElement;
  const bottom = createDesktopBottomSection();

  stage.append(top, left, canvas, bottomLeft, bottom);
  return createWrappedContextFrame(stage);
}

function createMobilePortraitFrame(status: HTMLOutputElement): HTMLElement {
  const stage = createMobileStage({
    status,
    syncState: "synced-to-server-but-offline",
    responsive: false,
  });
  return createWrappedContextFrame(stage);
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
  const stage = createMobileStage({
    status,
    syncState: "local-only",
    responsive: true,
  });
  return createWrappedContextFrame(stage, 640, 320);
}

function extractResponsiveScene(frame: HTMLElement): HTMLDivElement {
  const scene = frame.querySelector(".ds-splat-context__scene");
  if (!(scene instanceof HTMLDivElement)) {
    throw new Error("Expected responsive context scene");
  }
  scene.classList.add("ds-splat-context__scene--responsive-hosted");
  scene.style.width = "100%";
  scene.style.height = "100%";
  return scene;
}

function resolveResponsiveContextLayout(
  width: number,
  height: number,
): ResponsiveContextLayout {
  if (width > height && height < MOBILE_SHORT_HEIGHT_PX) {
    return "mobile-landscape";
  }
  if (width >= 580 && height >= 580) {
    return "desktop";
  }
  return "mobile-portrait";
}

function createResponsiveContextFrame(status: HTMLOutputElement): HTMLElement {
  const frame = el("section.ds-splat-context__frame") as HTMLElement;
  frame.style.width = "960px";
  frame.style.height = "640px";
  return createResponsiveContextFrameWithDefaults(frame, status);
}

function createResponsiveContextFrameWithSize(
  status: HTMLOutputElement,
  width: number,
  height: number,
): HTMLElement {
  const frame = el("section.ds-splat-context__frame") as HTMLElement;
  frame.style.width = `${width}px`;
  frame.style.height = `${height}px`;
  return createResponsiveContextFrameWithDefaults(frame, status);
}

function createResponsiveContextFrameWithDefaults(
  frame: HTMLElement,
  status: HTMLOutputElement,
): HTMLElement {
  const desktopScene = extractResponsiveScene(createDesktopFrame(status));
  const mobilePortraitScene = extractResponsiveScene(
    createMobilePortraitFrame(status),
  );
  const mobileLandscapeScene = extractResponsiveScene(
    createResponsiveMobileLandscapeFrame(status),
  );

  let currentLayout: ResponsiveContextLayout | null = null;
  let pendingLayoutFrame = 0;

  const syncMobileSceneShareVisibility = (scene: HTMLElement): void => {
    const shareButton = scene.querySelector(
      ".ds-splat-context__mobile-trailing-actions > .ds-button",
    );
    if (!(shareButton instanceof HTMLButtonElement)) {
      return;
    }
    shareButton.hidden =
      frame.getBoundingClientRect().width < MOBILE_SHARE_THRESHOLD_PX;
  };

  const applyLayout = (): void => {
    const nextLayout = resolveResponsiveContextLayout(
      frame.clientWidth,
      frame.clientHeight,
    );
    if (nextLayout === currentLayout) {
      const activeScene = frame.querySelector(".ds-splat-context__scene");
      if (
        activeScene instanceof HTMLElement &&
        nextLayout !== "desktop"
      ) {
        syncMobileSceneShareVisibility(activeScene);
      }
      return;
    }

    currentLayout = nextLayout;
    frame.dataset.layout = nextLayout;
    setStoryStatus(status, `Context layout: ${nextLayout}`);

    if (nextLayout === "desktop") {
      frame.replaceChildren(desktopScene);
      return;
    }

    if (nextLayout === "mobile-landscape") {
      frame.replaceChildren(mobileLandscapeScene);
      syncMobileSceneShareVisibility(mobileLandscapeScene);
      return;
    }

    frame.replaceChildren(mobilePortraitScene);
    syncMobileSceneShareVisibility(mobilePortraitScene);
  };

  const scheduleLayout = (): void => {
    if (pendingLayoutFrame !== 0) {
      return;
    }
    pendingLayoutFrame = requestAnimationFrame(() => {
      pendingLayoutFrame = 0;
      applyLayout();
    });
  };

  const resizeObserver = new ResizeObserver(() => {
    scheduleLayout();
  });
  resizeObserver.observe(frame);
  scheduleLayout();

  const resizer = createResizeHandle();
  return resizer.wrap(frame);
}

function createResponsiveContextStory(options: {
  id: string;
  title: string;
  description: string;
  statusText: string;
  defaultWidth: number;
  defaultHeight: number;
}): HarnessStory {
  return {
    id: options.id,
    title: options.title,
    description: options.description,
    mount: (container) => {
      const stack = el("div.ds-story-stack") as HTMLDivElement;
      const status = el(
        "output.ds-story-output",
        options.statusText,
      ) as HTMLOutputElement;

      stack.append(
        createResponsiveContextFrameWithSize(
          status,
          options.defaultWidth,
          options.defaultHeight,
        ),
        status,
      );
      container.replaceChildren(stack);
    },
  };
}

export const contextStories: HarnessStory[] = [
  createResponsiveContextStory({
    id: "splat-context",
    title: "Splat Context",
    description:
      "Combined responsive story that switches among the known-good desktop, mobile portrait, and short mobile landscape shells.",
    statusText:
      "Resize the frame to move between desktop, mobile portrait, and short landscape behavior.",
    defaultWidth: 960,
    defaultHeight: 640,
  }),
  createResponsiveContextStory({
    id: "desktop-context",
    title: "Desktop",
    description:
      "Desktop-sized entry into the shared responsive splat context host.",
    statusText: "Desktop-sized responsive context host.",
    defaultWidth: 960,
    defaultHeight: 640,
  }),
  createResponsiveContextStory({
    id: "mobile-portrait",
    title: "Mobile Portrait",
    description:
      "Mobile portrait-sized entry into the shared responsive splat context host.",
    statusText: "Mobile portrait-sized responsive context host.",
    defaultWidth: 384,
    defaultHeight: 640,
  }),
  createResponsiveContextStory({
    id: "mobile-landscape",
    title: "Mobile Landscape",
    description:
      "Short mobile landscape-sized entry into the shared responsive splat context host.",
    statusText: "Short mobile landscape-sized responsive context host.",
    defaultWidth: 640,
    defaultHeight: 320,
  }),
];
