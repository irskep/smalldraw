import "./KidsDrawToolbar.css";

import {
  ChevronLeft,
  ChevronRight,
  FilePlus,
  Redo2,
  Trash2,
  Undo2,
} from "lucide";
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
  readonly strokeWidthButtons: HTMLButtonElement[];
  bindUiState(state: ReadableAtom<ToolbarUiState>): () => void;
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

const STROKE_WIDTH_OPTIONS = [2, 4, 8, 16, 24, 48, 96, 200] as const;
const PAGED_VARIANT_ROWS = 2;
const VIEWPORT_HORIZONTAL_MARGIN_PX = 24;

interface FamilyVariantPagerState {
  familyId: string;
  panel: HTMLDivElement;
  shell: HTMLDivElement;
  viewport: HTMLDivElement;
  orderedToolIds: string[];
  orderedButtons: SquareIconButton[];
  prevButton: SquareIconButton;
  nextButton: SquareIconButton;
  pageSize: number;
}

function parsePxValue(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

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
  const familyVariantContainers = new Map<string, HTMLDivElement>();
  const familyVariantOrders = new Map<string, string[]>();
  const familyVariantPagerSync = new Map<string, () => void>();
  const familyVariantActivePage = new Map<string, number>();
  const familyVariantPagerStates = new Map<string, FamilyVariantPagerState>();
  for (const family of families) {
    const panel = el("div.kids-draw-family-variants", {
      role: "radiogroup",
      "aria-label": `${family.label} tools`,
      "data-tool-family-toolbar": family.id,
      "data-variant-layout": family.variantLayout ?? "default",
    }) as HTMLDivElement;
    if (family.variantLayout === "two-row-single-height") {
      panel.classList.add("is-two-row-single-height");
    }
    const shouldUsePagerShell =
      family.variantLayout === "two-row-single-height" &&
      family.toolIds.some((toolId) => toolId.startsWith("stamp.image."));

    const orderedToolIds: string[] = [];
    const orderedButtons: SquareIconButton[] = [];
    family.toolIds.forEach((toolId) => {
      const tool = toolById.get(toolId);
      if (!tool) return;
      const hideVariantLabel = family.variantLayout === "two-row-single-height";
      const variantButton = createSquareIconButton({
        className: "kids-draw-tool-variant-button",
        label: hideVariantLabel ? "" : tool.label,
        icon: tool.icon,
        attributes: {
          "data-tool-variant": tool.id,
          "data-tool-family": tool.familyId,
          title: tool.label,
          "aria-label": tool.label,
        },
      });
      variantButtons.set(tool.id, variantButton);
      orderedToolIds.push(tool.id);
      orderedButtons.push(variantButton);
      mount(panel, variantButton.el);
    });
    familyVariantOrders.set(family.id, orderedToolIds);

    familyVariantToolbars.set(family.id, panel);

    if (shouldUsePagerShell) {
      const viewport = el(
        "div.kids-draw-family-variants-viewport",
        panel,
      ) as HTMLDivElement;
      const prevButton = createSquareIconButton({
        className:
          "kids-draw-family-variants-nav kids-draw-family-variants-nav-prev",
        label: "",
        icon: ChevronLeft,
        attributes: {
          "aria-label": `Previous ${family.label} stamps`,
          title: "Previous",
          "data-tool-family-prev": family.id,
        },
      });
      const nextButton = createSquareIconButton({
        className:
          "kids-draw-family-variants-nav kids-draw-family-variants-nav-next",
        label: "",
        icon: ChevronRight,
        attributes: {
          "aria-label": `Next ${family.label} stamps`,
          title: "Next",
          "data-tool-family-next": family.id,
        },
      });
      const shell = el(
        "div.kids-draw-family-variants-shell",
        prevButton.el,
        viewport,
        nextButton.el,
      ) as HTMLDivElement;

      const pagerState: FamilyVariantPagerState = {
        familyId: family.id,
        panel,
        shell,
        viewport,
        orderedToolIds,
        orderedButtons,
        prevButton,
        nextButton,
        pageSize: PAGED_VARIANT_ROWS,
      };
      familyVariantPagerStates.set(family.id, pagerState);

      const getViewportPageSize = (): {
        pageSize: number;
        columnCount: number;
        pageWidth: number;
      } => {
        const shellStyles = window.getComputedStyle(shell);
        const panelStyles = window.getComputedStyle(panel);
        const shellPaddingHorizontal =
          parsePxValue(shellStyles.paddingLeft) +
          parsePxValue(shellStyles.paddingRight);
        const shellGap = parsePxValue(shellStyles.columnGap || shellStyles.gap);
        const navButtonWidth = Math.max(
          prevButton.el.getBoundingClientRect().width,
          nextButton.el.getBoundingClientRect().width,
          parsePxValue(shellStyles.getPropertyValue("--kd-toolbar-cell-size")),
        );
        const firstButton = orderedButtons[0]?.el;
        const cellWidth = Math.max(
          firstButton?.getBoundingClientRect().width ?? 0,
          parsePxValue(panelStyles.getPropertyValue("--kd-toolbar-cell-size")),
        );
        const columnGap = parsePxValue(
          panelStyles.columnGap || panelStyles.gap,
        );
        const shellParentWidth =
          shell.parentElement?.getBoundingClientRect().width ??
          bottomElement.getBoundingClientRect().width;
        const constrainedShellWidth = Math.max(
          cellWidth,
          Math.min(
            window.innerWidth - VIEWPORT_HORIZONTAL_MARGIN_PX,
            shellParentWidth > 0
              ? shellParentWidth
              : window.innerWidth - VIEWPORT_HORIZONTAL_MARGIN_PX,
          ),
        );
        const availableWidth = Math.max(
          cellWidth,
          constrainedShellWidth -
            shellPaddingHorizontal -
            navButtonWidth * 2 -
            shellGap * 2,
        );
        const maxColumns = Math.max(
          1,
          Math.ceil(orderedToolIds.length / PAGED_VARIANT_ROWS),
        );
        const columnCount = Math.max(
          1,
          Math.min(
            maxColumns,
            Math.floor((availableWidth + columnGap) / (cellWidth + columnGap)),
          ),
        );
        const pageWidth =
          columnCount * cellWidth + Math.max(0, columnCount - 1) * columnGap;
        return {
          pageSize: Math.max(1, columnCount * PAGED_VARIANT_ROWS),
          columnCount,
          pageWidth,
        };
      };

      const applyPagedVisibility = (): void => {
        const { pageSize, columnCount, pageWidth } = getViewportPageSize();
        pagerState.pageSize = pageSize;
        panel.style.setProperty(
          "--kd-family-variants-columns",
          `${columnCount}`,
        );
        viewport.style.width = `${pageWidth}px`;
        viewport.style.maxWidth = `${pageWidth}px`;
        const totalPages = Math.max(
          1,
          Math.ceil(orderedToolIds.length / pagerState.pageSize),
        );
        const currentPage = Math.max(
          0,
          Math.min(totalPages - 1, familyVariantActivePage.get(family.id) ?? 0),
        );
        familyVariantActivePage.set(family.id, currentPage);
        panel.setAttribute("data-active-page", `${currentPage}`);
        const startIndex = currentPage * pagerState.pageSize;
        const endIndex = startIndex + pagerState.pageSize;
        pagerState.orderedButtons.forEach((button, index) => {
          button.el.hidden = index < startIndex || index >= endIndex;
        });
        prevButton.setDisabled(currentPage <= 0);
        nextButton.setDisabled(currentPage >= totalPages - 1);

        const shellStyles = window.getComputedStyle(shell);
        const panelStyles = window.getComputedStyle(panel);
        const shellPaddingHorizontal =
          parsePxValue(shellStyles.paddingLeft) +
          parsePxValue(shellStyles.paddingRight);
        const shellGap = parsePxValue(shellStyles.columnGap || shellStyles.gap);
        const navButtonWidth = Math.max(
          prevButton.el.getBoundingClientRect().width,
          nextButton.el.getBoundingClientRect().width,
          parsePxValue(shellStyles.getPropertyValue("--kd-toolbar-cell-size")),
        );
        const firstButton = orderedButtons[0]?.el;
        const cellWidth = Math.max(
          firstButton?.getBoundingClientRect().width ?? 0,
          parsePxValue(panelStyles.getPropertyValue("--kd-toolbar-cell-size")),
        );
        const columnGap = parsePxValue(
          panelStyles.columnGap || panelStyles.gap,
        );
        const constrainedShellWidth = Math.max(
          cellWidth,
          Math.min(
            window.innerWidth - VIEWPORT_HORIZONTAL_MARGIN_PX,
            shell.parentElement?.getBoundingClientRect().width ??
              bottomElement.getBoundingClientRect().width,
          ),
        );
        const measuredShellWidth = shell.getBoundingClientRect().width;
        const availableWidth = Math.max(
          cellWidth,
          constrainedShellWidth -
            shellPaddingHorizontal -
            navButtonWidth * 2 -
            shellGap * 2,
        );
        console.debug("[kids-draw:stamp-pager]", {
          familyId: family.id,
          windowInnerWidth: window.innerWidth,
          constrainedShellWidth,
          measuredShellWidth,
          shellPaddingHorizontal,
          shellGap,
          navButtonWidth,
          cellWidth,
          columnGap,
          availableWidth,
          columnCount,
          pageSize,
          pageWidth,
          currentPage,
          totalPages,
          startIndex,
          endIndex: Math.min(endIndex, orderedToolIds.length),
          visibleToolIds: orderedToolIds.slice(startIndex, endIndex),
        });
      };

      const scrollByPage = (direction: -1 | 1): void => {
        const totalPages = Math.max(
          1,
          Math.ceil(orderedToolIds.length / pagerState.pageSize),
        );
        const currentPage = familyVariantActivePage.get(family.id) ?? 0;
        const nextPage = Math.max(
          0,
          Math.min(totalPages - 1, currentPage + direction),
        );
        familyVariantActivePage.set(family.id, nextPage);
        applyPagedVisibility();
      };

      const syncPager = (): void => {
        applyPagedVisibility();
      };
      familyVariantPagerSync.set(family.id, syncPager);

      prevButton.el.addEventListener("click", () => {
        scrollByPage(-1);
      });
      nextButton.el.addEventListener("click", () => {
        scrollByPage(1);
      });
      window.addEventListener("resize", syncPager);
      familyVariantActivePage.set(family.id, 0);
      panel.setAttribute("data-active-page", "0");
      queueMicrotask(syncPager);

      familyVariantContainers.set(family.id, shell);
      mount(bottomElement, shell);
      continue;
    }

    panel.classList.add("kids-toolbar-grid-panel");
    familyVariantContainers.set(family.id, panel);
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
        "aria-pressed": "false",
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
    "div.kids-draw-toolbar-colors",
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
    for (const [familyId, container] of familyVariantContainers) {
      const isActive = familyId === activeFamilyId;
      container.hidden = !isActive;
      if (isActive) {
        const orderedToolIds = familyVariantOrders.get(familyId) ?? [];
        const pagerState = familyVariantPagerStates.get(familyId);
        if (pagerState && orderedToolIds.length > pagerState.pageSize) {
          const selectedIndex = orderedToolIds.indexOf(activeToolId);
          if (selectedIndex >= 0) {
            const selectedPage = Math.floor(
              selectedIndex / pagerState.pageSize,
            );
            familyVariantActivePage.set(familyId, selectedPage);
            familyVariantToolbars
              .get(familyId)
              ?.setAttribute("data-active-page", `${selectedPage}`);
          }
        }
        familyVariantPagerSync.get(familyId)?.();
      }
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
    strokeWidthButtons,
    bindUiState,
  };
}
