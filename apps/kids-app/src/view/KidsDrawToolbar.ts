import { el, mount } from "redom";
import type { ReadableAtom } from "nanostores";
import type { ToolbarUiState } from "../ui/stores/toolbarUiStore";

export interface KidsDrawToolbar {
  readonly element: HTMLDivElement;
  readonly penButton: HTMLButtonElement;
  readonly eraserButton: HTMLButtonElement;
  readonly undoButton: HTMLButtonElement;
  readonly redoButton: HTMLButtonElement;
  readonly clearButton: HTMLButtonElement;
  readonly newDrawingButton: HTMLButtonElement;
  readonly colorInput: HTMLInputElement;
  readonly sizeInput: HTMLInputElement;
  bindUiState(state: ReadableAtom<ToolbarUiState>): () => void;
}

export function createKidsDrawToolbar(): KidsDrawToolbar {
  const controls: HTMLElement[] = [];
  const createButton = (attrs: Record<string, string>): HTMLButtonElement => {
    const button = el("button", {
      type: "button",
      ...attrs,
    }) as HTMLButtonElement;
    controls.push(button);
    return button;
  };

  const element = el("div.kids-draw-toolbar") as HTMLDivElement;

  const penButton = createButton({ textContent: "Pen", "data-tool": "pen" });
  const eraserButton = createButton({ textContent: "Eraser", "data-tool": "eraser" });
  const undoButton = createButton({
    textContent: "↩️",
    title: "Undo",
    "aria-label": "Undo",
    "data-action": "undo",
  });
  const redoButton = createButton({
    textContent: "↪️",
    title: "Redo",
    "aria-label": "Redo",
    "data-action": "redo",
  });
  const clearButton = createButton({
    textContent: "Clear",
    title: "Clear canvas",
    "aria-label": "Clear canvas",
    "data-action": "clear",
  });
  const newDrawingButton = createButton({
    textContent: "New",
    title: "New drawing",
    "aria-label": "New drawing",
    "data-action": "new-drawing",
  });
  const colorInput = el("input", {
    type: "color",
    "data-setting": "color",
  }) as HTMLInputElement;
  controls.push(colorInput);
  const sizeInput = el("input", {
    type: "range",
    min: "1",
    max: "64",
    step: "1",
    "data-setting": "size",
  }) as HTMLInputElement;
  controls.push(sizeInput);

  for (const control of controls) {
    mount(element, control);
  }

  const setToolButtonSelected = (
    button: HTMLButtonElement,
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
