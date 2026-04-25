import { el } from "redom";
import type { ReDomLike } from "../ReDomLike";

export type ButtonTone = "neutral" | "primary" | "danger";

export interface ButtonOptions {
  label: string;
  tone?: ButtonTone;
  className?: string;
  attributes?: Record<string, string>;
}

export class ButtonView implements ReDomLike<HTMLButtonElement> {
  readonly el: HTMLButtonElement;
  private clickHandler: ((event: MouseEvent) => void) | null = null;

  constructor(options: ButtonOptions) {
    this.el = el("button.ds-button", { type: "button" }, options.label) as HTMLButtonElement;
    if (options.className) {
      for (const className of options.className.split(/\s+/)) {
        if (className) {
          this.el.classList.add(className);
        }
      }
    }
    for (const [name, value] of Object.entries(options.attributes ?? {})) {
      this.el.setAttribute(name, value);
    }
    this.setLabel(options.label);
    this.setTone(options.tone ?? "neutral");
  }

  setLabel(label: string): void {
    this.el.textContent = label;
  }

  setTone(tone: ButtonTone): void {
    this.el.dataset.tone = tone;
  }

  setDisabled(disabled: boolean): void {
    this.el.disabled = disabled;
  }

  setOnPress(handler: ((event: MouseEvent) => void) | null): void {
    if (this.clickHandler) {
      this.el.removeEventListener("click", this.clickHandler);
      this.clickHandler = null;
    }
    if (!handler) {
      return;
    }
    this.clickHandler = (event: MouseEvent) => handler(event);
    this.el.addEventListener("click", this.clickHandler);
  }
}

export function createButton(options: ButtonOptions): ButtonView {
  return new ButtonView(options);
}
