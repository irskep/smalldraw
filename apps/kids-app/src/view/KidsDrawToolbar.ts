import "./KidsDrawToolbar.css";

import { FilePlus, Redo2, Trash2, Undo2 } from "lucide";
import type { ReadableAtom } from "nanostores";
import { el, mount } from "redom";
import type {
  KidsToolConfig,
  KidsToolFamilyConfig,
  ToolbarItem,
} from "../tools/kidsTools";
import type { ToolbarUiState } from "../ui/stores/toolbarUiStore";
import {
  createSquareIconButton,
  type SquareIconButton,
} from "./SquareIconButton";

export interface KidsDrawToolbar {
  readonly topElement: HTMLDivElement;
  readonly bottomElement: HTMLDivElement;
  readonly toolSelectorElement: HTMLDivElement;
  readonly actionPanelElement: HTMLDivElement;
  readonly familyButtons: Map<string, SquareIconButton>;
  readonly directToolButtons: Map<string, SquareIconButton>;
  readonly variantButtons: Map<string, SquareIconButton>;
  readonly familyVariantToolbars: Map<string, HTMLDivElement>;
  readonly undoButton: SquareIconButton;
  readonly redoButton: SquareIconButton;
  readonly clearButton: SquareIconButton;
  readonly newDrawingButton: SquareIconButton;
  readonly strokeColorSwatchButtons: HTMLButtonElement[];
  readonly fillColorSwatchButtons: HTMLButtonElement[];
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

export function createKidsDrawToolbar(options: {
  tools: KidsToolConfig[];
  families: KidsToolFamilyConfig[];
  sidebarItems: ToolbarItem[];
}): KidsDrawToolbar {
  const { tools, families, sidebarItems } = options;

  const topElement = el(
    "div.kids-draw-toolbar.kids-draw-toolbar-top",
  ) as HTMLDivElement;
  const bottomElement = el(
    "div.kids-draw-toolbar.kids-draw-toolbar-bottom",
  ) as HTMLDivElement;
  const toolSelectorElement = el(
    "div.kids-draw-tool-selector.kids-toolbar-grid-panel",
  ) as HTMLDivElement;
  const actionPanelElement = el(
    "div.kids-draw-action-panel.kids-toolbar-grid-panel",
  ) as HTMLDivElement;

  const toolById = new Map(tools.map((tool) => [tool.id, tool] as const));
  const familyById = new Map(
    families.map((family) => [family.id, family] as const),
  );
  const familyIdByToolId = new Map(
    tools.map((tool) => [tool.id, tool.familyId] as const),
  );

  const familyButtons = new Map<string, SquareIconButton>();
  const directToolButtons = new Map<string, SquareIconButton>();
  for (const item of sidebarItems) {
    if (item.kind === "family") {
      const family = familyById.get(item.familyId);
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
      familyButtons.set(family.id, button);
      mount(toolSelectorElement, button.el);
      continue;
    }

    const tool = toolById.get(item.toolId);
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
    directToolButtons.set(tool.id, button);
    mount(toolSelectorElement, button.el);
  }

  const variantButtons = new Map<string, SquareIconButton>();
  const familyVariantToolbars = new Map<string, HTMLDivElement>();
  for (const family of families) {
    const panel = el("div.kids-draw-family-variants.kids-toolbar-grid-panel", {
      role: "radiogroup",
      "aria-label": `${family.label} tools`,
      "data-tool-family-toolbar": family.id,
    }) as HTMLDivElement;

    for (const toolId of family.toolIds) {
      const tool = toolById.get(toolId);
      if (!tool) continue;
      const variantButton = createSquareIconButton({
        className: "kids-draw-tool-variant-button",
        label: tool.label,
        icon: tool.icon,
        attributes: {
          "data-tool-variant": tool.id,
          "data-tool-family": tool.familyId,
          title: tool.label,
          "aria-label": tool.label,
        },
      });
      variantButtons.set(tool.id, variantButton);
      mount(panel, variantButton.el);
    }

    familyVariantToolbars.set(family.id, panel);
    mount(bottomElement, panel);
  }

  const undoButton = createSquareIconButton({
    className: "kids-draw-action-button kids-draw-action-undo",
    label: "Undo",
    icon: Undo2,
    attributes: {
      title: "Undo",
      "aria-label": "Undo",
      "data-action": "undo",
    },
  });
  mount(actionPanelElement, undoButton.el);

  const redoButton = createSquareIconButton({
    className: "kids-draw-action-button kids-draw-action-redo",
    label: "Redo",
    icon: Redo2,
    attributes: {
      title: "Redo",
      "aria-label": "Redo",
      "data-action": "redo",
    },
  });
  mount(actionPanelElement, redoButton.el);

  const clearButton = createSquareIconButton({
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
  mount(actionPanelElement, clearButton.el);

  const newDrawingButton = createSquareIconButton({
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
  mount(actionPanelElement, newDrawingButton.el);

  const createColorSwatches = (options: {
    target: "stroke" | "fill";
    label: string;
  }): {
    element: HTMLDivElement;
    swatches: HTMLButtonElement[];
  } => {
    const swatches: HTMLButtonElement[] = [];
    const swatchesElement = el("div.kids-draw-color-swatches", {
      role: "radiogroup",
      "aria-label": `${options.label} palette`,
      "data-style-target": options.target,
    }) as HTMLDivElement;
    for (const swatch of COLOR_SWATCHES) {
      const swatchButton = el("button", {
        type: "button",
        className: "kids-draw-color-swatch",
        title: swatch.label,
        "aria-label": swatch.label,
        "aria-pressed": "false",
        "data-setting": `${options.target}-color`,
        "data-style-target": options.target,
        "data-color": swatch.value,
        style: `--kd-swatch-color:${swatch.value}`,
      }) as HTMLButtonElement;
      swatches.push(swatchButton);
      mount(swatchesElement, swatchButton);
    }

    return { element: swatchesElement, swatches };
  };

  const strokeSwatches = createColorSwatches({
    target: "stroke",
    label: "Stroke",
  });
  const fillSwatches = createColorSwatches({
    target: "fill",
    label: "Fill",
  });
  const strokeColorSwatchButtons = strokeSwatches.swatches;
  const fillColorSwatchButtons = fillSwatches.swatches;

  const stylePickersElement = el(
    "div.kids-draw-style-pickers",
  ) as HTMLDivElement;
  mount(stylePickersElement, strokeSwatches.element);
  mount(stylePickersElement, fillSwatches.element);

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
        style: `--kd-stroke-preview-size:${previewSize.toFixed(1)}px`,
      }),
    ) as HTMLButtonElement;
    strokeWidthButtons.push(widthButton);
    mount(strokeWidthElement, widthButton);
  }

  const colorPanelElement = el(
    "div.kids-draw-toolbar-panel.kids-draw-toolbar-colors.kids-toolbar-grid-panel",
  ) as HTMLDivElement;
  mount(colorPanelElement, stylePickersElement);

  const strokePanelElement = el(
    "div.kids-draw-toolbar-panel.kids-draw-toolbar-strokes.kids-toolbar-grid-panel",
  ) as HTMLDivElement;
  mount(strokePanelElement, strokeWidthElement);

  mount(topElement, colorPanelElement);
  mount(topElement, strokePanelElement);

  const setToggleSelectedState = (
    button: HTMLButtonElement,
    selected: boolean,
  ): void => {
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", selected ? "true" : "false");
  };

  const resolveActiveFamilyId = (activeToolId: string): string => {
    const activeFamilyId = familyIdByToolId.get(activeToolId);
    if (activeFamilyId && familyById.has(activeFamilyId)) {
      return activeFamilyId;
    }
    return families[0]?.id ?? "";
  };

  const applyState = (state: ToolbarUiState): void => {
    const normalizedStrokeColor = state.strokeColor.toLowerCase();
    const normalizedFillColor = state.fillColor.toLowerCase();
    const activeToolId = toolById.has(state.activeToolId)
      ? state.activeToolId
      : (tools[0]?.id ??
        familyById.get(families[0]?.id ?? "")?.defaultToolId ??
        "");
    const activeFamilyId = resolveActiveFamilyId(activeToolId);

    for (const [familyId, button] of familyButtons) {
      const selected = familyId === activeFamilyId;
      button.setSelected(selected);
    }
    for (const [toolId, button] of directToolButtons) {
      const selected = toolId === activeToolId;
      button.setSelected(selected);
    }

    for (const [toolId, button] of variantButtons) {
      const selected = toolId === activeToolId;
      button.setSelected(selected);
    }
    for (const [familyId, panel] of familyVariantToolbars) {
      panel.hidden = familyId !== activeFamilyId;
    }

    undoButton.setDisabled(!state.canUndo);
    redoButton.setDisabled(!state.canRedo);
    newDrawingButton.setDisabled(state.newDrawingPending);

    for (const swatchButton of strokeColorSwatchButtons) {
      const selected =
        swatchButton.dataset.color?.toLowerCase() === normalizedStrokeColor;
      setToggleSelectedState(swatchButton, selected);
      swatchButton.disabled = !state.supportsStrokeColor;
    }
    for (const swatchButton of fillColorSwatchButtons) {
      const selected =
        swatchButton.dataset.color?.toLowerCase() === normalizedFillColor;
      setToggleSelectedState(swatchButton, selected);
      swatchButton.disabled = !state.supportsFillColor;
    }
    fillSwatches.element.classList.toggle(
      "is-disabled",
      !state.supportsFillColor,
    );
    strokeSwatches.element.classList.toggle(
      "is-disabled",
      !state.supportsStrokeColor,
    );
    fillSwatches.element.style.setProperty(
      "--kd-swatch-selected-stroke",
      state.strokeColor,
    );
    strokeSwatches.element.style.setProperty(
      "--kd-swatch-selected-fill",
      state.fillColor,
    );

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
      setToggleSelectedState(widthButton, selected);
      widthButton.disabled = !state.supportsStrokeWidth;
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
    directToolButtons,
    variantButtons,
    familyVariantToolbars,
    undoButton,
    redoButton,
    clearButton,
    newDrawingButton,
    strokeColorSwatchButtons,
    fillColorSwatchButtons,
    strokeWidthButtons,
    bindUiState,
  };
}
