import "./Button.css";

import { ChevronDown, type IconNode } from "lucide";
import { el, setChildren } from "redom";
import type { ReDomLike } from "./ReDomLike";
import { renderIcon } from "./renderIcon";

export type ButtonTone = "neutral" | "primary" | "danger";

export interface ButtonOptions {
  label: string;
  tone?: ButtonTone;
  icon?: IconNode;
  dropdown?: boolean;
  attributes?: Record<string, string>;
}

export class Button implements ReDomLike<HTMLButtonElement> {
  readonly el: HTMLButtonElement;

  private readonly iconElement: HTMLSpanElement;
  private readonly labelElement: HTMLSpanElement;
  private readonly dropdownElement: HTMLSpanElement;
  private clickHandler: ((event: MouseEvent) => void) | null = null;

  constructor(options: ButtonOptions) {
    this.iconElement = el("span.ds-button__icon") as HTMLSpanElement;
    this.labelElement = el("span.ds-button__label") as HTMLSpanElement;
    this.dropdownElement = el(
      "span.ds-button__dropdown",
      renderIcon(ChevronDown),
    ) as HTMLSpanElement;

    this.el = el(
      "button.ds-button",
      { type: "button" },
      this.iconElement,
      this.labelElement,
      this.dropdownElement,
    ) as HTMLButtonElement;

    this.setLabel(options.label);
    this.setTone(options.tone ?? "neutral");

    if (options.icon) {
      this.setIcon(options.icon);
    } else {
      this.iconElement.hidden = true;
    }

    this.setDropdown(options.dropdown ?? false);

    for (const [name, value] of Object.entries(options.attributes ?? {})) {
      this.el.setAttribute(name, value);
    }
  }

  setLabel(label: string): void {
    this.labelElement.textContent = label;
  }

  setTone(tone: ButtonTone): void {
    this.el.dataset.tone = tone;
  }

  setIcon(icon: IconNode | null): void {
    if (!icon) {
      setChildren(this.iconElement, []);
      this.iconElement.hidden = true;
      return;
    }

    setChildren(this.iconElement, [renderIcon(icon)]);
    this.iconElement.hidden = false;
  }

  setDropdown(dropdown: boolean): void {
    this.el.toggleAttribute("data-dropdown", dropdown);
    this.dropdownElement.hidden = !dropdown;
  }

  setPressed(pressed: boolean): void {
    this.el.classList.toggle("is-selected", pressed);
    this.el.setAttribute("aria-pressed", pressed ? "true" : "false");
  }

  setAriaExpanded(expanded: boolean): void {
    this.el.setAttribute("aria-expanded", expanded ? "true" : "false");
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

export function createButton(options: ButtonOptions): Button {
  return new Button(options);
}
