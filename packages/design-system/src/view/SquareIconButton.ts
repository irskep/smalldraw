import "./IconButton.css";

import type { IconNode } from "lucide";
import { el, setChildren } from "redom";
import type { ReDomLike } from "./ReDomLike";

const SVG_NS = "http://www.w3.org/2000/svg";

export type IconButtonSource = IconNode | { kind: "image"; src: string };
export type IconButtonLayout = "row" | "column";

export interface IconButtonOptions {
  className?: string;
  label?: string;
  icon?: IconButtonSource;
  attributes?: Record<string, string>;
}

export class IconButton implements ReDomLike<HTMLButtonElement> {
  readonly el: HTMLButtonElement;

  private readonly contentElement: HTMLSpanElement;
  private readonly iconElement: HTMLSpanElement;
  private readonly labelElement: HTMLSpanElement;
  private clickHandler: ((event: MouseEvent) => void) | null = null;

  constructor(options: IconButtonOptions = {}) {
    this.iconElement = el("span.ds-icon-button__icon") as HTMLSpanElement;
    this.labelElement = el("span.ds-icon-button__label") as HTMLSpanElement;
    this.contentElement = el(
      "span.ds-icon-button__content",
      this.iconElement,
      this.labelElement,
    ) as HTMLSpanElement;

    this.el = el(
      "button.ds-icon-button",
      {
        type: "button",
      },
      this.contentElement,
    ) as HTMLButtonElement;

    for (const className of (options.className ?? "").split(/\s+/)) {
      if (className) {
        this.el.classList.add(className);
      }
    }
    for (const [name, value] of Object.entries(options.attributes ?? {})) {
      if (name === "layout") {
        this.setLayout(value === "row" ? "row" : "column");
        continue;
      }
      this.el.setAttribute(name, value);
    }
    this.setLabel(options.label ?? "");
    this.setLayout("column");
    if (options.icon) {
      this.setIcon(options.icon);
    }
  }

  setLabel(label: string): void {
    const hasLabel = label.trim().length > 0;
    this.labelElement.textContent = label;
    this.labelElement.hidden = !hasLabel;
  }

  setIcon(icon: IconButtonSource): void {
    if ("kind" in icon) {
      const image = el("img.ds-icon-button__icon-image", {
        src: icon.src,
        alt: "",
        loading: "lazy",
        decoding: "async",
        draggable: "false",
      }) as HTMLImageElement;
      setChildren(this.iconElement, [image]);
      return;
    }

    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    for (const [tag, attrs] of icon) {
      const node = document.createElementNS(SVG_NS, tag);
      for (const [attr, value] of Object.entries(attrs)) {
        if (value !== undefined) {
          node.setAttribute(attr, `${value}`);
        }
      }
      svg.appendChild(node);
    }

    setChildren(this.iconElement, [svg]);
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
    if (layout === "column") {
      this.el.removeAttribute("data-layout");
      return;
    }
    this.el.setAttribute("data-layout", layout);
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
