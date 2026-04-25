import "./Button.css";

import type { IconNode } from "lucide";
import { el, setChildren } from "redom";
import type { ReDomLike } from "./ReDomLike";

const SVG_NS = "http://www.w3.org/2000/svg";

export type ButtonTone = "neutral" | "primary" | "danger";

export interface ButtonOptions {
  label: string;
  tone?: ButtonTone;
  icon?: IconNode;
  attributes?: Record<string, string>;
}

export class Button implements ReDomLike<HTMLButtonElement> {
  readonly el: HTMLButtonElement;

  private readonly iconElement: HTMLSpanElement;
  private clickHandler: ((event: MouseEvent) => void) | null = null;

  constructor(options: ButtonOptions) {
    this.iconElement = el("span.ds-button__icon") as HTMLSpanElement;

    this.el = el(
      "button.ds-button",
      { type: "button" },
      this.iconElement,
    ) as HTMLButtonElement;

    this.setLabel(options.label);
    this.setTone(options.tone ?? "neutral");

    if (options.icon) {
      this.setIcon(options.icon);
    } else {
      this.iconElement.hidden = true;
    }

    for (const [name, value] of Object.entries(options.attributes ?? {})) {
      this.el.setAttribute(name, value);
    }
  }

  setLabel(label: string): void {
    // Text node is a direct child after the icon element
    const textNode = this.el.lastChild;
    if (textNode?.nodeType === Node.TEXT_NODE) {
      textNode.textContent = label;
    } else {
      this.el.appendChild(document.createTextNode(label));
    }
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
    this.iconElement.hidden = false;
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
