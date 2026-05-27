import "./IconButton.css";

import { ChevronDown, type IconNode } from "lucide";
import { el, setChildren } from "redom";
import type { ReDomLike } from "./ReDomLike";
import { renderIcon } from "./renderIcon";
import { Text } from "./Text";

export type IconButtonSource = IconNode | { kind: "image"; src: string };
export type IconButtonLayout = "small" | "large";

export interface IconButtonOptions {
  className?: string;
  label?: string;
  icon?: IconButtonSource;
  dropdown?: boolean;
  layout?: IconButtonLayout;
  attributes?: Record<string, string>;
}

export class IconButton implements ReDomLike<HTMLButtonElement> {
  readonly el: HTMLButtonElement;

  private readonly contentElement: HTMLSpanElement;
  private readonly iconElement: HTMLSpanElement;
  private readonly labelText: Text<"span">;
  private readonly dropdownElement: HTMLSpanElement;
  private clickHandler: ((event: MouseEvent) => void) | null = null;

  constructor(options: IconButtonOptions = {}) {
    this.iconElement = el("span.ds-icon-button__icon") as HTMLSpanElement;
    this.labelText = new Text({
      tag: "span",
      kind: "caption",
      className: "ds-icon-button__label kids-square-icon-button__label",
    });
    this.dropdownElement = el(
      "span.ds-icon-button__dropdown",
      renderIcon(ChevronDown),
    ) as HTMLSpanElement;
    this.contentElement = el(
      "span.ds-icon-button__content",
      this.iconElement,
      this.labelText,
    ) as HTMLSpanElement;

    this.el = el(
      "button.ds-icon-button",
      {
        type: "button",
      },
      this.contentElement,
      this.dropdownElement,
    ) as HTMLButtonElement;

    for (const className of (options.className ?? "").split(/\s+/)) {
      if (className) {
        this.el.classList.add(className);
      }
    }
    const requestedLayout = options.layout ?? options.attributes?.layout;
    for (const [name, value] of Object.entries(options.attributes ?? {})) {
      if (name === "layout") {
        continue;
      }
      this.el.setAttribute(name, value);
    }
    this.setLabel(options.label ?? "");
    this.setLayout(requestedLayout === "large" ? "large" : "small");
    this.setDropdown(options.dropdown ?? false);
    if (options.icon) {
      this.setIcon(options.icon);
    }
  }

  setLabel(label: string): void {
    const hasLabel = label.trim().length > 0;
    this.labelText.setText(label);
    this.labelText.el.hidden = !hasLabel;
    if (hasLabel) {
      this.el.setAttribute("aria-label", label);
      return;
    }
    this.el.removeAttribute("aria-label");
  }

  setIcon(icon: IconButtonSource): void {
    if ("kind" in icon) {
      const image = el(
        "img.ds-icon-button__icon-image kids-square-icon-button__icon-image",
        {
          src: icon.src,
          alt: "",
          loading: "lazy",
          decoding: "async",
          draggable: "false",
        },
      ) as HTMLImageElement;
      setChildren(this.iconElement, [image]);
      return;
    }

    setChildren(this.iconElement, [renderIcon(icon)]);
  }

  setPressed(pressed: boolean): void {
    this.el.classList.toggle("is-selected", pressed);
    this.el.setAttribute("aria-pressed", pressed ? "true" : "false");
    this.el.removeAttribute("role");
    this.el.removeAttribute("aria-checked");
    this.el.removeAttribute("tabindex");
  }

  setChecked(checked: boolean): void {
    this.el.classList.toggle("is-selected", checked);
    this.el.setAttribute("role", "radio");
    this.el.setAttribute("aria-checked", checked ? "true" : "false");
    this.el.tabIndex = checked ? 0 : -1;
    this.el.removeAttribute("aria-pressed");
  }

  setDisabled(disabled: boolean): void {
    this.el.disabled = disabled;
  }

  setLayout(layout: IconButtonLayout): void {
    if (layout === "small") {
      this.el.removeAttribute("data-layout");
      return;
    }
    this.el.setAttribute("data-layout", layout);
  }

  setDropdown(dropdown: boolean): void {
    this.el.toggleAttribute("data-dropdown", dropdown);
    this.dropdownElement.hidden = !dropdown;
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

  setAriaExpanded(expanded: boolean): void {
    this.el.setAttribute("aria-expanded", expanded ? "true" : "false");
  }

  getBoundingClientRect(): DOMRect {
    return this.el.getBoundingClientRect();
  }
}

export function createIconButton(options: IconButtonOptions): IconButton {
  return new IconButton(options);
}
