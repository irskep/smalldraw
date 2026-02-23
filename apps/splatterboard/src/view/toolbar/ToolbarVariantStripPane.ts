import type { ReadableAtom } from "nanostores";
import { el, mount } from "redom";
import type { UiIntentStore } from "../../controller/stores/createUiIntentStore";
import type {
  KidsToolConfig,
  KidsToolFamilyConfig,
} from "../../tools/kidsTools";
import {
  type ButtonGridItemSpec,
  PagedButtonGrid,
  type PagedButtonGridMode,
} from "../PagedButtonGrid";
import type { ReDomLike } from "../ReDomLike";
import {
  createSquareIconButton,
  type SquareIconButton,
} from "../SquareIconButton";

export class ToolbarVariantStripPane implements ReDomLike<HTMLDivElement> {
  readonly el: HTMLDivElement;
  private readonly uiIntentStore: Pick<UiIntentStore, "publish">;
  private readonly variantButtons = new Map<string, VariantStripItemButton>();
  private readonly familyVariantGrids = new Map<
    string,
    PagedButtonGrid<VariantStripItemSpec>
  >();
  private ensureVisibleRafHandle: number | null = null;

  constructor(options: {
    families: KidsToolFamilyConfig[];
    toolById: Map<string, KidsToolConfig>;
    uiIntentStore: Pick<UiIntentStore, "publish">;
  }) {
    this.uiIntentStore = options.uiIntentStore;
    this.el = el("div.kids-draw-toolbar-variant-strip") as HTMLDivElement;

    for (const family of options.families) {
      const isTwoRowSingleHeight =
        family.variantLayout === "two-row-single-height";
      const hideVariantLabels = family.id.startsWith("stamp.");
      const isStampImages = family.id === "stamp.images";
      const variantItems: VariantStripItemSpec[] = [];
      for (const toolId of family.toolIds) {
        const tool = options.toolById.get(toolId);
        if (!tool) continue;
        variantItems.push({
          id: tool.id,
          tool,
          hideLabel: hideVariantLabels,
        });
      }
      const variantGrid = new PagedButtonGrid<VariantStripItemSpec>({
        className: "kids-draw-family-variants",
        orientation: "horizontal",
        largeLayout: isTwoRowSingleHeight ? "two-row" : "two-row-xlarge",
        paginateInLarge: isStampImages,
        rootAttributes: {
          role: "radiogroup",
          "aria-label": `${family.label} tools`,
          "data-tool-family-toolbar": family.id,
          "data-variant-layout": family.variantLayout ?? "default",
        },
        navAttributes:
          family.id === "stamp.images"
            ? {
                prev: { "data-tool-family-prev": family.id },
                next: { "data-tool-family-next": family.id },
              }
            : undefined,
        createItemComponent: (item) => {
          const component = new VariantStripItemButton({
            item,
            uiIntentStore: this.uiIntentStore,
          });
          this.variantButtons.set(item.tool.id, component);
          return component;
        },
      });
      variantGrid.setItems(variantItems);
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

  setGridMode(mode: PagedButtonGridMode): void {
    for (const grid of this.familyVariantGrids.values()) {
      grid.setMode(mode);
    }
  }

  destroy(): void {
    if (this.ensureVisibleRafHandle !== null) {
      window.cancelAnimationFrame(this.ensureVisibleRafHandle);
      this.ensureVisibleRafHandle = null;
    }
    for (const button of this.variantButtons.values()) {
      button.destroy();
    }
    for (const grid of this.familyVariantGrids.values()) {
      grid.destroy();
    }
  }
}

type VariantStripItemSpec = ButtonGridItemSpec & {
  tool: KidsToolConfig;
  hideLabel: boolean;
};

class VariantStripItemButton implements ReDomLike<HTMLButtonElement> {
  readonly el: HTMLButtonElement;
  private readonly button: SquareIconButton;

  constructor(options: {
    item: VariantStripItemSpec;
    uiIntentStore: Pick<UiIntentStore, "publish">;
  }) {
    const { item, uiIntentStore } = options;
    this.button = createSquareIconButton({
      className: "kids-draw-tool-variant-button",
      label: item.hideLabel ? "" : item.tool.label,
      icon: item.tool.icon,
      attributes: {
        "data-tool-variant": item.tool.id,
        "data-tool-family": item.tool.familyId,
        title: item.tool.label,
        "aria-label": item.tool.label,
        role: "radio",
        "aria-checked": "false",
        tabindex: "-1",
      },
    });
    this.button.setOnPress(() =>
      uiIntentStore.publish({
        type: "activate_tool_and_remember",
        toolId: item.tool.id,
      }),
    );
    this.el = this.button.el;
  }

  setRadioSelected(selected: boolean): void {
    this.button.setRadioSelected(selected);
  }

  destroy(): void {
    this.button.setOnPress(null);
  }
}
