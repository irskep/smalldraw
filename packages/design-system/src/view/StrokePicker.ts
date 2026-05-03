import "./StrokePicker.css";

import { type IconNode, SlidersHorizontal } from "lucide";
import { el } from "redom";
import { AnchoredPopoverController } from "./AnchoredPopoverController";
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

  private readonly popover: HTMLDivElement;
  private readonly panel: HTMLDivElement;
  private readonly strokeWidthGrid: StrokeWidthGrid;
  private readonly popoverController: AnchoredPopoverController;
  private selectedStrokeWidth = 0;
  private selectHandler: ((strokeWidth: number) => void) | null = null;
  private isOpen = false;

  constructor(options: StrokePickerOptions = {}) {
    this.el = el("div.ds-stroke-picker") as HTMLDivElement;
    for (const className of (options.className ?? "").split(/\s+/)) {
      if (className) {
        this.el.classList.add(className);
      }
    }

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

    this.panel = el("div.ds-stroke-picker__panel", {
      role: "dialog",
      "aria-label": options.panelLabel ?? "Stroke picker",
    }) as HTMLDivElement;
    this.strokeWidthGrid = new StrokeWidthGrid({
      selectedStrokeWidth:
        options.selectedStrokeWidth ?? options.strokeWidths?.[0] ?? 0,
    });
    this.popover = el(
      "div.ds-stroke-picker__popover",
      { "aria-hidden": "true" },
      this.panel,
    ) as HTMLDivElement;
    this.popover.dataset.open = "false";
    this.popover.hidden = true;
    this.popoverController = new AnchoredPopoverController({
      trigger: this.triggerButton,
      root: this.el,
      popover: this.popover,
      panel: this.panel,
      closeOnPointerLeave: true,
      onOpenChange: (open) => {
        this.isOpen = open;
      },
    });

    this.triggerButton.setOnPress(() => {
      this.setOpen(!this.isOpen);
    });
    this.strokeWidthGrid.setOnSelect((strokeWidth) => {
      this.setSelectedStrokeWidth(strokeWidth);
      this.selectHandler?.(strokeWidth);
      this.setOpen(false);
    });

    this.panel.append(this.strokeWidthGrid.el);
    this.el.append(this.triggerButton.el, this.popover);
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
    this.popoverController.setOpen(open);
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
