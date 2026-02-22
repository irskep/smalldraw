import {
  Download,
  FilePlus,
  FolderOpen,
  MoreHorizontal,
  Palette,
  Redo2,
  SlidersHorizontal,
  Trash2,
  type IconNode,
  Undo2,
} from "lucide";
import { el, setChildren } from "redom";
import {
  createSquareIconButton,
  type SquareIconButton,
} from "./SquareIconButton";
import type { ToolbarUiState } from "../ui/stores/toolbarUiStore";
import type { ReadableAtom } from "nanostores";

export type MobilePortraitActionsIntent =
  | "undo"
  | "redo"
  | "toggle_actions"
  | "show_colors"
  | "show_strokes"
  | "clear"
  | "export"
  | "new_drawing"
  | "browse";

const SVG_NS = "http://www.w3.org/2000/svg";

function createMenuIcon(iconNode: IconNode): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  for (const [tag, attrs] of iconNode) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attrs)) {
      if (value !== undefined) {
        node.setAttribute(name, `${value}`);
      }
    }
    svg.appendChild(node);
  }
  return svg;
}

function createMobilePortraitActionItem(
  actionId: string,
  label: string,
  icon: IconNode,
  options?: {
    danger?: boolean;
  },
): HTMLButtonElement {
  const item = el(
    "button.kids-draw-mobile-actions-item.kd-button-unstyled",
    {
      type: "button",
      role: "menuitem",
    },
  ) as HTMLButtonElement;
  item.dataset.mobileAction = actionId;
  const iconElement = el(
    "span.kids-draw-mobile-actions-item-icon",
    createMenuIcon(icon),
  ) as HTMLSpanElement;
  const labelElement = el(
    "span.kids-draw-mobile-actions-item-label",
    label,
  ) as HTMLSpanElement;
  setChildren(item, [iconElement, labelElement]);
  if (options?.danger) {
    item.classList.add("is-danger");
  }
  return item;
}

export class MobilePortraitActionsView {
  private readonly bottomStrip: HTMLDivElement;
  private readonly topStrip: HTMLDivElement;
  private readonly topControls: HTMLDivElement;
  private readonly colorsButton: SquareIconButton;
  private readonly strokesButton: SquareIconButton;
  private readonly actionsTrigger: SquareIconButton;
  private readonly actionsPopover: HTMLDivElement;
  private readonly actionsMenu: HTMLDivElement;
  private readonly undoMenuItem: HTMLButtonElement;
  private readonly redoMenuItem: HTMLButtonElement;
  private readonly newMenuItem: HTMLButtonElement;
  private readonly browseMenuItem: HTMLButtonElement;
  private readonly exportMenuItem: HTMLButtonElement;
  private readonly clearMenuItem: HTMLButtonElement;
  private unbindUiState: (() => void) | null = null;

  constructor() {
    this.bottomStrip = el("div.kids-draw-mobile-portrait-bottom") as HTMLDivElement;
    this.topStrip = el("div.kids-draw-mobile-portrait-top") as HTMLDivElement;
    this.topControls = el("div.kids-draw-mobile-top-controls") as HTMLDivElement;
    this.colorsButton = createSquareIconButton({
      className: "kids-draw-mobile-top-toggle kids-draw-tool-button",
      label: "Color",
      icon: Palette,
      attributes: {
        title: "Show colors",
        "aria-label": "Show colors",
        layout: "row",
      },
    });
    this.strokesButton = createSquareIconButton({
      className: "kids-draw-mobile-top-toggle kids-draw-tool-button",
      label: "Size",
      icon: SlidersHorizontal,
      attributes: {
        title: "Show stroke widths",
        "aria-label": "Show stroke widths",
        layout: "row",
      },
    });
    this.actionsTrigger = createSquareIconButton({
      className: "kids-draw-mobile-actions-trigger",
      label: "Actions",
      icon: MoreHorizontal,
      attributes: {
        title: "Actions",
        "aria-label": "Actions",
        "aria-haspopup": "menu",
        "aria-controls": "kids-draw-mobile-actions-menu",
        "aria-expanded": "false",
      },
    });
    this.actionsPopover = el(
      "div.kids-draw-mobile-actions-popover",
      {
        "aria-hidden": "true",
      },
    ) as HTMLDivElement;
    this.actionsPopover.dataset.open = "false";
    this.actionsPopover.hidden = true;
    this.actionsMenu = el(
      "div.kids-draw-mobile-actions-menu",
      {
        id: "kids-draw-mobile-actions-menu",
        role: "menu",
        "aria-label": "Actions",
      },
    ) as HTMLDivElement;

    this.undoMenuItem = createMobilePortraitActionItem("undo", "Undo", Undo2);
    this.redoMenuItem = createMobilePortraitActionItem("redo", "Redo", Redo2);
    const undoRedoRow = el("div.kids-draw-mobile-actions-row") as HTMLDivElement;
    undoRedoRow.setAttribute("role", "group");
    undoRedoRow.setAttribute("aria-label", "History");
    setChildren(undoRedoRow, [this.undoMenuItem, this.redoMenuItem]);

    const menuDivider = el("div.kids-draw-mobile-actions-divider") as HTMLDivElement;
    menuDivider.setAttribute("role", "separator");
    const secondaryDivider = el(
      "div.kids-draw-mobile-actions-divider",
    ) as HTMLDivElement;
    secondaryDivider.setAttribute("role", "separator");
    this.newMenuItem = createMobilePortraitActionItem(
      "new-drawing",
      "New Drawing",
      FilePlus,
    );
    this.browseMenuItem = createMobilePortraitActionItem(
      "browse",
      "Browse Drawings",
      FolderOpen,
    );
    this.exportMenuItem = createMobilePortraitActionItem(
      "export",
      "Export PNG",
      Download,
    );
    this.clearMenuItem = createMobilePortraitActionItem(
      "clear",
      "Clear Canvas",
      Trash2,
      { danger: true },
    );
    setChildren(this.actionsMenu, [
      undoRedoRow,
      menuDivider,
      this.newMenuItem,
      this.browseMenuItem,
      this.exportMenuItem,
      secondaryDivider,
      this.clearMenuItem,
    ]);
    this.colorsButton.setSelected(true);
    this.strokesButton.setSelected(false);
  }

  mountMobileLayout(options: {
    topSlot: HTMLElement;
    bottomSlot: HTMLElement;
    toolbarTopElement: HTMLElement;
    toolbarBottomElement: HTMLElement;
    toolSelectorElement: HTMLElement;
    actionsOpen: boolean;
  }): void {
    this.actionsPopover.replaceChildren(this.actionsMenu);
    this.actionsPopover.hidden = false;
    this.setActionsOpen(options.actionsOpen);
    this.actionsTrigger.el.setAttribute(
      "aria-expanded",
      options.actionsOpen ? "true" : "false",
    );
    this.topControls.replaceChildren(
      this.colorsButton.el,
      this.strokesButton.el,
      this.actionsTrigger.el,
    );
    this.topStrip.replaceChildren(
      this.topControls,
      options.toolbarTopElement,
      this.actionsPopover,
    );
    this.bottomStrip.replaceChildren(
      options.toolbarBottomElement,
      options.toolSelectorElement,
    );
    options.topSlot.replaceChildren(this.topStrip);
    options.bottomSlot.replaceChildren(this.bottomStrip);
  }

  unmountMobileLayout(): void {
    this.actionsPopover.hidden = true;
    this.actionsTrigger.el.setAttribute("aria-expanded", "false");
    this.setActionsOpen(false);
    this.clearPopoverPosition();
    this.setTopPanel("colors");
  }

  setTopPanel(panel: "colors" | "strokes"): void {
    this.colorsButton.setSelected(panel === "colors");
    this.strokesButton.setSelected(panel === "strokes");
  }

  bindUiState(state: ReadableAtom<ToolbarUiState>): () => void {
    this.unbindUiState?.();
    const applyState = (next: ToolbarUiState): void => {
      this.undoMenuItem.disabled = !next.canUndo;
      this.redoMenuItem.disabled = !next.canRedo;
      this.newMenuItem.disabled = next.newDrawingPending;
    };
    applyState(state.get());
    const unbind = state.subscribe(applyState);
    this.unbindUiState = () => {
      unbind();
      this.unbindUiState = null;
    };
    return this.unbindUiState;
  }

  bindViewEvents(options: {
    listen: (
      target: EventTarget,
      type: string,
      handler: (event: Event) => void,
    ) => void;
    getCurrentLayoutProfile: () => string;
    onIntent: (intent: MobilePortraitActionsIntent) => void;
  }): void {
    const dispatchIntent = (intent: Parameters<typeof options.onIntent>[0]) => {
      return () => options.onIntent(intent);
    };
    options.listen(this.undoMenuItem, "click", dispatchIntent("undo"));
    options.listen(this.redoMenuItem, "click", dispatchIntent("redo"));
    options.listen(this.clearMenuItem, "click", dispatchIntent("clear"));
    options.listen(this.exportMenuItem, "click", dispatchIntent("export"));
    options.listen(this.newMenuItem, "click", dispatchIntent("new_drawing"));
    options.listen(this.browseMenuItem, "click", dispatchIntent("browse"));
    options.listen(this.actionsTrigger.el, "click", (event) => {
      event.stopPropagation();
      options.onIntent("toggle_actions");
    });
    options.listen(this.colorsButton.el, "click", () => {
      if (options.getCurrentLayoutProfile() !== "mobile-portrait") {
        return;
      }
      options.onIntent("show_colors");
    });
    options.listen(this.strokesButton.el, "click", () => {
      if (options.getCurrentLayoutProfile() !== "mobile-portrait") {
        return;
      }
      options.onIntent("show_strokes");
    });
  }

  containsTarget(target: Node): boolean {
    return this.topStrip.contains(target) || this.actionsPopover.contains(target);
  }

  getActionsTriggerRect(): DOMRect {
    return this.actionsTrigger.el.getBoundingClientRect();
  }

  getActionsPopoverRect(): DOMRect {
    return this.actionsPopover.getBoundingClientRect();
  }

  setPopoverPosition(left: number, top: number): void {
    this.actionsPopover.style.left = `${left}px`;
    this.actionsPopover.style.top = `${top}px`;
  }

  clearPopoverPosition(): void {
    this.actionsPopover.style.removeProperty("left");
    this.actionsPopover.style.removeProperty("top");
  }

  private setActionsOpen(open: boolean): void {
    this.actionsPopover.dataset.open = open ? "true" : "false";
    this.actionsPopover.setAttribute("aria-hidden", open ? "false" : "true");
  }
}
