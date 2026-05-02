import "./StrokePicker.css";

import { el, setChildren } from "redom";
import type { ReDomLike } from "./ReDomLike";

export interface StrokeWidthGridOptions {
  strokeWidths?: readonly number[];
  selectedStrokeWidth?: number;
}

export class StrokeWidthGrid implements ReDomLike<HTMLDivElement> {
  readonly el: HTMLDivElement;

  private selectedStrokeWidth = 0;
  private selectHandler: ((strokeWidth: number) => void) | null = null;

  constructor(options: StrokeWidthGridOptions = {}) {
    this.el = el("div.ds-stroke-picker__grid") as HTMLDivElement;
    this.selectedStrokeWidth = options.selectedStrokeWidth ?? 0;
    this.setStrokeWidths(options.strokeWidths ?? []);
  }

  setStrokeWidths(strokeWidths: readonly number[]): void {
    const buttons = strokeWidths.map((strokeWidth) => {
      const previewSize = Math.max(2, Math.min(18, Math.sqrt(strokeWidth) * 1.5));
      return el(
        "button.ds-stroke-picker__button",
        {
          type: "button",
          title: `${strokeWidth}px brush`,
          "aria-label": `${strokeWidth}px brush`,
          "data-selected":
            strokeWidth === this.selectedStrokeWidth ? "true" : "false",
          onclick: () => {
            this.setSelectedStrokeWidth(strokeWidth);
            this.selectHandler?.(strokeWidth);
          },
        },
        el("span.ds-stroke-picker__line", {
          style: `--ds-stroke-picker-preview-size:${previewSize}px;`,
        }),
      ) as HTMLButtonElement;
    });

    setChildren(this.el, buttons);
  }

  setSelectedStrokeWidth(strokeWidth: number): void {
    this.selectedStrokeWidth = strokeWidth;
    for (const button of Array.from(
      this.el.querySelectorAll(".ds-stroke-picker__button"),
    )) {
      if (!(button instanceof HTMLElement)) {
        continue;
      }
      button.dataset.selected =
        button.getAttribute("aria-label") === `${strokeWidth}px brush`
          ? "true"
          : "false";
    }
  }

  setOnSelect(handler: ((strokeWidth: number) => void) | null): void {
    this.selectHandler = handler;
  }
}

export function createStrokeWidthGrid(
  options: StrokeWidthGridOptions = {},
): StrokeWidthGrid {
  return new StrokeWidthGrid(options);
}
