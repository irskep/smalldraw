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
  readonly colorSwatchButtons: HTMLButtonElement[];
  readonly strokeWidthButtons: HTMLButtonElement[];
  bindUiState(state: ReadableAtom<ToolbarUiState>): () => void;
}

const COLOR_SWATCHES = [
  { value: "#000000", label: "Black" },
  { value: "#ffffff", label: "White" },
  { value: "#ff4d6d", label: "Strawberry" },
  { value: "#ff8a00", label: "Orange Pop" },
  { value: "#ffdb4d", label: "Sunshine" },
  { value: "#63c132", label: "Lime" },
  { value: "#00b894", label: "Mint" },
  { value: "#2e86ff", label: "Sky Blue" },
  { value: "#6c5ce7", label: "Blueberry" },
  { value: "#ff66c4", label: "Bubblegum" },
] as const;

const STROKE_WIDTH_OPTIONS = [2, 8, 24, 80, 200] as const;

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

  const colorSwatchButtons: HTMLButtonElement[] = [];
  const colorSwatchesElement = el("div.kids-draw-color-swatches", {
    role: "radiogroup",
    "aria-label": "Color palette",
  }) as HTMLDivElement;
  for (const swatch of COLOR_SWATCHES) {
    const swatchButton = el("button", {
      type: "button",
      className: "kids-draw-color-swatch",
      title: swatch.label,
      "aria-label": swatch.label,
      "aria-pressed": "false",
      "data-setting": "color",
      "data-color": swatch.value,
      style: `--kids-swatch-color:${swatch.value}`,
    }) as HTMLButtonElement;
    colorSwatchButtons.push(swatchButton);
    mount(colorSwatchesElement, swatchButton);
  }

  const minPreviewSize = 2;
  const maxPreviewSize = 18;
  const minLog = Math.log(STROKE_WIDTH_OPTIONS[0]);
  const maxLog = Math.log(STROKE_WIDTH_OPTIONS[STROKE_WIDTH_OPTIONS.length - 1]);
  const toPreviewSize = (strokeWidth: number): number => {
    const normalized =
      (Math.log(strokeWidth) - minLog) / Math.max(1e-6, maxLog - minLog);
    return minPreviewSize + normalized * (maxPreviewSize - minPreviewSize);
  };

  const strokeWidthButtons: HTMLButtonElement[] = [];
  const strokeWidthElement = el("div.kids-draw-stroke-widths", {
    role: "radiogroup",
    "aria-label": "Brush size",
  }) as HTMLDivElement;
  for (const strokeWidth of STROKE_WIDTH_OPTIONS) {
    const previewSize = toPreviewSize(strokeWidth);
    const widthButton = el(
      "button.kids-draw-stroke-width-button",
      {
        type: "button",
        title: `${strokeWidth}px brush`,
        "aria-label": `${strokeWidth}px brush`,
        "aria-pressed": "false",
        "data-setting": "stroke-width",
        "data-size": `${strokeWidth}`,
      },
      el("span.kids-draw-stroke-width-line", {
        style: `--kids-stroke-preview-size:${previewSize.toFixed(1)}px`,
      }),
    ) as HTMLButtonElement;
    strokeWidthButtons.push(widthButton);
    mount(strokeWidthElement, widthButton);
  }

  const colorPanelElement = el(
    "div.kids-draw-toolbar-panel.kids-draw-toolbar-colors",
  ) as HTMLDivElement;
  mount(colorPanelElement, colorSwatchesElement);

  const strokePanelElement = el(
    "div.kids-draw-toolbar-panel.kids-draw-toolbar-strokes",
  ) as HTMLDivElement;
  mount(strokePanelElement, strokeWidthElement);

  mount(element, colorPanelElement);
  mount(element, strokePanelElement);
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
    const normalizedStateColor = state.strokeColor.toLowerCase();
    const penSelected = state.activeToolId === "pen";
    const eraserSelected = state.activeToolId === "eraser";
    penButton.setAttribute("aria-pressed", penSelected ? "true" : "false");
    eraserButton.setAttribute("aria-pressed", eraserSelected ? "true" : "false");
    setToolButtonSelected(penButton, penSelected);
    setToolButtonSelected(eraserButton, eraserSelected);
    undoButton.disabled = !state.canUndo;
    redoButton.disabled = !state.canRedo;
    newDrawingButton.disabled = state.newDrawingPending;

    for (const swatchButton of colorSwatchButtons) {
      const selected =
        swatchButton.dataset.color?.toLowerCase() === normalizedStateColor;
      swatchButton.classList.toggle("is-selected", selected);
      swatchButton.setAttribute("aria-pressed", selected ? "true" : "false");
    }

    let nearestStrokeWidth: number = STROKE_WIDTH_OPTIONS[0];
    let nearestDelta = Math.abs(state.strokeWidth - nearestStrokeWidth);
    for (const strokeWidth of STROKE_WIDTH_OPTIONS) {
      const delta = Math.abs(state.strokeWidth - strokeWidth);
      if (delta < nearestDelta) {
        nearestStrokeWidth = strokeWidth;
        nearestDelta = delta;
      }
    }
    for (const widthButton of strokeWidthButtons) {
      const width = Number(widthButton.dataset.size);
      const selected = Number.isFinite(width) && width === nearestStrokeWidth;
      widthButton.classList.toggle("is-selected", selected);
      widthButton.setAttribute("aria-pressed", selected ? "true" : "false");
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
    colorSwatchButtons,
    strokeWidthButtons,
    bindUiState,
  };
}
