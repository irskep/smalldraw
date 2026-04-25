import "./ModalDialog.css";

import type { IconNode } from "lucide";
import { el, setChildren } from "redom";
import { Button } from "./Button";
import type { ReDomLike } from "./ReDomLike";

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

export class ModalDialogView implements ReDomLike<HTMLDivElement> {
  readonly el: HTMLDivElement;

  #dialog: HTMLDialogElement;
  #title: HTMLHeadingElement;
  #message: HTMLParagraphElement;
  #icon: HTMLSpanElement;
  #cancelButton: Button;
  #confirmButton: Button;
  #resolve: ((value: boolean) => void) | null = null;
  #isClosing = false;
  #closeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.#icon = el("span.ds-modal-dialog__icon") as HTMLSpanElement;
    this.#title = el("h2.ds-modal-dialog__title") as HTMLHeadingElement;
    this.#message = el("p.ds-modal-dialog__message") as HTMLParagraphElement;
    this.#cancelButton = new Button({ label: "Cancel", tone: "neutral" });
    this.#confirmButton = new Button({ label: "Confirm", tone: "primary" });

    this.#dialog = el(
      "dialog.ds-modal-dialog",
      el(
        "div.ds-modal-dialog__shell",
        el("div.ds-modal-dialog__header", this.#icon, this.#title),
        this.#message,
        el(
          "div.ds-modal-dialog__actions",
          this.#cancelButton,
          this.#confirmButton,
        ),
      ),
    ) as HTMLDialogElement;

    this.el = el("div.ds-modal-dialog-host", this.#dialog) as HTMLDivElement;

    this.#cancelButton.setOnPress(() => {
      void this.#finish(false);
    });
    this.#confirmButton.setOnPress(() => {
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

    this.#title.textContent = title;
    this.#message.textContent = message;
    this.#confirmButton.setLabel(confirmLabel);
    this.#confirmButton.setTone(tone === "danger" ? "danger" : "primary");
    this.#cancelButton.setLabel(cancelLabel);
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
