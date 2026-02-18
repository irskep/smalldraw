import "./KidsDrawToolbar.css";

import { Download, FilePlus, FolderOpen, Redo2, Trash2, Undo2 } from "lucide";
import { computed, type ReadableAtom } from "nanostores";
import { el, mount } from "redom";
import type {
  KidsToolConfig,
  KidsToolFamilyConfig,
  ToolbarItem,
} from "../tools/kidsTools";
import type { ToolbarUiState } from "../ui/stores/toolbarUiStore";
import { type ButtonGrid, createButtonGrid } from "./ButtonGrid";
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
  readonly exportButton: SquareIconButton;
  readonly newDrawingButton: SquareIconButton;
  readonly browseButton: SquareIconButton;
  readonly strokeColorSwatchButtons: HTMLButtonElement[];
  readonly strokeWidthButtons: HTMLButtonElement[];
  bindUiState(state: ReadableAtom<ToolbarUiState>): () => void;
  syncLayout(): void;
  destroy(): void;
}

interface ColorSwatchConfig {
  value: string;
  label: string;
}

const COLOR_SWATCHES: ColorSwatchConfig[] = [
  { value: "#000000", label: "Black" },
  { value: "#ffffff", label: "White" },
  { value: "#8b5a2b", label: "Brown" },
  { value: "#ff4d6d", label: "Strawberry" },
  { value: "#ff8a00", label: "Orange Pop" },
  { value: "#ffdb4d", label: "Sunshine" },
  { value: "#63c132", label: "Lime" },
  { value: "#00b894", label: "Mint" },
  { value: "#2e86ff", label: "Sky Blue" },
  { value: "#6c5ce7", label: "Blueberry" },
  { value: "#ff66c4", label: "Bubblegum" },
  { value: "#9ca3af", label: "Gray" },
];

export const STROKE_WIDTH_OPTIONS = [2, 4, 8, 16, 24, 48, 96, 200] as const;

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
  const actionPanelElement = el(
    "div.kids-draw-action-panel.kids-toolbar-grid-panel",
  ) as HTMLDivElement;
  const toolSelectorGrid = createButtonGrid({
    className: "kids-draw-tool-selector",
    orientation: "vertical",
  });
  const toolSelectorElement = toolSelectorGrid.el;

  const toolById = new Map(tools.map((tool) => [tool.id, tool] as const));
  const familyById = new Map(
    families.map((family) => [family.id, family] as const),
  );
  const familyIdByToolId = new Map(
    tools.map((tool) => [tool.id, tool.familyId] as const),
  );

  const familyButtons = new Map<string, SquareIconButton>();
  const directToolButtons = new Map<string, SquareIconButton>();
  const toolSelectorItems: { id: string; element: HTMLElement }[] = [];
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
      toolSelectorItems.push({
        id: `family:${family.id}`,
        element: button.el,
      });
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
    toolSelectorItems.push({
      id: `tool:${tool.id}`,
      element: button.el,
    });
  }
  toolSelectorGrid.setLists([{ id: "main", items: toolSelectorItems }]);

  const variantButtons = new Map<string, SquareIconButton>();
  const familyVariantToolbars = new Map<string, HTMLDivElement>();
  const familyVariantContainers = new Map<string, HTMLDivElement>();
  const familyVariantGrids = new Map<string, ButtonGrid>();
  let ensureVisibleRafHandle: number | null = null;
  for (const family of families) {
    const isTwoRowSingleHeight =
      family.variantLayout === "two-row-single-height";
    const hideVariantLabels = family.id.startsWith("stamp.");
    const isStampImages = family.id === "stamp.images";
    const variantItems: { id: string; element: HTMLElement }[] = [];
    for (const toolId of family.toolIds) {
      const tool = toolById.get(toolId);
      if (!tool) continue;
      const variantButton = createSquareIconButton({
        className: "kids-draw-tool-variant-button",
        label: hideVariantLabels ? "" : tool.label,
        icon: tool.icon,
        attributes: {
          "data-tool-variant": tool.id,
          "data-tool-family": tool.familyId,
          title: tool.label,
          "aria-label": tool.label,
          role: "radio",
          "aria-checked": "false",
          tabindex: "-1",
        },
      });
      variantButtons.set(tool.id, variantButton);
      variantItems.push({
        id: tool.id,
        element: variantButton.el,
      });
    }

    const variantGrid = createButtonGrid({
      className: "kids-draw-family-variants",
      orientation: "horizontal",
      largeLayout: isTwoRowSingleHeight ? "two-row" : "two-row-xlarge",
      paginateInLarge: isStampImages,
    });
    variantGrid.el.setAttribute("role", "radiogroup");
    variantGrid.el.setAttribute("aria-label", `${family.label} tools`);
    variantGrid.el.setAttribute("data-tool-family-toolbar", family.id);
    variantGrid.el.setAttribute(
      "data-variant-layout",
      family.variantLayout ?? "default",
    );
    if (family.id === "stamp.images") {
      variantGrid.prevButton.el.setAttribute(
        "data-tool-family-prev",
        family.id,
      );
      variantGrid.nextButton.el.setAttribute(
        "data-tool-family-next",
        family.id,
      );
    }
    variantGrid.setLists([{ id: "main", items: variantItems }]);

    familyVariantToolbars.set(family.id, variantGrid.el);
    familyVariantContainers.set(family.id, variantGrid.el);
    familyVariantGrids.set(family.id, variantGrid);
    mount(bottomElement, variantGrid.el);
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

  const actionSpacer = el("div.kids-draw-action-spacer", {
    "aria-hidden": "true",
  }) as HTMLDivElement;
  mount(actionPanelElement, actionSpacer);

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

  const exportButton = createSquareIconButton({
    className: "kids-draw-action-button kids-draw-action-export",
    label: "Export",
    icon: Download,
    attributes: {
      title: "Export PNG",
      "aria-label": "Export PNG",
      "data-action": "export",
      layout: "row",
    },
  });
  mount(actionPanelElement, exportButton.el);

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

  const browseButton = createSquareIconButton({
    className: "kids-draw-action-button kids-draw-action-browse",
    label: "Browse",
    icon: FolderOpen,
    attributes: {
      title: "Browse drawings",
      "aria-label": "Browse drawings",
      "data-action": "browse",
      layout: "row",
    },
  });
  mount(actionPanelElement, browseButton.el);

  const createColorSwatches = (): {
    element: HTMLDivElement;
    swatches: HTMLButtonElement[];
  } => {
    const swatches: HTMLButtonElement[] = [];
    const swatchesElement = el("div.kids-draw-color-swatches", {
      role: "radiogroup",
      "aria-label": "Color palette",
      "data-style-target": "stroke",
    }) as HTMLDivElement;
    for (const swatch of COLOR_SWATCHES) {
      const swatchAttributes: Record<string, string> = {
        type: "button",
        className: "kids-draw-color-swatch",
        title: swatch.label,
        "aria-label": swatch.label,
        role: "radio",
        "aria-checked": "false",
        tabindex: "-1",
        "data-setting": "stroke-color",
        "data-style-target": "stroke",
        "data-color": swatch.value,
        style: `--kd-swatch-color:${swatch.value}`,
      };
      const swatchButton = el("button", swatchAttributes) as HTMLButtonElement;
      swatches.push(swatchButton);
      mount(swatchesElement, swatchButton);
    }

    return { element: swatchesElement, swatches };
  };

  const strokeSwatches = createColorSwatches();
  const strokeColorSwatchButtons = strokeSwatches.swatches;

  const stylePickersElement = el(
    "div.kids-draw-style-pickers",
  ) as HTMLDivElement;
  const strokeColorsPanelElement = el(
    "div.kids-draw-toolbar-panel.kids-draw-toolbar-color-surface.kids-toolbar-grid-panel",
  ) as HTMLDivElement;
  mount(strokeColorsPanelElement, strokeSwatches.element);
  mount(stylePickersElement, strokeColorsPanelElement);

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
        role: "radio",
        "aria-checked": "false",
        tabindex: "-1",
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
    "div.kids-draw-toolbar-colors",
  ) as HTMLDivElement;
  mount(colorPanelElement, stylePickersElement);

  const strokePanelElement = el(
    "div.kids-draw-toolbar-panel.kids-draw-toolbar-strokes.kids-toolbar-grid-panel",
  ) as HTMLDivElement;
  mount(strokePanelElement, strokeWidthElement);

  mount(topElement, colorPanelElement);
  mount(topElement, strokePanelElement);

  const setRadioSelectedState = (
    button: HTMLButtonElement,
    selected: boolean,
  ): void => {
    button.classList.toggle("is-selected", selected);
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", selected ? "true" : "false");
    button.tabIndex = selected ? 0 : -1;
    button.removeAttribute("aria-pressed");
  };

  const resolveActiveFamilyId = (activeToolId: string): string => {
    const activeFamilyId = familyIdByToolId.get(activeToolId);
    if (activeFamilyId && familyById.has(activeFamilyId)) {
      return activeFamilyId;
    }
    return families[0]?.id ?? "";
  };

  const resolveActiveToolId = (activeToolId: string): string => {
    return toolById.has(activeToolId)
      ? activeToolId
      : (tools[0]?.id ??
        familyById.get(families[0]?.id ?? "")?.defaultToolId ??
        "");
  };

  const resolveToolSelectorSelectedItemId = (
    activeToolId: string,
    activeFamilyId: string,
  ): string => {
    if (directToolButtons.has(activeToolId)) {
      return `tool:${activeToolId}`;
    }
    if (familyButtons.has(activeFamilyId)) {
      return `family:${activeFamilyId}`;
    }
    return "";
  };

  let unbindToolSelectorSelection: (() => void) | null = null;
  let unbindVariantSelections: Array<() => void> = [];

  const applyState = (state: ToolbarUiState): void => {
    const normalizedStrokeColor = state.strokeColor.toLowerCase();
    const activeToolId = resolveActiveToolId(state.activeToolId);
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
      button.setRadioSelected(selected);
    }
    for (const [familyId, container] of familyVariantContainers) {
      const isActive = familyId === activeFamilyId;
      container.hidden = !isActive;
      if (isActive) {
        const grid = familyVariantGrids.get(familyId);
        grid?.syncLayout();
        if (ensureVisibleRafHandle !== null) {
          window.cancelAnimationFrame(ensureVisibleRafHandle);
        }
        ensureVisibleRafHandle = window.requestAnimationFrame(() => {
          ensureVisibleRafHandle = null;
          toolSelectorGrid.syncLayout();
          grid?.syncLayout();
        });
      }
    }

    undoButton.setDisabled(!state.canUndo);
    redoButton.setDisabled(!state.canRedo);
    newDrawingButton.setDisabled(state.newDrawingPending);

    const selectedSwatchIndex = Math.max(
      0,
      strokeColorSwatchButtons.findIndex(
        (swatchButton) =>
          swatchButton.dataset.color?.toLowerCase() === normalizedStrokeColor,
      ),
    );
    for (const [index, swatchButton] of strokeColorSwatchButtons.entries()) {
      const selected = index === selectedSwatchIndex;
      setRadioSelectedState(swatchButton, selected);
      swatchButton.disabled = !state.supportsStrokeColor;
    }
    strokeSwatches.element.classList.toggle(
      "is-disabled",
      !state.supportsStrokeColor,
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
    const selectedWidthIndex = strokeWidthButtons.findIndex((widthButton) => {
      const width = Number(widthButton.dataset.size);
      return Number.isFinite(width) && width === nearestStrokeWidth;
    });
    const resolvedWidthIndex = Math.max(0, selectedWidthIndex);
    for (const [index, widthButton] of strokeWidthButtons.entries()) {
      const selected = index === resolvedWidthIndex;
      setRadioSelectedState(widthButton, selected);
      widthButton.disabled = !state.supportsStrokeWidth;
    }
  };

  const bindUiState = (state: ReadableAtom<ToolbarUiState>): (() => void) => {
    unbindToolSelectorSelection?.();
    unbindVariantSelections.forEach((unbind) => unbind());
    const selectedToolIdStore = computed(state, (nextState) =>
      resolveActiveToolId(nextState.activeToolId),
    );
    const toolSelectorSelectionStore = computed(state, (nextState) => {
      const activeToolId = resolveActiveToolId(nextState.activeToolId);
      const activeFamilyId = resolveActiveFamilyId(activeToolId);
      return resolveToolSelectorSelectedItemId(activeToolId, activeFamilyId);
    });
    unbindToolSelectorSelection =
      toolSelectorGrid.bindSelection(toolSelectorSelectionStore);
    unbindVariantSelections = Array.from(familyVariantGrids.values(), (grid) =>
      grid.bindSelection(selectedToolIdStore),
    );

    applyState(state.get());
    const unbindUiState = state.subscribe(applyState);
    return () => {
      unbindUiState();
      unbindToolSelectorSelection?.();
      unbindToolSelectorSelection = null;
      unbindVariantSelections.forEach((unbind) => unbind());
      unbindVariantSelections = [];
    };
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
    exportButton,
    newDrawingButton,
    browseButton,
    strokeColorSwatchButtons,
    strokeWidthButtons,
    bindUiState,
    syncLayout() {
      toolSelectorGrid.syncLayout();
      for (const grid of familyVariantGrids.values()) {
        grid.syncLayout();
      }
    },
    destroy() {
      if (ensureVisibleRafHandle !== null) {
        window.cancelAnimationFrame(ensureVisibleRafHandle);
        ensureVisibleRafHandle = null;
      }
      unbindToolSelectorSelection?.();
      unbindToolSelectorSelection = null;
      for (const unbind of unbindVariantSelections) {
        unbind();
      }
      unbindVariantSelections = [];
      toolSelectorGrid.destroy();
      for (const grid of familyVariantGrids.values()) {
        grid.destroy();
      }
    },
  };
}
