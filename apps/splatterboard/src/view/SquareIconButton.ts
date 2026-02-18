import type { IconNode } from "lucide";
import { el, setChildren } from "redom";

const SVG_NS = "http://www.w3.org/2000/svg";

export type SquareIconSource = IconNode | { kind: "image"; src: string };

export class SquareIconButton {
  readonly el: HTMLButtonElement;
  readonly iconElement: HTMLSpanElement;
  readonly labelElement: HTMLSpanElement;

  constructor() {
    this.iconElement = el(
      "span.kids-square-icon-button__icon",
    ) as HTMLSpanElement;
    this.labelElement = el(
      "span.kids-square-icon-button__label",
    ) as HTMLSpanElement;
    const content = el(
      "span.kids-square-icon-button__content",
      this.iconElement,
      this.labelElement,
    );
    this.el = el(
      "button.kids-square-icon-button",
      {
        type: "button",
      },
      content,
    ) as HTMLButtonElement;
  }

  setLabel(label: string): void {
    const hasLabel = label.trim().length > 0;
    this.labelElement.textContent = label;
    this.labelElement.hidden = !hasLabel;
  }

  setIcon(iconNode: IconNode): void {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");

    for (const [tag, attrs] of iconNode) {
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

  setIconImage(src: string): void {
    const image = el("img.kids-square-icon-button__icon-image", {
      src,
      alt: "",
      loading: "lazy",
      decoding: "async",
      draggable: "false",
    }) as HTMLImageElement;
    setChildren(this.iconElement, [image]);
  }

  setSelected(selected: boolean): void {
    this.el.classList.toggle("is-selected", selected);
    this.el.setAttribute("aria-pressed", selected ? "true" : "false");
  }

  setRadioSelected(selected: boolean): void {
    this.el.classList.toggle("is-selected", selected);
    this.el.setAttribute("role", "radio");
    this.el.setAttribute("aria-checked", selected ? "true" : "false");
    this.el.tabIndex = selected ? 0 : -1;
    this.el.removeAttribute("aria-pressed");
  }

  setDisabled(disabled: boolean): void {
    this.el.disabled = disabled;
  }

  setLayout(layout: "row" | "column"): void {
    if (layout === "column") {
      this.el.removeAttribute("layout");
      return;
    }
    this.el.setAttribute("layout", layout);
  }
}

export function createSquareIconButton(options: {
  className: string;
  label: string;
  icon: SquareIconSource;
  attributes: Record<string, string>;
}): SquareIconButton {
  const button = new SquareIconButton();
  for (const className of options.className.split(/\s+/)) {
    if (className) {
      button.el.classList.add(className);
    }
  }
  for (const [name, value] of Object.entries(options.attributes)) {
    if (name === "layout") {
      button.setLayout(value === "row" ? "row" : "column");
      continue;
    }
    button.el.setAttribute(name, value);
  }
  button.setLabel(options.label);
  if ("kind" in options.icon) {
    button.setIconImage(options.icon.src);
  } else {
    button.setIcon(options.icon);
  }
  return button;
}
