import type { ReadableAtom } from "nanostores";
import { el, mount } from "redom";
import type { UiIntentStore } from "../../controller/stores/createUiIntentStore";
import type {
  KidsToolConfig,
  KidsToolFamilyConfig,
} from "../../tools/kidsTools";
import { ButtonGrid } from "../ButtonGrid";
import type { ReDomLike } from "../ReDomLike";
import {
  createSquareIconButton,
  type SquareIconButton,
} from "../SquareIconButton";

export class ToolbarVariantStripPane implements ReDomLike<HTMLDivElement> {
  readonly el: HTMLDivElement;
  private readonly variantButtons = new Map<string, SquareIconButton>();
  private readonly familyVariantGrids = new Map<string, ButtonGrid>();
  private ensureVisibleRafHandle: number | null = null;

  constructor(options: {
    families: KidsToolFamilyConfig[];
    toolById: Map<string, KidsToolConfig>;
    uiIntentStore: Pick<UiIntentStore, "publish">;
  }) {
    this.el = el("div.kids-draw-toolbar-variant-strip") as HTMLDivElement;

    for (const family of options.families) {
      const isTwoRowSingleHeight =
        family.variantLayout === "two-row-single-height";
      const hideVariantLabels = family.id.startsWith("stamp.");
      const isStampImages = family.id === "stamp.images";
      const variantItems: { id: string; element: HTMLElement }[] = [];
      for (const toolId of family.toolIds) {
        const tool = options.toolById.get(toolId);
        if (!tool) continue;
        const variantButton = createSquareIconButton({
          className: "kids-draw-tool-variant-button",
          label: hideVariantLabels ? "" : tool.label,
          icon: tool.icon,
          attributes: {
            "data-tool-variant": tool.id,
            "data-tool-family": tool.familyId,
            title: tool.label,
            "aria-label": tool.label,
            role: "radio",
            "aria-checked": "false",
            tabindex: "-1",
          },
        });
        variantButton.setOnPress(() =>
          options.uiIntentStore.publish({
            type: "activate_tool_and_remember",
            toolId: tool.id,
          }),
        );
        this.variantButtons.set(tool.id, variantButton);
        variantItems.push({ id: tool.id, element: variantButton.el });
      }
      const variantGrid = new ButtonGrid({
        className: "kids-draw-family-variants",
        orientation: "horizontal",
        largeLayout: isTwoRowSingleHeight ? "two-row" : "two-row-xlarge",
        paginateInLarge: isStampImages,
      });
      variantGrid.configureFamilyVariantStrip({
        familyId: family.id,
        familyLabel: family.label,
        variantLayout: family.variantLayout ?? "default",
        includeFamilyNavData: family.id === "stamp.images",
      });
      variantGrid.setLists([{ id: "main", items: variantItems }]);
      this.familyVariantGrids.set(family.id, variantGrid);
      mount(this.el, variantGrid);
    }
  }

  bindSelection(store: ReadableAtom<string>): Array<() => void> {
    return Array.from(this.familyVariantGrids.values(), (grid) =>
      grid.bindSelection(store),
    );
  }

  bindUiState(options: {
    activeToolIdStore: ReadableAtom<string>;
    activeFamilyIdStore: ReadableAtom<string>;
    onSyncVisibleFamily?: () => void;
  }): () => void {
    const applyActiveToolId = (activeToolId: string): void => {
      for (const [toolId, button] of this.variantButtons) {
        button.setRadioSelected(toolId === activeToolId);
      }
    };
    const applyActiveFamilyId = (activeFamilyId: string): void => {
      this.applyActiveFamily(activeFamilyId, options.onSyncVisibleFamily);
    };

    applyActiveToolId(options.activeToolIdStore.get());
    applyActiveFamilyId(options.activeFamilyIdStore.get());
    const unbindActiveTool =
      options.activeToolIdStore.subscribe(applyActiveToolId);
    const unbindActiveFamily =
      options.activeFamilyIdStore.subscribe(applyActiveFamilyId);
    return () => {
      unbindActiveTool();
      unbindActiveFamily();
    };
  }

  private applyActiveFamily(
    activeFamilyId: string,
    onSyncVisibleFamily?: () => void,
  ): void {
    for (const [familyId, grid] of this.familyVariantGrids) {
      const isActive = familyId === activeFamilyId;
      grid.setHidden(!isActive);
      if (!isActive) continue;
      grid?.syncLayout();
      if (this.ensureVisibleRafHandle !== null) {
        window.cancelAnimationFrame(this.ensureVisibleRafHandle);
      }
      this.ensureVisibleRafHandle = window.requestAnimationFrame(() => {
        this.ensureVisibleRafHandle = null;
        onSyncVisibleFamily?.();
        grid?.syncLayout();
      });
    }
  }

  syncLayout(): void {
    for (const grid of this.familyVariantGrids.values()) {
      grid.syncLayout();
    }
  }

  destroy(): void {
    if (this.ensureVisibleRafHandle !== null) {
      window.cancelAnimationFrame(this.ensureVisibleRafHandle);
      this.ensureVisibleRafHandle = null;
    }
    for (const button of this.variantButtons.values()) {
      button.setOnPress(null);
    }
    for (const grid of this.familyVariantGrids.values()) {
      grid.destroy();
    }
  }
}
