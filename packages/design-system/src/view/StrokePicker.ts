import "./StrokePicker.css";

import { type IconNode, SlidersHorizontal } from "lucide";
import { el, setChildren } from "redom";
import type { ReDomLike } from "./ReDomLike";
import { createIconButton, type IconButton } from "./SquareIconButton";

export interface StrokePickerOptions {
  className?: string;
  strokeWidths?: readonly number[];
  selectedStrokeWidth?: number;
  triggerLabel?: string;
  triggerIcon?: IconNode;
  triggerAttributes?: Record<string, string>;
  panelLabel?: string;
}

export class StrokePicker implements ReDomLike<HTMLDivElement> {
  readonly el: HTMLDivElement;
  readonly triggerButton: IconButton;

  private readonly popover: HTMLDivElement;
  private readonly panel: HTMLDivElement;
  private selectedStrokeWidth = 0;
  private selectHandler: ((strokeWidth: number) => void) | null = null;
  private isOpen = false;
  private readonly documentPointerDownHandler: (event: PointerEvent) => void;
  private readonly documentKeyDownHandler: (event: KeyboardEvent) => void;

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
    this.popover = el(
      "div.ds-stroke-picker__popover",
      { "aria-hidden": "true" },
      this.panel,
    ) as HTMLDivElement;
    this.popover.dataset.open = "false";
    this.popover.hidden = true;

    this.documentPointerDownHandler = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || !this.isOpen) {
        return;
      }
      if (this.el.contains(target)) {
        return;
      }
      this.setOpen(false);
    };
    this.documentKeyDownHandler = (event: KeyboardEvent) => {
      if (!this.isOpen || event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      this.setOpen(false);
      this.triggerButton.el.focus();
    };

    this.triggerButton.setOnPress(() => {
      this.setOpen(!this.isOpen);
    });

    this.el.append(this.triggerButton.el, this.popover);
    this.setSelectedStrokeWidth(
      options.selectedStrokeWidth ?? options.strokeWidths?.[0] ?? 0,
    );
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
            this.setOpen(false);
          },
        },
        el("span.ds-stroke-picker__line", {
          style: `--ds-stroke-picker-preview-size:${previewSize}px;`,
        }),
      ) as HTMLButtonElement;
    });

    setChildren(this.panel, [el("div.ds-stroke-picker__grid", buttons)]);
  }

  setSelectedStrokeWidth(strokeWidth: number): void {
    this.selectedStrokeWidth = strokeWidth;
    for (const button of Array.from(
      this.panel.querySelectorAll(".ds-stroke-picker__button"),
    )) {
      if (!(button instanceof HTMLButtonElement)) {
        continue;
      }
      button.dataset.selected =
        button.getAttribute("aria-label") === `${strokeWidth}px brush`
          ? "true"
          : "false";
    }
  }

  setOpen(open: boolean): void {
    if (this.isOpen === open) {
      return;
    }
    this.isOpen = open;
    this.popover.hidden = false;
    this.popover.dataset.open = open ? "true" : "false";
    this.popover.setAttribute("aria-hidden", open ? "false" : "true");
    this.triggerButton.setPressed(open);
    this.triggerButton.setAriaExpanded(open);
    if (open) {
      document.addEventListener(
        "pointerdown",
        this.documentPointerDownHandler,
        true,
      );
      document.addEventListener("keydown", this.documentKeyDownHandler, true);
      return;
    }
    document.removeEventListener(
      "pointerdown",
      this.documentPointerDownHandler,
      true,
    );
    document.removeEventListener("keydown", this.documentKeyDownHandler, true);
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
