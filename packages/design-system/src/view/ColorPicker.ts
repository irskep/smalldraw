import "./ColorPicker.css";

import { type IconNode, Palette } from "lucide";
import { ColorSwatchGrid } from "./ColorSwatchGrid";
import { DropdownChrome } from "./DropdownChrome";
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

  private readonly chrome: DropdownChrome;
  private readonly swatchGrid: ColorSwatchGrid;
  private selectHandler: ((color: string) => void) | null = null;

  constructor(options: ColorPickerOptions = {}) {
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
    this.swatchGrid = new ColorSwatchGrid({
      selectedColor: options.selectedColor ?? options.colors?.[0]?.color ?? "",
    });
    this.chrome = new DropdownChrome({
      trigger: this.triggerButton,
      className: ["ds-color-picker", options.className ?? ""].join(" ").trim(),
      panelClassName: "ds-color-picker__panel",
      panelRole: "dialog",
      panelLabel: options.panelLabel ?? "Color picker",
      align: "start",
      closeOnPointerLeave: true,
    });
    this.el = this.chrome.el;

    this.triggerButton.setOnPress(() => {
      this.setOpen(!this.chrome.open);
    });
    this.swatchGrid.setOnSelect((color) => {
      this.setSelectedColor(color);
      this.selectHandler?.(color);
      this.setOpen(false);
    });

    this.chrome.setContent(this.swatchGrid.el);
    this.setSelectedColor(
      options.selectedColor ?? options.colors?.[0]?.color ?? "",
    );
    this.setColors(options.colors ?? []);
  }

  setColors(colors: readonly ColorPickerSwatch[]): void {
    this.swatchGrid.setColors(colors);
  }

  setSelectedColor(color: string): void {
    this.triggerButton.setIcon(color ? createColorTriggerIcon(color) : Palette);
    this.swatchGrid.setSelectedColor(color);
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

  setOnSelect(handler: ((color: string) => void) | null): void {
    this.selectHandler = handler;
  }
}

export function createColorPicker(
  options: ColorPickerOptions = {},
): ColorPicker {
  return new ColorPicker(options);
}
