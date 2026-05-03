import "./Button.css";

import { ChevronDown, type IconNode } from "lucide";
import { el, setChildren } from "redom";
import type { ReDomLike } from "./ReDomLike";
import { renderIcon } from "./renderIcon";
import { Text } from "./Text";

export type ButtonTone = "neutral" | "primary" | "danger";

export interface ButtonOptions {
  label: string;
  tone?: ButtonTone;
  icon?: IconNode;
  dropdown?: boolean;
  possibleLabels?: string[];
  autofocus?: boolean;
  className?: string;
  attributes?: Record<string, string>;
}

export class Button implements ReDomLike<HTMLButtonElement> {
  readonly el: HTMLButtonElement;

  private readonly iconElement: HTMLSpanElement;
  private readonly labelContainerElement: HTMLSpanElement;
  private readonly labelText: Text<"span">;
  private readonly reservedLabelsElement: HTMLSpanElement;
  private readonly dropdownElement: HTMLSpanElement;
  private clickHandler: ((event: MouseEvent) => void) | null = null;

  constructor(options: ButtonOptions) {
    this.iconElement = el("span.ds-button__icon") as HTMLSpanElement;
    this.labelText = new Text({
      tag: "span",
      kind: "label",
      className: "ds-button__label",
    });
    this.reservedLabelsElement = el(
      "span.ds-button__reserved-labels",
      { "aria-hidden": "true" },
    ) as HTMLSpanElement;
    this.labelContainerElement = el(
      "span.ds-button__label-container",
      this.labelText,
      this.reservedLabelsElement,
    ) as HTMLSpanElement;
    this.dropdownElement = el(
      "span.ds-button__dropdown",
      renderIcon(ChevronDown),
    ) as HTMLSpanElement;

    this.el = el(
      "button.ds-button",
      { type: "button" },
      this.iconElement,
      this.labelContainerElement,
      this.dropdownElement,
    ) as HTMLButtonElement;

    this.setLabel(options.label);
    this.setTone(options.tone ?? "neutral");
    this.setPossibleLabels(options.possibleLabels ?? []);

    if (options.icon) {
      this.setIcon(options.icon);
    } else {
      this.iconElement.hidden = true;
    }

    this.setDropdown(options.dropdown ?? false);
    this.setAutofocus(options.autofocus ?? false);
    if (options.className) {
      this.el.classList.add(...options.className.split(/\s+/).filter(Boolean));
    }

    for (const [name, value] of Object.entries(options.attributes ?? {})) {
      this.el.setAttribute(name, value);
    }
  }

  setLabel(label: string): void {
    this.labelText.setText(label);
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

  setPossibleLabels(labels: string[]): void {
    if (labels.length === 0) {
      setChildren(this.reservedLabelsElement, []);
      this.reservedLabelsElement.hidden = true;
      return;
    }

    const reservedLabels = labels.map((label) =>
      new Text({
        tag: "span",
        text: label,
        kind: "label",
        className: "ds-button__reserved-label",
      }),
    );
    setChildren(this.reservedLabelsElement, reservedLabels);
    this.reservedLabelsElement.hidden = false;
  }

  setAutofocus(autofocus: boolean): void {
    this.el.toggleAttribute("autofocus", autofocus);
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
