import { el } from "redom";
import { ColorSwatch } from "./ColorSwatch.js";

/**
 * Row of color swatches with a label.
 */
export class ColorRow {
  el: HTMLDivElement;
  private swatches: ColorSwatch[] = [];

  constructor(
    label: string,
    palette: string[],
    onSelect: (color: string) => void,
    dataRole?: string,
  ) {
    const labelEl = el("span", label);

    this.el = el(
      "div",
      {
        style: {
          display: "flex",
          "align-items": "center",
          gap: "4px",
        },
      },
      labelEl,
    ) as HTMLDivElement;

    if (dataRole) {
      this.el.dataset.role = dataRole;
    }

    // Create and append swatches
    for (const color of palette) {
      const swatch = new ColorSwatch(color, onSelect);
      this.swatches.push(swatch);
      this.el.appendChild(swatch.el);
    }
  }

  update(activeColor: string): void {
    for (const swatch of this.swatches) {
      swatch.update(activeColor);
    }
  }

  unmount(): void {
    for (const swatch of this.swatches) {
      swatch.unmount();
    }
  }
}
