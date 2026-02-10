import { FilePlus, type IconNode, Redo2, Trash2, Undo2 } from "lucide";
import type { ReadableAtom } from "nanostores";
import { el, mount } from "redom";
import type { KidsToolConfig, KidsToolFamilyConfig } from "../tools/kidsTools";
import type { ToolbarUiState } from "../ui/stores/toolbarUiStore";
import {
  ensureSquareIconButtonDefined,
  SquareIconButtonElement,
} from "./SquareIconButton";

export interface KidsDrawToolbar {
  readonly topElement: HTMLDivElement;
  readonly bottomElement: HTMLDivElement;
  readonly toolSelectorElement: HTMLDivElement;
  readonly actionPanelElement: HTMLDivElement;
  readonly familyButtons: Map<string, SquareIconButtonElement>;
  readonly variantButtons: Map<string, SquareIconButtonElement>;
  readonly familyVariantToolbars: Map<string, HTMLDivElement>;
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

const STROKE_WIDTH_OPTIONS = [2, 4, 8, 16, 24, 48, 96, 200] as const;

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

export function createKidsDrawToolbar(options: {
  tools: KidsToolConfig[];
  families: KidsToolFamilyConfig[];
}): KidsDrawToolbar {
  ensureSquareIconButtonDefined();
  const { tools, families } = options;

  const topElement = el(
    "div.kids-draw-toolbar.kids-draw-toolbar-top",
  ) as HTMLDivElement;
  const bottomElement = el(
    "div.kids-draw-toolbar.kids-draw-toolbar-bottom",
  ) as HTMLDivElement;
  const toolSelectorElement = el(
    "div.kids-draw-tool-selector",
  ) as HTMLDivElement;
  const actionPanelElement = el("div.kids-draw-action-panel") as HTMLDivElement;

  const toolById = new Map(tools.map((tool) => [tool.id, tool] as const));
  const familyById = new Map(
    families.map((family) => [family.id, family] as const),
  );
  const familyIdByToolId = new Map(
    tools.map((tool) => [tool.id, tool.familyId] as const),
  );

  const familyButtons = new Map<string, SquareIconButtonElement>();
  for (const family of families) {
    const button = createSquareButton({
      className: "kids-draw-tool-button",
      label: family.label,
      icon: family.icon,
      attributes: {
        "data-tool-family": family.id,
        title: family.label,
        "aria-label": family.label,
      },
    });
    familyButtons.set(family.id, button);
    mount(toolSelectorElement, button);
  }

  const variantButtons = new Map<string, SquareIconButtonElement>();
  const familyVariantToolbars = new Map<string, HTMLDivElement>();
  for (const family of families) {
    const panel = el("div.kids-draw-family-variants", {
      role: "radiogroup",
      "aria-label": `${family.label} tools`,
      "data-tool-family-toolbar": family.id,
    }) as HTMLDivElement;

    for (const toolId of family.toolIds) {
      const tool = toolById.get(toolId);
      if (!tool) continue;
      const variantButton = createSquareButton({
        className: "kids-draw-tool-variant-button",
        label: tool.label,
        icon: tool.icon,
        attributes: {
          "data-tool-variant": tool.id,
          "data-tool-family": tool.familyId,
          title: tool.label,
          "aria-label": tool.label,
          "aria-pressed": "false",
        },
      });
      variantButtons.set(tool.id, variantButton);
      mount(panel, variantButton);
    }

    familyVariantToolbars.set(family.id, panel);
    mount(bottomElement, panel);
  }

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
  mount(actionPanelElement, undoButton);

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
  mount(actionPanelElement, redoButton);

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
  mount(actionPanelElement, clearButton);

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
  mount(actionPanelElement, newDrawingButton);

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
  const maxLog = Math.log(
    STROKE_WIDTH_OPTIONS[STROKE_WIDTH_OPTIONS.length - 1],
  );
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

  mount(topElement, colorPanelElement);
  mount(topElement, strokePanelElement);

  const setToolButtonSelected = (
    button: SquareIconButtonElement,
    selected: boolean,
  ): void => {
    button.classList.toggle("is-selected", selected);
  };

  const resolveActiveFamilyId = (activeToolId: string): string => {
    const activeFamilyId = familyIdByToolId.get(activeToolId);
    if (activeFamilyId && familyById.has(activeFamilyId)) {
      return activeFamilyId;
    }
    return families[0]?.id ?? "";
  };

  const applyState = (state: ToolbarUiState): void => {
    const normalizedStateColor = state.strokeColor.toLowerCase();
    const activeFamilyId =
      (state.activeFamilyId && familyById.has(state.activeFamilyId)
        ? state.activeFamilyId
        : null) ?? resolveActiveFamilyId(state.activeToolId);

    for (const [familyId, button] of familyButtons) {
      const selected = familyId === activeFamilyId;
      button.setAttribute("aria-pressed", selected ? "true" : "false");
      setToolButtonSelected(button, selected);
    }

    for (const [toolId, button] of variantButtons) {
      const tool = toolById.get(toolId);
      const selected =
        tool?.familyId === activeFamilyId && toolId === state.activeToolId;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    }
    for (const [familyId, panel] of familyVariantToolbars) {
      panel.hidden = familyId !== activeFamilyId;
    }

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
    topElement,
    bottomElement,
    toolSelectorElement,
    actionPanelElement,
    familyButtons,
    variantButtons,
    familyVariantToolbars,
    undoButton,
    redoButton,
    clearButton,
    newDrawingButton,
    colorSwatchButtons,
    strokeWidthButtons,
    bindUiState,
  };
}
