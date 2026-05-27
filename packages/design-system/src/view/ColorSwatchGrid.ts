import "./ColorPicker.css";

import { el, setChildren } from "redom";
import type { ColorPickerSwatch } from "./ColorPicker";
import type { ReDomLike } from "./ReDomLike";

export interface ColorSwatchGridOptions {
  colors?: readonly ColorPickerSwatch[];
  selectedColor?: string;
}

export class ColorSwatchGrid implements ReDomLike<HTMLDivElement> {
  readonly el: HTMLDivElement;

  private selectedColor = "";
  private selectHandler: ((color: string) => void) | null = null;

  constructor(options: ColorSwatchGridOptions = {}) {
    this.el = el("div.ds-color-picker__grid", {
      role: "radiogroup",
      "aria-label": "Stroke colors",
    }) as HTMLDivElement;
    this.selectedColor = options.selectedColor ?? "";
    this.setColors(options.colors ?? []);
  }

  setColors(colors: readonly ColorPickerSwatch[]): void {
    const buttons = colors.map((swatch) => {
      const color = swatch.color;
      return el(
        "button.ds-color-picker__swatch.ds-control-tile",
        {
          type: "button",
          title: swatch.label ?? color,
          "aria-label": swatch.label ?? color,
          role: "radio",
          "aria-checked": color === this.selectedColor ? "true" : "false",
          "data-selected": color === this.selectedColor ? "true" : "false",
          "data-setting": "stroke-color",
          "data-color": color.toLowerCase(),
          style: `--ds-color-picker-swatch-color:${color};`,
          onclick: () => {
            this.setSelectedColor(color);
            this.selectHandler?.(color);
          },
        },
        el("span.ds-color-picker__swatch-fill"),
      ) as HTMLButtonElement;
    });

    setChildren(this.el, buttons);
  }

  setSelectedColor(color: string): void {
    this.selectedColor = color;
    for (const swatch of Array.from(
      this.el.querySelectorAll(".ds-color-picker__swatch"),
    )) {
      const selected =
        swatch instanceof HTMLElement &&
        swatch.style.getPropertyValue("--ds-color-picker-swatch-color") ===
          color;
      if (swatch instanceof HTMLElement) {
        swatch.dataset.selected = selected ? "true" : "false";
        swatch.setAttribute("aria-checked", selected ? "true" : "false");
      }
    }
  }

  setOnSelect(handler: ((color: string) => void) | null): void {
    this.selectHandler = handler;
  }
}

export function createColorSwatchGrid(
  options: ColorSwatchGridOptions = {},
): ColorSwatchGrid {
  return new ColorSwatchGrid(options);
}
