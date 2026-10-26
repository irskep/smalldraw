import "./SizeStepper.css";
import { Minus, Plus } from "lucide";
import { atom } from "nanostores";
import { el, mount } from "redom";

import { createIconButton } from "./SquareIconButton";

export class SizeStepper {
  readonly el = el("div.ds-size-stepper", {
    role: "group",
    "aria-label": "Size",
  });
  private readonly smaller = createIconButton({
    label: "Smaller",
    icon: Minus,
  });
  private readonly bigger = createIconButton({ label: "Bigger", icon: Plus });
  private readonly indicator = el(
    "span.ds-size-stepper__indicator",
    { "aria-hidden": "true" },
    el("span"),
  );
  private readonly state = atom({
    widths: [] as readonly number[],
    value: 2,
    disabled: false,
  });
  private handler: ((value: number) => void) | null = null;

  constructor(options: {
    strokeWidths: readonly number[];
    selectedStrokeWidth: number;
  }) {
    this.state.set({
      widths: options.strokeWidths,
      value: options.selectedStrokeWidth,
      disabled: false,
    });
    mount(this.el, this.smaller);
    mount(this.el, this.indicator);
    mount(this.el, this.bigger);
    this.smaller.setOnPress(() => this.step(-1));
    this.bigger.setOnPress(() => this.step(1));
    this.render();
  }
  setStrokeWidths(widths: readonly number[]): void {
    this.state.set({ ...this.state.get(), widths });
    this.render();
  }
  setSelectedStrokeWidth(value: number): void {
    this.state.set({ ...this.state.get(), value });
    this.render();
  }
  setDisabled(disabled: boolean): void {
    this.state.set({ ...this.state.get(), disabled });
    this.render();
  }
  setOnSelect(handler: ((value: number) => void) | null): void {
    this.handler = handler;
  }
  private next(direction: number): number | undefined {
    const { widths, value } = this.state.get();
    return direction < 0
      ? widths.filter((width) => width < value).at(-1)
      : widths.find((width) => width > value);
  }
  private step(direction: number): void {
    const value = this.next(direction);
    if (this.state.get().disabled || value === undefined) return;
    this.setSelectedStrokeWidth(value);
    this.handler?.(value);
  }
  private render(): void {
    const { value, disabled, widths } = this.state.get();
    this.smaller.setDisabled(disabled || this.next(-1) === undefined);
    this.bigger.setDisabled(disabled || this.next(1) === undefined);
    const max = widths.at(-1) ?? 200;
    this.indicator.style.setProperty(
      "--size-preview",
      `${4 + 16 * Math.sqrt(Math.min(1, Math.max(0, value) / Math.max(1, max)))}px`,
    );
    this.el.setAttribute("aria-label", `Size ${value}`);
  }
}
