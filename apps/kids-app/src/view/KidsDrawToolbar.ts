import { el, mount } from "redom";

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
  syncButtons(state: {
    activeToolId: string;
    canUndo: boolean;
    canRedo: boolean;
  }): void;
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

  const element = el("div.kids-draw-toolbar", {
    style: {
      display: "flex",
      "align-items": "center",
      gap: "8px",
      padding: "6px",
      border: "1px dashed #2563eb",
      background: "#dbeafe",
    },
  }) as HTMLDivElement;

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
    button.style.border = selected ? "2px solid #111827" : "1px solid #9ca3af";
    button.style.background = selected ? "#93c5fd" : "#ffffff";
    button.style.fontWeight = selected ? "700" : "400";
  };

  const syncButtons = (state: {
    activeToolId: string;
    canUndo: boolean;
    canRedo: boolean;
  }): void => {
    const penSelected = state.activeToolId === "pen";
    const eraserSelected = state.activeToolId === "eraser";
    penButton.setAttribute("aria-pressed", penSelected ? "true" : "false");
    eraserButton.setAttribute("aria-pressed", eraserSelected ? "true" : "false");
    setToolButtonSelected(penButton, penSelected);
    setToolButtonSelected(eraserButton, eraserSelected);
    undoButton.disabled = !state.canUndo;
    redoButton.disabled = !state.canRedo;
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
    syncButtons,
  };
}
