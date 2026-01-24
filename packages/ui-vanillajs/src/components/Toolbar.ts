import { el } from "redom";
import type { DrawingStore, ToolDefinition } from "@smalldraw/core";
import { ToolButton } from "./ToolButton.js";
import { ColorRow } from "./ColorRow.js";

/**
 * Toolbar component that contains tool buttons, color selectors, and undo/redo.
 */
export class Toolbar {
  el: HTMLDivElement;
  private toolButtons: Map<string, ToolButton> = new Map();
  private strokeColorRow: ColorRow;
  private fillColorRow: ColorRow;
  private undoButton: HTMLButtonElement;
  private redoButton: HTMLButtonElement;

  constructor(
    store: DrawingStore,
    palette: string[],
    tools: ToolDefinition[],
    availableToolIds: Set<string>,
  ) {
    this.el = el("div.smalldraw-toolbar", {
      style: {
        display: "flex",
        "flex-wrap": "wrap",
        gap: "8px",
        "align-items": "center",
      },
    }) as HTMLDivElement;

    // Create tool buttons
    const toolConfig = [
      { id: "selection", label: "Select" },
      { id: "rect", label: "Rect" },
      { id: "pen", label: "Pen" },
    ];

    for (const tool of toolConfig) {
      if (!availableToolIds.has(tool.id)) continue;
      const button = new ToolButton(tool.id, tool.label, () => {
        store.activateTool(tool.id);
      });
      this.toolButtons.set(tool.id, button);
      this.el.appendChild(button.el);
    }

    // Create stroke color row
    this.strokeColorRow = new ColorRow(
      "Stroke",
      palette,
      (color) => {
        store.updateSharedSettings({ strokeColor: color });
      },
      "stroke-swatches",
    );
    this.el.appendChild(this.strokeColorRow.el);

    // Create fill color row
    this.fillColorRow = new ColorRow(
      "Fill",
      palette,
      (color) => {
        store.updateSharedSettings({ fillColor: color });
      },
      "fill-swatches",
    );
    this.el.appendChild(this.fillColorRow.el);

    // Create undo button
    this.undoButton = el("button", {
      type: "button",
      onclick: () => store.undo(),
    }) as HTMLButtonElement;
    this.undoButton.textContent = "Undo";
    this.undoButton.dataset.action = "undo";
    this.el.appendChild(this.undoButton);

    // Create redo button
    this.redoButton = el("button", {
      type: "button",
      onclick: () => store.redo(),
    }) as HTMLButtonElement;
    this.redoButton.textContent = "Redo";
    this.redoButton.dataset.action = "redo";
    this.el.appendChild(this.redoButton);
  }

  update(store: DrawingStore): void {
    // Update tool buttons
    const activeToolId = store.getActiveToolId();
    for (const button of this.toolButtons.values()) {
      button.update(activeToolId);
    }

    // Update color rows
    const settings = store.getSharedSettings();
    this.strokeColorRow.update(settings.strokeColor);
    this.fillColorRow.update(settings.fillColor ?? "#000000");

    // Update undo/redo buttons
    this.undoButton.disabled = !store.canUndo();
    this.redoButton.disabled = !store.canRedo();
  }

  unmount(): void {
    for (const button of this.toolButtons.values()) {
      button.unmount();
    }
    this.strokeColorRow.unmount();
    this.fillColorRow.unmount();
  }
}
