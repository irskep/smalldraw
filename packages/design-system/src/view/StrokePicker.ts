import "./StrokePicker.css";

import { type IconNode, SlidersHorizontal } from "lucide";
import { el } from "redom";
import { DropdownChrome } from "./DropdownChrome";
import type { ReDomLike } from "./ReDomLike";
import { createIconButton, type IconButton } from "./SquareIconButton";
import { StrokeWidthGrid } from "./StrokeWidthGrid";

export interface StrokePickerOptions {
  className?: string;
  strokeWidths?: readonly number[];
  selectedStrokeWidth?: number;
  triggerLabel?: string;
  triggerIcon?: IconNode;
  triggerAttributes?: Record<string, string>;
  panelLabel?: string;
}

function createStrokeTriggerIcon(strokeWidth: number): IconNode {
  const previewWidth = Math.max(1.5, Math.min(6.5, Math.sqrt(strokeWidth)));
  return [
    [
      "line",
      {
        x1: "5",
        y1: "12",
        x2: "19",
        y2: "12",
        stroke: "currentColor",
        "stroke-width": `${previewWidth}`,
        "stroke-linecap": "round",
      },
    ],
  ];
}

export class StrokePicker implements ReDomLike<HTMLDivElement> {
  readonly el: HTMLDivElement;
  readonly triggerButton: IconButton;

  private readonly chrome: DropdownChrome;
  private readonly strokeWidthGrid: StrokeWidthGrid;
  private selectedStrokeWidth = 0;
  private selectHandler: ((strokeWidth: number) => void) | null = null;

  constructor(options: StrokePickerOptions = {}) {
    this.triggerButton = createIconButton({
      className: "ds-stroke-picker__trigger",
      label: options.triggerLabel ?? "Strokes",
      icon: options.triggerIcon ?? SlidersHorizontal,
      dropdown: true,
      attributes: {
        "aria-haspopup": "dialog",
        "aria-expanded": "false",
        ...options.triggerAttributes,
      },
    });
    this.strokeWidthGrid = new StrokeWidthGrid({
      selectedStrokeWidth:
        options.selectedStrokeWidth ?? options.strokeWidths?.[0] ?? 0,
    });
    this.chrome = new DropdownChrome({
      trigger: this.triggerButton,
      className: ["ds-stroke-picker", options.className ?? ""].join(" ").trim(),
      panelClassName: "ds-stroke-picker__panel",
      panelRole: "dialog",
      panelLabel: options.panelLabel ?? "Stroke picker",
      align: "start",
      closeOnPointerLeave: true,
    });
    this.el = this.chrome.el;

    this.triggerButton.setOnPress(() => {
      this.setOpen(!this.chrome.open);
    });
    this.strokeWidthGrid.setOnSelect((strokeWidth) => {
      this.setSelectedStrokeWidth(strokeWidth);
      this.selectHandler?.(strokeWidth);
      this.setOpen(false);
    });

    this.chrome.setContent(this.strokeWidthGrid.el);
    this.setSelectedStrokeWidth(
      options.selectedStrokeWidth ?? options.strokeWidths?.[0] ?? 0,
    );
    this.setStrokeWidths(options.strokeWidths ?? []);
  }

  setStrokeWidths(strokeWidths: readonly number[]): void {
    this.strokeWidthGrid.setStrokeWidths(strokeWidths);
  }

  setSelectedStrokeWidth(strokeWidth: number): void {
    this.selectedStrokeWidth = strokeWidth;
    this.triggerButton.setIcon(
      strokeWidth > 0 ? createStrokeTriggerIcon(strokeWidth) : SlidersHorizontal,
    );
    this.strokeWidthGrid.setSelectedStrokeWidth(strokeWidth);
  }

  setOpen(open: boolean): void {
    this.chrome.setOpen(open);
  }

  setDisabled(disabled: boolean): void {
    this.triggerButton.setDisabled(disabled);
    if (disabled) {
      this.setOpen(false);
    }
  }

  setOnSelect(handler: ((strokeWidth: number) => void) | null): void {
    this.selectHandler = handler;
  }
}

export function createStrokePicker(
  options: StrokePickerOptions = {},
): StrokePicker {
  return new StrokePicker(options);
}
