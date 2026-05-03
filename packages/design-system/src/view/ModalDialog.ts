import "./DialogChrome.css";
import "./ModalDialog.css";

import type { IconNode } from "lucide";
import { el, setChildren } from "redom";
import { Button } from "./Button";
import type { ReDomLike } from "./ReDomLike";
import { renderIcon } from "./renderIcon";
import { Text } from "./Text";

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
  #title: Text<"h2">;
  #message: Text<"p">;
  #icon: HTMLSpanElement;
  #cancelButton: Button;
  #confirmButton: Button;
  #resolve: ((value: boolean) => void) | null = null;
  #isClosing = false;
  #closeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.#icon = el("span.ds-modal-dialog__icon") as HTMLSpanElement;
    this.#title = new Text({
      tag: "h2",
      kind: "title",
      className: "ds-modal-dialog__title",
    });
    this.#message = new Text({
      tag: "p",
      kind: "body",
      className: "ds-modal-dialog__message",
    });
    this.#cancelButton = new Button({ label: "Cancel", tone: "neutral" });
    this.#confirmButton = new Button({
      label: "Confirm",
      tone: "primary",
      autofocus: true,
    });

    this.#dialog = el(
      "dialog.ds-dialog ds-modal-dialog",
      el(
        "div.ds-dialog-surface ds-modal-dialog__shell",
        el("div.ds-modal-dialog__header", this.#icon, this.#title),
        this.#message,
        el(
          "div.ds-modal-dialog__actions",
          this.#cancelButton,
          this.#confirmButton,
        ),
      ),
    ) as HTMLDialogElement;

    this.el = el("div.ds-dialog-host ds-modal-dialog-host", this.#dialog) as HTMLDivElement;

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

    this.#title.setText(title);
    this.#message.setText(message);
    this.#confirmButton.setLabel(confirmLabel);
    this.#confirmButton.setTone(tone === "danger" ? "danger" : "primary");
    this.#cancelButton.setLabel(cancelLabel);
    if (icon) {
      this.#icon.hidden = false;
      setChildren(this.#icon, [this.#createIcon(icon)]);
    } else {
      setChildren(this.#icon, []);
      this.#icon.hidden = true;
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
    return renderIcon(iconNode);
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
