import { el, mount } from "redom";
import type { UiIntentStore } from "../../controller/stores/createUiIntentStore";
import type { ReDomLike } from "../ReDomLike";

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

export function resolveSelectedColorSwatchIndex(
  strokeColor: string,
  swatchColors: readonly string[],
): number {
  const normalizedStrokeColor = strokeColor.toLowerCase();
  const selectedSwatchIndex = swatchColors.findIndex(
    (swatchColor) => swatchColor.toLowerCase() === normalizedStrokeColor,
  );
  return Math.max(0, selectedSwatchIndex);
}

export function resolveNearestStrokeWidthOption(
  strokeWidth: number,
  strokeWidthOptions: readonly number[],
): number {
  let nearestStrokeWidth: number = strokeWidthOptions[0] ?? 1;
  let nearestDelta = Math.abs(strokeWidth - nearestStrokeWidth);
  for (const option of strokeWidthOptions) {
    const delta = Math.abs(strokeWidth - option);
    if (delta < nearestDelta) {
      nearestStrokeWidth = option;
      nearestDelta = delta;
    }
  }
  return nearestStrokeWidth;
}

class ColorSwatchButtonView implements ReDomLike<HTMLButtonElement> {
  readonly el: HTMLButtonElement;
  readonly color: string;
  private clickHandler: ((event: MouseEvent) => void) | null = null;

  constructor(options: ColorSwatchConfig) {
    this.color = options.value;
    this.el = el("button", {
      type: "button",
      className: "kids-draw-color-swatch",
      title: options.label,
      "aria-label": options.label,
      role: "radio",
      "aria-checked": "false",
      tabindex: "-1",
      "data-setting": "stroke-color",
      "data-style-target": "stroke",
      "data-color": options.value,
      style: `--kd-swatch-color:${options.value}`,
    }) as HTMLButtonElement;
  }

  setSelected(selected: boolean): void {
    this.el.classList.toggle("is-selected", selected);
    this.el.setAttribute("role", "radio");
    this.el.setAttribute("aria-checked", selected ? "true" : "false");
    this.el.tabIndex = selected ? 0 : -1;
    this.el.removeAttribute("aria-pressed");
  }

  setDisabled(disabled: boolean): void {
    this.el.disabled = disabled;
  }

  setOnPress(handler: ((event: MouseEvent) => void) | null): void {
    if (this.clickHandler) {
      this.el.removeEventListener("click", this.clickHandler);
      this.clickHandler = null;
    }
    if (!handler) return;
    this.clickHandler = (event: MouseEvent) => handler(event);
    this.el.addEventListener("click", this.clickHandler);
  }
}

class StrokeWidthButtonView implements ReDomLike<HTMLButtonElement> {
  readonly el: HTMLButtonElement;
  readonly strokeWidth: number;
  private clickHandler: ((event: MouseEvent) => void) | null = null;

  constructor(options: { strokeWidth: number; previewSizePx: number }) {
    this.strokeWidth = options.strokeWidth;
    this.el = el(
      "button.kids-draw-stroke-width-button",
      {
        type: "button",
        title: `${options.strokeWidth}px brush`,
        "aria-label": `${options.strokeWidth}px brush`,
        role: "radio",
        "aria-checked": "false",
        tabindex: "-1",
        "data-setting": "stroke-width",
        "data-size": `${options.strokeWidth}`,
      },
      el("span.kids-draw-stroke-width-line", {
        style: `--kd-stroke-preview-size:${options.previewSizePx.toFixed(1)}px`,
      }),
    ) as HTMLButtonElement;
  }

  setSelected(selected: boolean): void {
    this.el.classList.toggle("is-selected", selected);
    this.el.setAttribute("role", "radio");
    this.el.setAttribute("aria-checked", selected ? "true" : "false");
    this.el.tabIndex = selected ? 0 : -1;
    this.el.removeAttribute("aria-pressed");
  }

  setDisabled(disabled: boolean): void {
    this.el.disabled = disabled;
  }

  setOnPress(handler: ((event: MouseEvent) => void) | null): void {
    if (this.clickHandler) {
      this.el.removeEventListener("click", this.clickHandler);
      this.clickHandler = null;
    }
    if (!handler) return;
    this.clickHandler = (event: MouseEvent) => handler(event);
    this.el.addEventListener("click", this.clickHandler);
  }
}

export class ToolbarStylePane
  implements
    ReDomLike<
      HTMLDivElement,
      {
        strokeColor: string;
        strokeWidth: number;
        supportsStrokeColor: boolean;
        supportsStrokeWidth: boolean;
      }
    >
{
  readonly el: HTMLDivElement;
  private readonly strokeColorSwatchButtons: ColorSwatchButtonView[];
  private readonly strokeWidthButtons: StrokeWidthButtonView[];
  private readonly strokeSwatchesElement: HTMLDivElement;
  private readonly colorsPanelElement: HTMLDivElement;
  private readonly strokesPanelElement: HTMLDivElement;

  constructor(options: {
    uiIntentStore: Pick<UiIntentStore, "publish">;
  }) {
    this.el = el("div.kids-draw-toolbar-style-pane") as HTMLDivElement;
    const swatches: ColorSwatchButtonView[] = [];
    this.strokeSwatchesElement = el("div.kids-draw-color-swatches", {
      role: "radiogroup",
      "aria-label": "Color palette",
      "data-style-target": "stroke",
    }) as HTMLDivElement;
    for (const swatch of COLOR_SWATCHES) {
      const swatchButton = new ColorSwatchButtonView(swatch);
      swatchButton.setOnPress(() =>
        options.uiIntentStore.publish({
          type: "set_stroke_color",
          strokeColor: swatchButton.color,
        }),
      );
      swatches.push(swatchButton);
      mount(this.strokeSwatchesElement, swatchButton);
    }
    this.strokeColorSwatchButtons = swatches;

    const stylePickersElement = el(
      "div.kids-draw-style-pickers",
    ) as HTMLDivElement;
    const strokeColorsPanelElement = el(
      "div.kids-draw-toolbar-panel.kids-draw-toolbar-color-surface.kids-toolbar-grid-panel",
    ) as HTMLDivElement;
    mount(strokeColorsPanelElement, this.strokeSwatchesElement);
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
    this.strokeWidthButtons = [];
    const strokeWidthElement = el("div.kids-draw-stroke-widths", {
      role: "radiogroup",
      "aria-label": "Brush size",
    }) as HTMLDivElement;
    for (const strokeWidth of STROKE_WIDTH_OPTIONS) {
      const widthButton = new StrokeWidthButtonView({
        strokeWidth,
        previewSizePx: toPreviewSize(strokeWidth),
      });
      widthButton.setOnPress(() =>
        options.uiIntentStore.publish({
          type: "set_stroke_width",
          strokeWidth: widthButton.strokeWidth,
        }),
      );
      this.strokeWidthButtons.push(widthButton);
      mount(strokeWidthElement, widthButton);
    }

    this.colorsPanelElement = el(
      "div.kids-draw-toolbar-colors",
    ) as HTMLDivElement;
    mount(this.colorsPanelElement, stylePickersElement);
    this.strokesPanelElement = el(
      "div.kids-draw-toolbar-panel.kids-draw-toolbar-strokes.kids-toolbar-grid-panel",
    ) as HTMLDivElement;
    mount(this.strokesPanelElement, strokeWidthElement);
    mount(this.el, this.colorsPanelElement);
    mount(this.el, this.strokesPanelElement);
  }

  update(options: {
    strokeColor: string;
    strokeWidth: number;
    supportsStrokeColor: boolean;
    supportsStrokeWidth: boolean;
  }): void {
    const swatchColors = this.strokeColorSwatchButtons.map(
      (swatchButton) => swatchButton.color,
    );
    const selectedSwatchIndex = resolveSelectedColorSwatchIndex(
      options.strokeColor,
      swatchColors,
    );
    for (const [
      index,
      swatchButton,
    ] of this.strokeColorSwatchButtons.entries()) {
      const selected = index === selectedSwatchIndex;
      swatchButton.setSelected(selected);
      swatchButton.setDisabled(!options.supportsStrokeColor);
    }
    this.strokeSwatchesElement.classList.toggle(
      "is-disabled",
      !options.supportsStrokeColor,
    );

    const nearestStrokeWidth = resolveNearestStrokeWidthOption(
      options.strokeWidth,
      STROKE_WIDTH_OPTIONS,
    );
    const selectedWidthIndex = Math.max(
      0,
      this.strokeWidthButtons.findIndex((widthButton) => {
        return widthButton.strokeWidth === nearestStrokeWidth;
      }),
    );
    for (const [index, widthButton] of this.strokeWidthButtons.entries()) {
      const selected = index === selectedWidthIndex;
      widthButton.setSelected(selected);
      widthButton.setDisabled(!options.supportsStrokeWidth);
    }
  }

  setMobileTopPanel(panel: "colors" | "strokes"): void {
    this.colorsPanelElement.hidden = panel !== "colors";
    this.strokesPanelElement.hidden = panel !== "strokes";
  }

  showDesktopPanels(): void {
    this.colorsPanelElement.hidden = false;
    this.strokesPanelElement.hidden = false;
  }

  destroy(): void {
    for (const swatchButton of this.strokeColorSwatchButtons) {
      swatchButton.setOnPress(null);
    }
    for (const widthButton of this.strokeWidthButtons) {
      widthButton.setOnPress(null);
    }
  }
}
