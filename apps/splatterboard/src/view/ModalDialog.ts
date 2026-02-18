import "./ModalDialog.css";

import type { IconNode } from "lucide";
import { el, setChildren } from "redom";

const SVG_NS = "http://www.w3.org/2000/svg";
const DIALOG_CLOSE_ANIMATION_MS = 220;

export interface ModalDialogOptions {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  icon?: IconNode;
}

export class ModalDialogView {
  readonly el: HTMLDivElement;

  #dialog: HTMLDialogElement;
  #title: HTMLHeadingElement;
  #message: HTMLParagraphElement;
  #icon: HTMLSpanElement;
  #cancelButton: HTMLButtonElement;
  #confirmButton: HTMLButtonElement;
  #resolve: ((value: boolean) => void) | null = null;
  #isClosing = false;
  #closeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.#icon = el("span.kids-modal-dialog__icon") as HTMLSpanElement;
    this.#title = el("h2.kids-modal-dialog__title") as HTMLHeadingElement;
    this.#message = el("p.kids-modal-dialog__message") as HTMLParagraphElement;
    this.#cancelButton = el(
      "button.kids-modal-dialog__button.kids-modal-dialog__button--cancel",
      { type: "button" },
      "Cancel",
    ) as HTMLButtonElement;
    this.#confirmButton = el(
      "button.kids-modal-dialog__button.kids-modal-dialog__button--confirm",
      { type: "button" },
      "Confirm",
    ) as HTMLButtonElement;

    this.#dialog = el(
      "dialog.kids-modal-dialog",
      el(
        "div.kids-modal-dialog__shell",
        el("div.kids-modal-dialog__header", this.#icon, this.#title),
        this.#message,
        el(
          "div.kids-modal-dialog__actions",
          this.#cancelButton,
          this.#confirmButton,
        ),
      ),
    ) as HTMLDialogElement;

    this.el = el("div.kids-modal-dialog-host", this.#dialog) as HTMLDivElement;

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

    this.el.dataset.tone = tone;
    this.#title.textContent = title;
    this.#message.textContent = message;
    this.#confirmButton.textContent = confirmLabel;
    this.#cancelButton.textContent = cancelLabel;
    if (icon) {
      setChildren(this.#icon, [this.#createIcon(icon)]);
    } else {
      setChildren(this.#icon, []);
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

  onunmount(): void {
    if (this.#closeTimer !== null) {
      clearTimeout(this.#closeTimer);
      this.#closeTimer = null;
    }
    if (this.#dialog.open) {
      this.#dialog.close();
    }
    const resolve = this.#resolve;
    this.#resolve = null;
    this.#isClosing = false;
    resolve?.(false);
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
        const onDone = () => {
          if (this.#closeTimer !== null) {
            clearTimeout(this.#closeTimer);
            this.#closeTimer = null;
          }
          this.#dialog.removeEventListener("animationend", onDone);
          resolve();
        };
        this.#closeTimer = setTimeout(onDone, DIALOG_CLOSE_ANIMATION_MS);
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

export function createModalDialogView(): ModalDialogView {
  return new ModalDialogView();
}
