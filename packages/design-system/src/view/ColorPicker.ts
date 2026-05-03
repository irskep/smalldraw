import "./ColorPicker.css";

import { type IconNode, Palette } from "lucide";
import { el } from "redom";
import { ColorSwatchGrid } from "./ColorSwatchGrid";
import type { ReDomLike } from "./ReDomLike";
import { createIconButton, type IconButton } from "./SquareIconButton";

export interface ColorPickerSwatch {
  color: string;
  label?: string;
}

export interface ColorPickerOptions {
  className?: string;
  colors?: readonly ColorPickerSwatch[];
  selectedColor?: string;
  triggerLabel?: string;
  triggerIcon?: IconNode;
  triggerAttributes?: Record<string, string>;
  panelLabel?: string;
}

function createColorTriggerIcon(color: string): IconNode {
  return [
    [
      "rect",
      {
        x: "4",
        y: "4",
        width: "16",
        height: "16",
        rx: "2",
        ry: "2",
        fill: color || "#000000",
        stroke: "currentColor",
        "stroke-width": "1.25",
      },
    ],
  ];
}

export class ColorPicker implements ReDomLike<HTMLDivElement> {
  readonly el: HTMLDivElement;
  readonly triggerButton: IconButton;

  private readonly popover: HTMLDivElement;
  private readonly panel: HTMLDivElement;
  private readonly swatchGrid: ColorSwatchGrid;
  private selectedColor = "";
  private selectHandler: ((color: string) => void) | null = null;
  private isOpen = false;
  private readonly documentPointerDownHandler: (event: PointerEvent) => void;
  private readonly documentKeyDownHandler: (event: KeyboardEvent) => void;

  constructor(options: ColorPickerOptions = {}) {
    this.el = el("div.ds-color-picker") as HTMLDivElement;
    for (const className of (options.className ?? "").split(/\s+/)) {
      if (className) {
        this.el.classList.add(className);
      }
    }

    this.triggerButton = createIconButton({
      className: "ds-color-picker__trigger",
      label: options.triggerLabel ?? "Colors",
      icon: options.triggerIcon ?? Palette,
      dropdown: true,
      attributes: {
        "aria-haspopup": "dialog",
        "aria-expanded": "false",
        ...options.triggerAttributes,
      },
    });

    this.panel = el("div.ds-color-picker__panel", {
      role: "dialog",
      "aria-label": options.panelLabel ?? "Color picker",
    }) as HTMLDivElement;
    this.swatchGrid = new ColorSwatchGrid({
      selectedColor: options.selectedColor ?? options.colors?.[0]?.color ?? "",
    });
    this.popover = el(
      "div.ds-color-picker__popover",
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
    this.swatchGrid.setOnSelect((color) => {
      this.setSelectedColor(color);
      this.selectHandler?.(color);
      this.setOpen(false);
    });

    this.panel.append(this.swatchGrid.el);
    this.el.append(this.triggerButton.el, this.popover);
    this.setSelectedColor(options.selectedColor ?? options.colors?.[0]?.color ?? "");
    this.setColors(options.colors ?? []);
  }

  setColors(colors: readonly ColorPickerSwatch[]): void {
    this.swatchGrid.setColors(colors);
  }

  setSelectedColor(color: string): void {
    this.selectedColor = color;
    this.triggerButton.setIcon(
      color ? createColorTriggerIcon(color) : Palette,
    );
    this.swatchGrid.setSelectedColor(color);
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

  setOnSelect(handler: ((color: string) => void) | null): void {
    this.selectHandler = handler;
  }
}

export function createColorPicker(options: ColorPickerOptions = {}): ColorPicker {
  return new ColorPicker(options);
}
