import type { IconNode } from "lucide";

const SVG_NS = "http://www.w3.org/2000/svg";
const TAG_NAME = "kids-square-icon-button";

export class SquareIconButtonElement extends HTMLElement {
  static readonly tagName = TAG_NAME;
  static observedAttributes = ["disabled", "title", "aria-label", "aria-pressed"];

  #button: HTMLButtonElement;
  #icon: HTMLSpanElement;
  #label: HTMLSpanElement;

  constructor() {
    super();

    const root = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `
      :host {
        display: inline-block;
      }

      button {
        width: 100%;
        height: 100%;
        border: none;
        border-radius: var(--sq-radius, var(--kd-radius-md));
        background: var(--sq-bg, var(--kd-surface-button));
        color: var(--sq-color, var(--kd-text-default));
        font-weight: var(--sq-font-weight, var(--font-weight-5));
        box-shadow: var(--sq-shadow, var(--kd-shadow-button));
        padding: 0;
        transition:
          transform 120ms var(--ease-out-3),
          box-shadow 120ms var(--ease-out-3),
          background-color 120ms var(--ease-out-3),
          color 120ms var(--ease-out-3);
        cursor: pointer;
      }

      button:active {
        transform: scale(0.96);
      }

      :host(.is-selected) button {
        background: var(--sq-bg-selected, var(--kd-surface-button-selected));
        color: var(--sq-color-selected, var(--kd-text-strong));
        box-shadow: var(--sq-shadow-selected, var(--kd-shadow-button-active));
      }

      button:disabled {
        cursor: not-allowed;
        opacity: 0.6;
      }

      .content {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
        width: 100%;
        height: 100%;
      }

      :host([layout="row"]) .content {
        flex-direction: row;
      }

      .icon {
        width: 24px;
        height: 24px;
        min-width: 24px;
        min-height: 24px;
        flex: 0 0 24px;
      }

      .icon > svg {
        width: 100%;
        height: 100%;
        display: block;
      }

      .label {
        font-size: var(--sq-label-size, 11px);
        line-height: 1;
        white-space: nowrap;
      }
    `;

    this.#button = document.createElement("button");
    this.#button.type = "button";
    const content = document.createElement("span");
    content.className = "content";
    this.#icon = document.createElement("span");
    this.#icon.className = "icon";
    this.#label = document.createElement("span");
    this.#label.className = "label";
    content.append(this.#icon, this.#label);
    this.#button.append(content);
    root.append(style, this.#button);
  }

  connectedCallback(): void {
    this.#syncFromAttributes();
  }

  attributeChangedCallback(): void {
    this.#syncFromAttributes();
  }

  set disabled(value: boolean) {
    this.toggleAttribute("disabled", value);
    this.#button.disabled = value;
  }

  get disabled(): boolean {
    return this.hasAttribute("disabled");
  }

  setLabel(label: string): void {
    this.#label.textContent = label;
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

    this.#icon.replaceChildren(svg);
  }

  click(): void {
    this.#button.click();
  }

  #syncFromAttributes(): void {
    this.#button.disabled = this.disabled;

    const title = this.getAttribute("title");
    if (title !== null) {
      this.#button.setAttribute("title", title);
    } else {
      this.#button.removeAttribute("title");
    }

    const ariaLabel = this.getAttribute("aria-label");
    if (ariaLabel !== null) {
      this.#button.setAttribute("aria-label", ariaLabel);
    } else {
      this.#button.removeAttribute("aria-label");
    }

    const ariaPressed = this.getAttribute("aria-pressed");
    if (ariaPressed !== null) {
      this.#button.setAttribute("aria-pressed", ariaPressed);
    } else {
      this.#button.removeAttribute("aria-pressed");
    }
  }
}

export function ensureSquareIconButtonDefined(): void {
  const registry =
    (globalThis as { customElements?: CustomElementRegistry }).customElements ??
    (
      globalThis as {
        window?: { customElements?: CustomElementRegistry };
      }
    ).window?.customElements;
  if (!registry) {
    return;
  }
  if (!registry.get(TAG_NAME)) {
    registry.define(TAG_NAME, SquareIconButtonElement);
  }
}
