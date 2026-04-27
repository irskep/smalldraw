import "./ColorPicker.css";

import { type IconNode, Palette } from "lucide";
import { el, setChildren } from "redom";
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

export class ColorPicker implements ReDomLike<HTMLDivElement> {
  readonly el: HTMLDivElement;
  readonly triggerButton: IconButton;

  private readonly popover: HTMLDivElement;
  private readonly panel: HTMLDivElement;
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

    this.el.append(this.triggerButton.el, this.popover);
    this.setSelectedColor(options.selectedColor ?? options.colors?.[0]?.color ?? "");
    this.setColors(options.colors ?? []);
  }

  setColors(colors: readonly ColorPickerSwatch[]): void {
    const buttons = colors.map((swatch) => {
      const color = swatch.color;
      return el("button.ds-color-picker__swatch", {
        type: "button",
        title: swatch.label ?? color,
        "aria-label": swatch.label ?? color,
        "data-selected": color === this.selectedColor ? "true" : "false",
        style: `--ds-color-picker-swatch-color:${color};`,
        onclick: () => {
          this.setSelectedColor(color);
          this.selectHandler?.(color);
          this.setOpen(false);
        },
      }) as HTMLButtonElement;
    });

    setChildren(this.panel, [el("div.ds-color-picker__grid", buttons)]);
  }

  setSelectedColor(color: string): void {
    this.selectedColor = color;
    for (const swatch of Array.from(this.panel.querySelectorAll(".ds-color-picker__swatch"))) {
      const selected = swatch instanceof HTMLElement &&
        swatch.style.getPropertyValue("--ds-color-picker-swatch-color") === color;
      if (swatch instanceof HTMLElement) {
        swatch.dataset.selected = selected ? "true" : "false";
      }
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

  setOnSelect(handler: ((color: string) => void) | null): void {
    this.selectHandler = handler;
  }
}

export function createColorPicker(options: ColorPickerOptions = {}): ColorPicker {
  return new ColorPicker(options);
}
