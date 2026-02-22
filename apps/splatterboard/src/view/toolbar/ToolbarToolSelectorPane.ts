import type { ReadableAtom } from "nanostores";
import type { UiIntentStore } from "../../controller/stores/createUiIntentStore";
import type {
  KidsToolConfig,
  KidsToolFamilyConfig,
  ToolbarItem,
} from "../../tools/kidsTools";
import { ButtonGrid } from "../ButtonGrid";
import type { ReDomLike } from "../ReDomLike";
import {
  createSquareIconButton,
  type SquareIconButton,
} from "../SquareIconButton";

export class ToolbarToolSelectorPane implements ReDomLike<HTMLDivElement> {
  readonly el: HTMLDivElement;
  private readonly toolSelectorGrid: ButtonGrid;
  private readonly familyButtons = new Map<string, SquareIconButton>();
  private readonly directToolButtons = new Map<string, SquareIconButton>();

  constructor(options: {
    sidebarItems: ToolbarItem[];
    families: KidsToolFamilyConfig[];
    toolById: Map<string, KidsToolConfig>;
    uiIntentStore: Pick<UiIntentStore, "publish">;
  }) {
    this.toolSelectorGrid = new ButtonGrid({
      className: "kids-draw-tool-selector",
      orientation: "vertical",
    });
    this.el = this.toolSelectorGrid.el;

    const familiesById = new Map(
      options.families.map((family) => [family.id, family] as const),
    );
    const toolSelectorItems: { id: string; element: HTMLElement }[] = [];
    for (const item of options.sidebarItems) {
      if (item.kind === "family") {
        const family = familiesById.get(item.familyId);
        if (!family) continue;
        const button = createSquareIconButton({
          className: "kids-draw-tool-button",
          label: family.label,
          icon: family.icon,
          attributes: {
            "data-tool-family": family.id,
            title: family.label,
            "aria-label": family.label,
          },
        });
        button.setOnPress(() =>
          options.uiIntentStore.publish({
            type: "activate_family_tool",
            familyId: family.id,
          }),
        );
        this.familyButtons.set(family.id, button);
        toolSelectorItems.push({
          id: `family:${family.id}`,
          element: button.el,
        });
        continue;
      }

      const tool = options.toolById.get(item.toolId);
      if (!tool) continue;
      const button = createSquareIconButton({
        className: "kids-draw-tool-button",
        label: tool.label,
        icon: tool.icon,
        attributes: {
          "data-tool-id": tool.id,
          "data-tool-family": tool.familyId,
          title: tool.label,
          "aria-label": tool.label,
        },
      });
      button.setOnPress(() =>
        options.uiIntentStore.publish({
          type: "activate_tool_and_remember",
          toolId: tool.id,
        }),
      );
      this.directToolButtons.set(tool.id, button);
      toolSelectorItems.push({ id: `tool:${tool.id}`, element: button.el });
    }

    this.toolSelectorGrid.setLists([{ id: "main", items: toolSelectorItems }]);
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

  destroy(): void {
    for (const button of this.familyButtons.values()) {
      button.setOnPress(null);
    }
    for (const button of this.directToolButtons.values()) {
      button.setOnPress(null);
    }
    this.toolSelectorGrid.destroy();
  }
}
