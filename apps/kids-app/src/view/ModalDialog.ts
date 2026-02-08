import type { IconNode } from "lucide";

const TAG_NAME = "kids-modal-dialog";
const SVG_NS = "http://www.w3.org/2000/svg";

export interface ModalDialogOptions {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  icon?: IconNode;
}

export class ModalDialogElement extends HTMLElement {
  static readonly tagName = TAG_NAME;

  #dialog: HTMLDialogElement;
  #title: HTMLHeadingElement;
  #message: HTMLParagraphElement;
  #icon: HTMLSpanElement;
  #cancelButton: HTMLButtonElement;
  #confirmButton: HTMLButtonElement;
  #resolve: ((value: boolean) => void) | null = null;
  #isClosing = false;

  constructor() {
    super();

    const root = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `
      :host {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 1000;
      }

      dialog {
        border: none;
        border-radius: var(--kd-radius-md, 12px);
        padding: 0;
        width: min(460px, calc(100vw - 32px));
        background: var(--kd-surface-canvas, white);
        color: var(--kd-text-default, black);
        box-shadow: var(--shadow-6);
        pointer-events: auto;
        opacity: 0;
        transform: translateY(12px) scale(0.98);
      }

      dialog[open] {
        animation: kids-dialog-in 180ms var(--ease-out-3) forwards;
      }

      dialog.is-closing {
        animation: kids-dialog-out 140ms var(--ease-in-3) forwards;
      }

      dialog::backdrop {
        background: rgb(15 23 42 / 45%);
        animation: kids-dialog-backdrop-in 180ms var(--ease-out-2) forwards;
      }

      dialog.is-closing::backdrop {
        animation: kids-dialog-backdrop-out 140ms var(--ease-in-2) forwards;
      }

      .shell {
        padding: 20px;
        display: grid;
        gap: 16px;
      }

      .header {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .icon {
        width: 24px;
        height: 24px;
        min-width: 24px;
        min-height: 24px;
      }

      .icon > svg {
        width: 100%;
        height: 100%;
        display: block;
      }

      h2 {
        margin: 0;
        font-size: 18px;
        line-height: 1.2;
      }

      p {
        margin: 0;
        font-size: 14px;
        line-height: 1.35;
      }

      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }

      button {
        border: none;
        border-radius: var(--kd-radius-md, 12px);
        padding: 10px 14px;
        cursor: pointer;
      }

      .cancel {
        background: var(--gray-2);
        color: var(--gray-9);
      }

      .confirm {
        background: var(--blue-6);
        color: white;
      }

      :host([tone="danger"]) .confirm {
        background: var(--red-7);
      }

      @keyframes kids-dialog-in {
        from {
          opacity: 0;
          transform: translateY(12px) scale(0.98);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      @keyframes kids-dialog-out {
        from {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
        to {
          opacity: 0;
          transform: translateY(8px) scale(0.985);
        }
      }

      @keyframes kids-dialog-backdrop-in {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      @keyframes kids-dialog-backdrop-out {
        from {
          opacity: 1;
        }
        to {
          opacity: 0;
        }
      }
    `;

    this.#dialog = document.createElement("dialog");
    const shell = document.createElement("div");
    shell.className = "shell";
    const header = document.createElement("div");
    header.className = "header";
    this.#icon = document.createElement("span");
    this.#icon.className = "icon";
    this.#title = document.createElement("h2");
    this.#message = document.createElement("p");
    const actions = document.createElement("div");
    actions.className = "actions";
    this.#cancelButton = document.createElement("button");
    this.#cancelButton.type = "button";
    this.#cancelButton.className = "cancel";
    this.#cancelButton.textContent = "Cancel";
    this.#confirmButton = document.createElement("button");
    this.#confirmButton.type = "button";
    this.#confirmButton.className = "confirm";
    this.#confirmButton.textContent = "Confirm";
    header.append(this.#icon, this.#title);
    actions.append(this.#cancelButton, this.#confirmButton);
    shell.append(header, this.#message, actions);
    this.#dialog.append(shell);
    root.append(style, this.#dialog);

    this.#cancelButton.addEventListener("click", () => {
      void this.#finish(false);
    });
    this.#confirmButton.addEventListener("click", () => {
      void this.#finish(true);
    });
    this.#dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      void this.#finish(false);
    });
    this.#dialog.addEventListener("click", (event) => {
      if (event.target === this.#dialog) {
        void this.#finish(false);
      }
    });
  }

  async showConfirm(options: ModalDialogOptions): Promise<boolean> {
    const {
      title,
      message,
      confirmLabel,
      cancelLabel = "Cancel",
      tone = "default",
      icon,
    } = options;

    this.setAttribute("tone", tone);
    this.#title.textContent = title;
    this.#message.textContent = message;
    this.#confirmButton.textContent = confirmLabel;
    this.#cancelButton.textContent = cancelLabel;
    this.#icon.replaceChildren();
    if (icon) {
      this.#icon.append(this.#createIcon(icon));
    }

    if (typeof this.#dialog.showModal !== "function") {
      this.#dialog.setAttribute("open", "");
    }

    if (!this.#dialog.open) {
      this.#dialog.showModal();
    }
    this.#dialog.classList.remove("is-closing");
    this.#isClosing = false;

    return await new Promise<boolean>((resolve) => {
      this.#resolve = resolve;
    });
  }

  #createIcon(iconNode: IconNode): SVGSVGElement {
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

    return svg;
  }

  async #finish(value: boolean): Promise<void> {
    if (this.#isClosing) {
      return;
    }
    this.#isClosing = true;

    if (this.#dialog.open) {
      this.#dialog.classList.add("is-closing");
      await new Promise<void>((resolve) => {
        let timeout: ReturnType<typeof setTimeout> | null = null;
        const onDone = () => {
          if (timeout !== null) {
            clearTimeout(timeout);
            timeout = null;
          }
          this.#dialog.removeEventListener("animationend", onDone);
          resolve();
        };
        timeout = setTimeout(onDone, 220);
        this.#dialog.addEventListener("animationend", onDone);
      });
      this.#dialog.classList.remove("is-closing");
      this.#dialog.close();
    }
    const resolve = this.#resolve;
    this.#resolve = null;
    this.#isClosing = false;
    resolve?.(value);
  }
}

export function ensureModalDialogDefined(): void {
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
    registry.define(TAG_NAME, ModalDialogElement);
  }
}
