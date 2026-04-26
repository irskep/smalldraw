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
  createDropdownMenu,
  createIconButton,
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

const ACTIONS_MENU_ENTRIES: DropdownMenuEntry[] = [
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

function createPanel(className?: string): HTMLDivElement {
  return el(
    `div.ds-splat-context__panel${className ? ` ${className}` : ""}`,
  ) as HTMLDivElement;
}

function createColorSwatches(selectedColor: string): HTMLElement {
  const grid = el("div.ds-splat-context__swatch-grid") as HTMLDivElement;
  for (const color of COLOR_SWATCHES) {
    grid.append(
      el("button.ds-splat-context__swatch", {
        type: "button",
        title: color,
        "aria-label": color,
        "data-selected": color === selectedColor ? "true" : "false",
        style: `--ds-splat-context-swatch:${color};`,
      }),
    );
  }
  return grid;
}

function createStrokeWidths(selectedStrokeWidth: number): HTMLElement {
  const grid = el("div.ds-splat-context__stroke-grid") as HTMLDivElement;
  for (const strokeWidth of STROKE_WIDTHS) {
    const previewSize = Math.max(2, Math.min(18, Math.sqrt(strokeWidth) * 1.5));
    grid.append(
      el(
        "button.ds-splat-context__stroke-button",
        {
          type: "button",
          title: `${strokeWidth}px brush`,
          "aria-label": `${strokeWidth}px brush`,
          "data-selected":
            strokeWidth === selectedStrokeWidth ? "true" : "false",
        },
        el("span.ds-splat-context__stroke-line", {
          style: `--ds-splat-context-stroke-preview-size:${previewSize}px;`,
        }),
      ),
    );
  }
  return grid;
}

function createActionButton(options: {
  label: string;
  icon: IconNode;
  className?: string;
  status: HTMLOutputElement;
}): HTMLButtonElement {
  const button = createIconButton({
    className: `ds-splat-context__action-button${options.className ? ` ${options.className}` : ""}`,
    label: options.label,
    icon: options.icon,
    attributes: { layout: "row" },
  });
  button.setOnPress(() => {
    options.status.value = `Desktop action: ${options.label}`;
    options.status.textContent = options.status.value;
  });
  return button.el;
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
  top.append(
    (() => {
      const row = el("div.ds-splat-context__top-row") as HTMLDivElement;
      const palettePanel = createPanel("ds-splat-context__palette-panel");
      palettePanel.append(createColorSwatches("#000000"));
      const strokePanel = createPanel("ds-splat-context__stroke-panel");
      strokePanel.append(createStrokeWidths(16));
      row.append(palettePanel, strokePanel);
      return row;
    })(),
  );

  const left = el(
    "div.ds-splat-context__slot ds-splat-context__slot--left",
  ) as HTMLDivElement;
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
  left.append(selector.grid.el);

  const right = el(
    "div.ds-splat-context__slot ds-splat-context__slot--right",
  ) as HTMLDivElement;
  const actionPanel = createPanel("ds-splat-context__action-panel");
  actionPanel.append(
    createActionButton({ label: "Undo", icon: Undo2, status }),
    createActionButton({ label: "Redo", icon: Redo2, status }),
    el("div.ds-splat-context__action-spacer", { "aria-hidden": "true" }),
    createActionButton({
      label: "Clear",
      icon: Trash2,
      className: "ds-splat-context__action-button--full",
      status,
    }),
    createActionButton({
      label: "Export",
      icon: Download,
      className: "ds-splat-context__action-button--full",
      status,
    }),
    createActionButton({ label: "Share", icon: Share2, status }),
    createActionButton({
      label: "New",
      icon: FilePlus,
      className: "ds-splat-context__action-button--full",
      status,
    }),
    createActionButton({
      label: "Browse",
      icon: FolderOpen,
      className: "ds-splat-context__action-button--full",
      status,
    }),
  );
  right.append(actionPanel);

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

  stage.append(top, left, right, canvas, bottom);
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
  const colors = createIconButton({
    className: "ds-splat-context__mobile-top-toggle",
    label: "Color",
    icon: Palette,
    attributes: { layout: "row" },
  });
  colors.setPressed(true);
  const strokes = createIconButton({
    className: "ds-splat-context__mobile-top-toggle",
    label: "Size",
    icon: SlidersHorizontal,
    attributes: { layout: "row" },
  });
  const actionsMenu = createDropdownMenu({
    triggerLabel: "Actions",
    triggerIcon: MoreHorizontal,
    menuLabel: "Actions",
    entries: ACTIONS_MENU_ENTRIES,
  });
  actionsMenu.setOnSelect((itemId) => {
    status.value = `Mobile action: ${itemId}`;
    status.textContent = status.value;
    actionsMenu.setOpen(false);
  });
  topControls.append(colors.el, strokes.el, actionsMenu.el);

  const mobilePalette = createPanel("ds-splat-context__mobile-panel");
  mobilePalette.append(createColorSwatches("#000000"));
  top.append(topControls, mobilePalette);

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
