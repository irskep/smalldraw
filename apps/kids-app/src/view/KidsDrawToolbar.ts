import {
  Eraser,
  FilePlus,
  Pen,
  Redo2,
  Trash2,
  Undo2,
  type IconNode,
} from "lucide";
import type { ReadableAtom } from "nanostores";
import { el, mount } from "redom";
import type { ToolbarUiState } from "../ui/stores/toolbarUiStore";
import {
  ensureSquareIconButtonDefined,
  SquareIconButtonElement,
} from "./SquareIconButton";

export interface KidsDrawToolbar {
  readonly element: HTMLDivElement;
  readonly toolSelectorElement: HTMLDivElement;
  readonly actionPanelElement: HTMLDivElement;
  readonly penButton: SquareIconButtonElement;
  readonly eraserButton: SquareIconButtonElement;
  readonly undoButton: SquareIconButtonElement;
  readonly redoButton: SquareIconButtonElement;
  readonly clearButton: SquareIconButtonElement;
  readonly newDrawingButton: SquareIconButtonElement;
  readonly colorInput: HTMLInputElement;
  readonly sizeInput: HTMLInputElement;
  bindUiState(state: ReadableAtom<ToolbarUiState>): () => void;
}

function createSquareButton(options: {
  className: string;
  label: string;
  icon: IconNode;
  attributes: Record<string, string>;
}): SquareIconButtonElement {
  const button = document.createElement(
    SquareIconButtonElement.tagName,
  ) as SquareIconButtonElement;
  button.className = options.className;
  for (const [name, value] of Object.entries(options.attributes)) {
    button.setAttribute(name, value);
  }
  button.setLabel(options.label);
  button.setIcon(options.icon);
  return button;
}

export function createKidsDrawToolbar(): KidsDrawToolbar {
  ensureSquareIconButtonDefined();

  const toolbarControls: HTMLElement[] = [];
  const toolSelectorControls: HTMLElement[] = [];
  const actionPanelControls: HTMLElement[] = [];

  const element = el("div.kids-draw-toolbar") as HTMLDivElement;
  const toolSelectorElement = el(
    "div.kids-draw-tool-selector",
  ) as HTMLDivElement;
  const actionPanelElement = el(
    "div.kids-draw-action-panel",
  ) as HTMLDivElement;

  const penButton = createSquareButton({
    className: "kids-draw-tool-button",
    label: "Pen",
    icon: Pen,
    attributes: {
      "data-tool": "pen",
      title: "Pen",
      "aria-label": "Pen",
    },
  });
  toolSelectorControls.push(penButton);

  const eraserButton = createSquareButton({
    className: "kids-draw-tool-button",
    label: "Eraser",
    icon: Eraser,
    attributes: {
      "data-tool": "eraser",
      title: "Eraser",
      "aria-label": "Eraser",
    },
  });
  toolSelectorControls.push(eraserButton);

  const undoButton = createSquareButton({
    className: "kids-draw-action-button kids-draw-action-undo",
    label: "Undo",
    icon: Undo2,
    attributes: {
      title: "Undo",
      "aria-label": "Undo",
      "data-action": "undo",
    },
  });
  actionPanelControls.push(undoButton);

  const redoButton = createSquareButton({
    className: "kids-draw-action-button kids-draw-action-redo",
    label: "Redo",
    icon: Redo2,
    attributes: {
      title: "Redo",
      "aria-label": "Redo",
      "data-action": "redo",
    },
  });
  actionPanelControls.push(redoButton);

  const clearButton = createSquareButton({
    className: "kids-draw-action-button kids-draw-action-clear",
    label: "Clear",
    icon: Trash2,
    attributes: {
      title: "Clear canvas",
      "aria-label": "Clear canvas",
      "data-action": "clear",
      layout: "row",
    },
  });
  actionPanelControls.push(clearButton);

  const newDrawingButton = createSquareButton({
    className: "kids-draw-action-button kids-draw-action-new",
    label: "New",
    icon: FilePlus,
    attributes: {
      title: "New drawing",
      "aria-label": "New drawing",
      "data-action": "new-drawing",
      layout: "row",
    },
  });
  actionPanelControls.push(newDrawingButton);

  const colorInput = el("input", {
    type: "color",
    "data-setting": "color",
    className: "kids-draw-toolbar-color",
  }) as HTMLInputElement;
  toolbarControls.push(colorInput);

  const sizeInput = el("input", {
    type: "range",
    min: "1",
    max: "64",
    step: "1",
    "data-setting": "size",
    className: "kids-draw-toolbar-size",
  }) as HTMLInputElement;
  toolbarControls.push(sizeInput);

  for (const control of toolbarControls) {
    mount(element, control);
  }
  for (const control of toolSelectorControls) {
    mount(toolSelectorElement, control);
  }
  for (const control of actionPanelControls) {
    mount(actionPanelElement, control);
  }

  const setToolButtonSelected = (
    button: SquareIconButtonElement,
    selected: boolean,
  ): void => {
    button.classList.toggle("is-selected", selected);
  };

  const applyState = (state: ToolbarUiState): void => {
    const penSelected = state.activeToolId === "pen";
    const eraserSelected = state.activeToolId === "eraser";
    penButton.setAttribute("aria-pressed", penSelected ? "true" : "false");
    eraserButton.setAttribute("aria-pressed", eraserSelected ? "true" : "false");
    setToolButtonSelected(penButton, penSelected);
    setToolButtonSelected(eraserButton, eraserSelected);
    undoButton.disabled = !state.canUndo;
    redoButton.disabled = !state.canRedo;
    newDrawingButton.disabled = state.newDrawingPending;
    if (colorInput.value !== state.strokeColor) {
      colorInput.value = state.strokeColor;
    }
    const strokeWidth = `${Math.max(1, Math.round(state.strokeWidth))}`;
    if (sizeInput.value !== strokeWidth) {
      sizeInput.value = strokeWidth;
    }
  };

  const bindUiState = (state: ReadableAtom<ToolbarUiState>): (() => void) => {
    applyState(state.get());
    return state.subscribe(applyState);
  };

  return {
    element,
    toolSelectorElement,
    actionPanelElement,
    penButton,
    eraserButton,
    undoButton,
    redoButton,
    clearButton,
    newDrawingButton,
    colorInput,
    sizeInput,
    bindUiState,
  };
}
