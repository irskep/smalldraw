import type { ReadableAtom } from "nanostores";
import type { UiIntentStore } from "../../controller/stores/createUiIntentStore";
import type {
  KidsToolConfig,
  KidsToolFamilyConfig,
  ToolbarItem,
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

export class ToolbarToolSelectorPane implements ReDomLike<HTMLDivElement> {
  readonly el: HTMLDivElement;
  private readonly toolSelectorGrid: PagedButtonGrid<ToolSelectorItemSpec>;
  private readonly uiIntentStore: Pick<UiIntentStore, "publish">;
  private readonly familyButtons = new Map<string, SquareIconButton>();
  private readonly directToolButtons = new Map<string, SquareIconButton>();

  constructor(options: {
    sidebarItems: ToolbarItem[];
    families: KidsToolFamilyConfig[];
    toolById: Map<string, KidsToolConfig>;
    uiIntentStore: Pick<UiIntentStore, "publish">;
  }) {
    this.uiIntentStore = options.uiIntentStore;
    this.toolSelectorGrid = new PagedButtonGrid<ToolSelectorItemSpec>({
      className: "kids-draw-tool-selector",
      orientation: "vertical",
      createItemComponent: (item) => this.createToolSelectorItemComponent(item),
    });
    this.el = this.toolSelectorGrid.el;

    const familiesById = new Map(
      options.families.map((family) => [family.id, family] as const),
    );
    const toolSelectorItems: ToolSelectorItemSpec[] = [];
    for (const item of options.sidebarItems) {
      if (item.kind === "family") {
        const family = familiesById.get(item.familyId);
        if (!family) continue;
        toolSelectorItems.push({
          id: `family:${family.id}`,
          kind: "family",
          family,
        });
        continue;
      }

      const tool = options.toolById.get(item.toolId);
      if (!tool) continue;
      toolSelectorItems.push({ id: `tool:${tool.id}`, kind: "tool", tool });
    }

    this.toolSelectorGrid.setItems(toolSelectorItems);
  }

  bindSelection(store: ReadableAtom<string>): () => void {
    return this.toolSelectorGrid.bindSelection(store);
  }

  bindUiState(options: {
    activeToolIdStore: ReadableAtom<string>;
    activeFamilyIdStore: ReadableAtom<string>;
  }): () => void {
    const applyActiveToolId = (activeToolId: string): void => {
      for (const [toolId, button] of this.directToolButtons) {
        button.setSelected(toolId === activeToolId);
      }
    };
    const applyActiveFamilyId = (activeFamilyId: string): void => {
      for (const [familyId, button] of this.familyButtons) {
        button.setSelected(familyId === activeFamilyId);
      }
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

  resolveSelectionItemId(activeToolId: string, activeFamilyId: string): string {
    if (this.directToolButtons.has(activeToolId)) {
      return `tool:${activeToolId}`;
    }
    if (this.familyButtons.has(activeFamilyId)) {
      return `family:${activeFamilyId}`;
    }
    return "";
  }

  syncLayout(): void {
    this.toolSelectorGrid.syncLayout();
  }

  setResolvedOrientation(orientation: "horizontal" | "vertical"): void {
    this.toolSelectorGrid.setResolvedOrientation(orientation);
  }

  setGridMode(mode: PagedButtonGridMode): void {
    this.toolSelectorGrid.setMode(mode);
  }

  destroy(): void {
    for (const button of this.familyButtons.values()) {
      button.setOnPress(null);
    }
    for (const button of this.directToolButtons.values()) {
      button.setOnPress(null);
    }
    this.toolSelectorGrid.destroy();
  }

  private createToolSelectorItemComponent(
    item: ToolSelectorItemSpec,
  ): ReDomLike<HTMLElement | SVGElement> {
    if (item.kind === "family") {
      const component = new ToolSelectorItemButton({
        item,
        uiIntentStore: this.uiIntentStore,
      });
      this.familyButtons.set(item.family.id, component.button);
      return component;
    }

    const component = new ToolSelectorItemButton({
      item,
      uiIntentStore: this.uiIntentStore,
    });
    this.directToolButtons.set(item.tool.id, component.button);
    return component;
  }
}

type ToolSelectorItemSpec = ButtonGridItemSpec &
  (
    | { kind: "family"; family: KidsToolFamilyConfig }
    | { kind: "tool"; tool: KidsToolConfig }
  );

class ToolSelectorItemButton implements ReDomLike<HTMLButtonElement> {
  readonly el: HTMLButtonElement;
  readonly button: SquareIconButton;

  constructor(options: {
    item: ToolSelectorItemSpec;
    uiIntentStore: Pick<UiIntentStore, "publish">;
  }) {
    const { item, uiIntentStore } = options;
    if (item.kind === "family") {
      this.button = createSquareIconButton({
        className: "kids-draw-tool-button",
        label: item.family.label,
        icon: item.family.icon,
        attributes: {
          "data-tool-family": item.family.id,
          title: item.family.label,
          "aria-label": item.family.label,
        },
      });
      this.button.setOnPress(() =>
        uiIntentStore.publish({
          type: "activate_family_tool",
          familyId: item.family.id,
        }),
      );
      this.el = this.button.el;
      return;
    }

    this.button = createSquareIconButton({
      className: "kids-draw-tool-button",
      label: item.tool.label,
      icon: item.tool.icon,
      attributes: {
        "data-tool-id": item.tool.id,
        "data-tool-family": item.tool.familyId,
        title: item.tool.label,
        "aria-label": item.tool.label,
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
}
