import type { IconNode } from "lucide";
import {
  Cat,
  Circle,
  Download,
  Eraser,
  FilePlus,
  FolderOpen,
  Highlighter,
  MoreHorizontal,
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
  createStrokePicker,
  createToolbar,
  type DropdownMenuEntry,
} from "../../src";
import { buildGridDemo, type DemoGridItem } from "./gridDemo";
import type { HarnessStory } from "./types";

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
  rowLayout?: boolean;
  status: HTMLOutputElement;
}): HTMLElement {
  const picker = createColorPicker({
    className: options.className,
    colors: COLOR_SWATCHES.map((color) => ({ color })),
    selectedColor: "#000000",
    triggerLabel: options.triggerLabel ?? "Colors",
    triggerAttributes: options.rowLayout ? { layout: "row" } : undefined,
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
  rowLayout?: boolean;
  status: HTMLOutputElement;
}): HTMLElement {
  const picker = createStrokePicker({
    className: options.className,
    strokeWidths: STROKE_WIDTHS,
    selectedStrokeWidth: 16,
    triggerLabel: options.triggerLabel ?? "Strokes",
    triggerAttributes: options.rowLayout ? { layout: "row" } : undefined,
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

function createVariantBar(options: {
  items: DemoGridItem[];
  activeItemId: string;
  className?: string;
}): HTMLDivElement {
  const toolbar = createToolbar({
    className: `ds-splat-context__variant-bar${options.className ? ` ${options.className}` : ""}`,
  });
  for (const item of options.items) {
    const button = createIconButton({
      className: "ds-splat-context__variant-button",
      label: item.label,
      icon: item.icon,
    });
    button.setPressed(item.id === options.activeItemId);
    toolbar.el.append(button.el);
  }
  return toolbar.el;
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
  const undoButton = createTopActionButton({ label: "Undo", icon: Undo2, status });
  const redoButton = createTopActionButton({ label: "Redo", icon: Redo2, status });
  const shareButton = createTopActionButton({
    label: "Share",
    icon: Share2,
    status,
  });
  const moreMenu = createDropdownMenu({
    triggerLabel: "More",
    triggerIcon: MoreHorizontal,
    menuLabel: "More actions",
    entries: DESKTOP_MENU_ENTRIES,
  });
  moreMenu.setOnSelect((itemId) => {
    status.value = `Desktop menu: ${itemId}`;
    status.textContent = status.value;
    moreMenu.setOpen(false);
  });
  topBar.el.append(undoButton.el, redoButton.el, shareButton.el, moreMenu.el);
  top.append(topBar.el);

  const left = el(
    "div.ds-splat-context__slot ds-splat-context__slot--left",
  ) as HTMLDivElement;
  const leftRail = createToolbar({
    orientation: "vertical",
    className: "ds-splat-context__left-rail",
  });
  leftRail.el.append(
    createColorPickerControl({
      className: "ds-splat-context__left-picker",
      status,
    }),
    createStrokePickerControl({
      className: "ds-splat-context__left-picker",
      status,
    }),
  );
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

  const bottom = el(
    "div.ds-splat-context__slot ds-splat-context__slot--bottom",
  ) as HTMLDivElement;
  bottom.append(
    createVariantBar({
      items: BRUSH_VARIANT_ITEMS,
      activeItemId: "pen",
      className: "ds-splat-context__toolbar-scale-large",
    }),
  );

  stage.append(top, left, canvas, bottom);
  frame.append(el("h2.ds-story-heading", "Desktop"), stage);
  return frame;
}

function createMobileFrame(status: HTMLOutputElement): HTMLElement {
  const frame = el("section.ds-splat-context__frame") as HTMLElement;
  const stage = el(
    "div.ds-splat-context__scene ds-splat-context__scene--mobile",
  ) as HTMLDivElement;

  const top = el("div.ds-splat-context__mobile-top") as HTMLDivElement;
  const topControls = el(
    "div.ds-splat-context__mobile-top-controls",
  ) as HTMLDivElement;
  const colors = createColorPickerControl({
    className: "ds-splat-context__mobile-picker",
    triggerLabel: "Color",
    rowLayout: true,
    status,
  });
  const strokes = createStrokePickerControl({
    className: "ds-splat-context__mobile-picker",
    triggerLabel: "Size",
    rowLayout: true,
    status,
  });
  const actionsMenu = createDropdownMenu({
    triggerLabel: "Actions",
    triggerIcon: MoreHorizontal,
    menuLabel: "Actions",
    entries: MOBILE_ACTIONS_MENU_ENTRIES,
  });
  actionsMenu.setOnSelect((itemId) => {
    status.value = `Mobile action: ${itemId}`;
    status.textContent = status.value;
    actionsMenu.setOpen(false);
  });
  topControls.append(colors, strokes, actionsMenu.el);
  top.append(topControls);

  const canvas = el(
    "div.ds-splat-context__canvas-shell ds-splat-context__canvas-shell--mobile",
  ) as HTMLDivElement;
  canvas.append(
    el("div.ds-splat-context__paper ds-splat-context__paper--mobile"),
  );

  const bottom = el("div.ds-splat-context__mobile-bottom") as HTMLDivElement;
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
  bottom.append(
    createVariantBar({
      items: BRUSH_VARIANT_ITEMS,
      activeItemId: "pen",
      className: "ds-splat-context__variant-bar--mobile",
    }),
    selector.grid.el,
  );

  stage.append(top, canvas, bottom);
  frame.append(el("h2.ds-story-heading", "Mobile Portrait"), stage);
  return frame;
}

export const contextStories: HarnessStory[] = [
  {
    id: "splat-context",
    title: "Splat Context",
    description:
      "Composite reference scene that recreates the main splat UI shell in desktop and mobile portrait layouts using the ported design-system pieces.",
    mount: (container) => {
      const stack = el("div.ds-story-stack") as HTMLDivElement;
      const gallery = el("div.ds-splat-context__gallery") as HTMLDivElement;
      const status = el(
        "output.ds-story-output",
        "Use the scene controls to inspect the shell in context.",
      ) as HTMLOutputElement;

      gallery.append(createDesktopFrame(status), createMobileFrame(status));
      stack.append(gallery, status);
      container.replaceChildren(stack);
    },
  },
];
