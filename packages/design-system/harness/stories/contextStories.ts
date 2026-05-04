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
  type IconNode,
} from "lucide";
import { el } from "redom";
import {
  type ColorPickerSwatch,
  createSplatContext,
  resolveSplatContextLayout,
  type DropdownMenuEntry,
  type SplatContextLayout,
  type SplatToolItem,
  type SyncIndicatorState,
} from "../../src";
import { createResizeHandle } from "./ResizeHandle";
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

const TOOL_ITEMS: SplatToolItem[] = [
  { id: "brush", label: "Brush", icon: Pen },
  { id: "eraser", label: "Eraser", icon: Eraser },
  { id: "fill", label: "Fill", icon: PaintBucket },
  { id: "filled", label: "Filled", icon: FILLED_RECT_ICON },
  { id: "outline", label: "Outline", icon: Circle },
  { id: "letters", label: "Letters", icon: Type },
  { id: "stamps", label: "Stamps", icon: Cat },
];

const VARIANT_ITEMS: SplatToolItem[] = [
  { id: "marker", label: "Marker", icon: Highlighter },
  { id: "pen", label: "Pen", icon: Pen },
  { id: "spray-move", label: "Spray (Move)", icon: SprayCan },
  { id: "spray-hold", label: "Spray (Hold)", icon: SprayCan },
];

const COLOR_SWATCHES: readonly ColorPickerSwatch[] = [
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
].map((color) => ({ color }));

const STROKE_WIDTHS = [2, 4, 8, 16, 24, 48, 96, 200] as const;

const DESKTOP_MENU_ENTRIES: DropdownMenuEntry[] = [
  { id: "new-drawing", label: "New Drawing", icon: FilePlus },
  { id: "browse", label: "Browse Drawings", icon: FolderOpen },
  { id: "export", label: "Export PNG", icon: Download },
  { type: "separator" },
  { id: "clear", label: "Clear Canvas", icon: Trash2, danger: true },
];

const MOBILE_MENU_ENTRIES: DropdownMenuEntry[] = [
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

type StorySyncMode = "fixed" | "layout-driven";

function setStoryStatus(status: HTMLOutputElement, value: string): void {
  status.value = value;
  status.textContent = value;
}

function resolveLayoutDrivenSyncState(
  layout: SplatContextLayout,
): SyncIndicatorState {
  if (layout === "desktop") {
    return "online";
  }
  if (layout === "mobile-landscape-short") {
    return "local-only";
  }
  return "synced-to-server-but-offline";
}

function resolveFixedSyncState(storyId: string): SyncIndicatorState {
  if (storyId === "desktop-context") {
    return "online";
  }
  if (storyId === "mobile-landscape") {
    return "local-only";
  }
  return "synced-to-server-but-offline";
}

function createResponsiveContextStory(options: {
  id: string;
  title: string;
  description: string;
  statusText: string;
  defaultWidth: number;
  defaultHeight: number;
  syncMode: StorySyncMode;
}): HarnessStory {
  return {
    id: options.id,
    title: options.title,
    description: options.description,
    mount: (container) => {
      const previousDispose = (
        container as HTMLElement & { __disposeContextStory?: () => void }
      ).__disposeContextStory;
      previousDispose?.();

      const stack = el("div.ds-story-stack") as HTMLDivElement;
      const status = el(
        "output.ds-story-output",
        options.statusText,
      ) as HTMLOutputElement;

      const initialLayout = resolveSplatContextLayout(
        options.defaultWidth,
        options.defaultHeight,
      );
      const context = createSplatContext({
        tools: TOOL_ITEMS,
        activeToolId: "brush",
        variants: VARIANT_ITEMS,
        activeVariantId: "pen",
        colors: COLOR_SWATCHES,
        selectedColor: "#000000",
        strokeWidths: STROKE_WIDTHS,
        selectedStrokeWidth: 16,
        desktopMenuEntries: DESKTOP_MENU_ENTRIES,
        mobileMenuEntries: MOBILE_MENU_ENTRIES,
        syncState:
          options.syncMode === "layout-driven"
            ? resolveLayoutDrivenSyncState(initialLayout)
            : resolveFixedSyncState(options.id),
        status,
      });

      context.el.style.width = `${options.defaultWidth}px`;
      context.el.style.height = `${options.defaultHeight}px`;

      const resizeHandle = createResizeHandle();
      const wrappedContext = resizeHandle.wrap(context.el);

      let syncObserver: ResizeObserver | null = null;
      let syncFrame = 0;

      if (options.syncMode === "layout-driven") {
        const syncFromBounds = (): void => {
          syncFrame = 0;
          const rect = context.el.getBoundingClientRect();
          const layout = resolveSplatContextLayout(rect.width, rect.height);
          context.setSyncState(resolveLayoutDrivenSyncState(layout));
        };

        syncObserver = new ResizeObserver(() => {
          if (syncFrame !== 0) {
            return;
          }
          syncFrame = window.requestAnimationFrame(syncFromBounds);
        });
        syncObserver.observe(context.el);
        syncFromBounds();
      }

      stack.append(wrappedContext, status);
      container.replaceChildren(stack);

      (
        container as HTMLElement & { __disposeContextStory?: () => void }
      ).__disposeContextStory = () => {
        if (syncFrame !== 0) {
          window.cancelAnimationFrame(syncFrame);
        }
        syncObserver?.disconnect();
        context.onunmount();
        resizeHandle.destroy();
      };
    },
  };
}

export const contextStories: HarnessStory[] = [
  createResponsiveContextStory({
    id: "splat-context",
    title: "Splat Context",
    description:
      "Combined responsive story that switches among the shared desktop, mobile portrait, and short mobile landscape layouts.",
    statusText:
      "Resize the frame to move between desktop, mobile portrait, and short landscape behavior.",
    defaultWidth: 960,
    defaultHeight: 640,
    syncMode: "layout-driven",
  }),
  createResponsiveContextStory({
    id: "desktop-context",
    title: "Desktop",
    description:
      "Desktop-sized entry into the shared responsive splat context host.",
    statusText: "Desktop-sized responsive context host.",
    defaultWidth: 960,
    defaultHeight: 640,
    syncMode: "fixed",
  }),
  createResponsiveContextStory({
    id: "mobile-portrait",
    title: "Mobile Portrait",
    description:
      "Mobile portrait-sized entry into the shared responsive splat context host.",
    statusText: "Mobile portrait-sized responsive context host.",
    defaultWidth: 384,
    defaultHeight: 640,
    syncMode: "fixed",
  }),
  createResponsiveContextStory({
    id: "mobile-landscape",
    title: "Mobile Landscape",
    description:
      "Short mobile landscape-sized entry into the shared responsive splat context host.",
    statusText: "Short mobile landscape-sized responsive context host.",
    defaultWidth: 640,
    defaultHeight: 320,
    syncMode: "fixed",
  }),
];
