import {
  Download,
  FilePlus,
  FolderOpen,
  type IconNode,
  MoreHorizontal,
  Palette,
  Redo2,
  SlidersHorizontal,
  Trash2,
  Undo2,
} from "lucide";
import type { ReadableAtom } from "nanostores";
import { el, setChildren } from "redom";
import type { LayoutController } from "../controller/createLayoutController";
import type { KidsDrawUiIntent } from "../controller/KidsDrawUiIntent";
import type { UiIntentStore } from "../controller/stores/createUiIntentStore";
import type { ToolbarUiState } from "../ui/stores/toolbarUiStore";
import type { ReDomLike } from "./ReDomLike";
import {
  createSquareIconButton,
  type SquareIconButton,
} from "./SquareIconButton";

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

class MobilePortraitActionItemView implements ReDomLike<HTMLButtonElement> {
  readonly el: HTMLButtonElement;

  constructor(
    actionId: string,
    label: string,
    icon: IconNode,
    options?: {
      danger?: boolean;
    },
  ) {
    this.el = el("button.kids-draw-mobile-actions-item.kd-button-unstyled", {
      type: "button",
      role: "menuitem",
    }) as HTMLButtonElement;
    this.el.dataset.mobileAction = actionId;
    const iconElement = el(
      "span.kids-draw-mobile-actions-item-icon",
      createMenuIcon(icon),
    ) as HTMLSpanElement;
    const labelElement = el(
      "span.kids-draw-mobile-actions-item-label",
      label,
    ) as HTMLSpanElement;
    setChildren(this.el, [iconElement, labelElement]);
    if (options?.danger) {
      this.el.classList.add("is-danger");
    }
  }

  setDisabled(disabled: boolean): void {
    this.el.disabled = disabled;
  }

  bindClick(handler: () => void): () => void {
    const listener = (): void => {
      handler();
    };
    this.el.addEventListener("click", listener);
    return () => this.el.removeEventListener("click", listener);
  }
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
  private readonly undoMenuItem: MobilePortraitActionItemView;
  private readonly redoMenuItem: MobilePortraitActionItemView;
  private readonly newMenuItem: MobilePortraitActionItemView;
  private readonly browseMenuItem: MobilePortraitActionItemView;
  private readonly exportMenuItem: MobilePortraitActionItemView;
  private readonly clearMenuItem: MobilePortraitActionItemView;
  private unbindUiState: (() => void) | null = null;
  private unbindIntents: (() => void) | null = null;

  constructor() {
    this.bottomStrip = el(
      "div.kids-draw-mobile-portrait-bottom",
    ) as HTMLDivElement;
    this.topStrip = el("div.kids-draw-mobile-portrait-top") as HTMLDivElement;
    this.topControls = el(
      "div.kids-draw-mobile-top-controls",
    ) as HTMLDivElement;
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
    this.actionsPopover = el("div.kids-draw-mobile-actions-popover", {
      "aria-hidden": "true",
    }) as HTMLDivElement;
    this.actionsPopover.dataset.open = "false";
    this.actionsPopover.hidden = true;
    this.actionsMenu = el("div.kids-draw-mobile-actions-menu", {
      id: "kids-draw-mobile-actions-menu",
      role: "menu",
      "aria-label": "Actions",
    }) as HTMLDivElement;

    this.undoMenuItem = new MobilePortraitActionItemView("undo", "Undo", Undo2);
    this.redoMenuItem = new MobilePortraitActionItemView("redo", "Redo", Redo2);
    const undoRedoRow = el(
      "div.kids-draw-mobile-actions-row",
    ) as HTMLDivElement;
    undoRedoRow.setAttribute("role", "group");
    undoRedoRow.setAttribute("aria-label", "History");
    setChildren(undoRedoRow, [this.undoMenuItem.el, this.redoMenuItem.el]);

    const menuDivider = el(
      "div.kids-draw-mobile-actions-divider",
    ) as HTMLDivElement;
    menuDivider.setAttribute("role", "separator");
    const secondaryDivider = el(
      "div.kids-draw-mobile-actions-divider",
    ) as HTMLDivElement;
    secondaryDivider.setAttribute("role", "separator");
    this.newMenuItem = new MobilePortraitActionItemView(
      "new-drawing",
      "New Drawing",
      FilePlus,
    );
    this.browseMenuItem = new MobilePortraitActionItemView(
      "browse",
      "Browse Drawings",
      FolderOpen,
    );
    this.exportMenuItem = new MobilePortraitActionItemView(
      "export",
      "Export PNG",
      Download,
    );
    this.clearMenuItem = new MobilePortraitActionItemView(
      "clear",
      "Clear Canvas",
      Trash2,
      { danger: true },
    );
    setChildren(this.actionsMenu, [
      undoRedoRow,
      menuDivider,
      this.newMenuItem.el,
      this.browseMenuItem.el,
      this.exportMenuItem.el,
      secondaryDivider,
      this.clearMenuItem.el,
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
    this.actionsTrigger.setAriaExpanded(options.actionsOpen);
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
    this.actionsTrigger.setAriaExpanded(false);
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
      this.undoMenuItem.setDisabled(!next.canUndo);
      this.redoMenuItem.setDisabled(!next.canRedo);
      this.newMenuItem.setDisabled(next.newDrawingPending);
    };
    applyState(state.get());
    const unbind = state.subscribe(applyState);
    this.unbindUiState = () => {
      unbind();
      this.unbindUiState = null;
    };
    return this.unbindUiState;
  }

  bindIntents(options: {
    uiIntentStore: Pick<UiIntentStore, "publish">;
    layoutController: Pick<LayoutController, "getCurrentLayoutProfile">;
  }): () => void {
    this.unbindIntents?.();
    const disposers: Array<() => void> = [];

    const bindActionIntent = (
      item: MobilePortraitActionItemView,
      intent: Extract<
        KidsDrawUiIntent,
        | { type: "undo" }
        | { type: "redo" }
        | { type: "clear" }
        | { type: "export" }
        | { type: "new_drawing" }
        | { type: "browse" }
      >,
    ): void => {
      disposers.push(
        item.bindClick(() => {
          options.uiIntentStore.publish(intent);
        }),
      );
    };

    bindActionIntent(this.undoMenuItem, { type: "undo" });
    bindActionIntent(this.redoMenuItem, { type: "redo" });
    bindActionIntent(this.clearMenuItem, { type: "clear" });
    bindActionIntent(this.exportMenuItem, { type: "export" });
    bindActionIntent(this.newMenuItem, { type: "new_drawing" });
    bindActionIntent(this.browseMenuItem, { type: "browse" });

    this.actionsTrigger.setOnPress((event) => {
      event.stopPropagation();
      options.uiIntentStore.publish({ type: "toggle_mobile_actions" });
    });
    disposers.push(() => this.actionsTrigger.setOnPress(null));
    this.colorsButton.setOnPress(() => {
      if (
        options.layoutController.getCurrentLayoutProfile() !== "mobile-portrait"
      ) {
        return;
      }
      options.uiIntentStore.publish({
        type: "set_mobile_top_panel",
        panel: "colors",
      });
    });
    disposers.push(() => this.colorsButton.setOnPress(null));
    this.strokesButton.setOnPress(() => {
      if (
        options.layoutController.getCurrentLayoutProfile() !== "mobile-portrait"
      ) {
        return;
      }
      options.uiIntentStore.publish({
        type: "set_mobile_top_panel",
        panel: "strokes",
      });
    });
    disposers.push(() => this.strokesButton.setOnPress(null));

    this.unbindIntents = () => {
      for (const dispose of disposers) {
        dispose();
      }
      this.unbindIntents = null;
    };
    return this.unbindIntents;
  }

  containsTarget(target: Node): boolean {
    return (
      this.topStrip.contains(target) || this.actionsPopover.contains(target)
    );
  }

  getActionsTriggerRect(): DOMRect {
    return this.actionsTrigger.getBoundingClientRect();
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
