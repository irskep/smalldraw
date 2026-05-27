import "./ModalDialog.css";

import type { IconNode } from "lucide";
import { setChildren } from "redom";
import { Button } from "./Button";
import { DialogScaffold } from "./DialogScaffold";
import type { ReDomLike } from "./ReDomLike";
import { renderIcon } from "./renderIcon";
import { Text } from "./Text";

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

  #scaffold: DialogScaffold;
  #shell: HTMLDivElement;
  #header: HTMLDivElement;
  #title: Text<"h2">;
  #message: Text<"p">;
  #icon: HTMLSpanElement;
  #cancelButton: Button;
  #confirmButton: Button;
  #actions: HTMLDivElement;
  #resolve: ((value: boolean) => void) | null = null;

  constructor() {
    this.#scaffold = new DialogScaffold();
    this.#scaffold.setDialogClassName("ds-modal-dialog");
    this.#scaffold.setSurfaceClassName("ds-modal-dialog__shell");
    this.#scaffold.setOnDismiss(() => {
      void this.#finish(false);
    });

    this.#icon = document.createElement("span");
    this.#icon.className = "ds-modal-dialog__icon";
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
    this.#header = document.createElement("div");
    this.#header.className = "ds-modal-dialog__header";
    this.#header.append(this.#icon, this.#title.el);
    this.#actions = document.createElement("div");
    this.#actions.className = "ds-modal-dialog__actions";
    this.#actions.append(this.#cancelButton.el, this.#confirmButton.el);
    this.#shell = document.createElement("div");
    this.#shell.className = "ds-modal-dialog__content";
    this.#shell.append(this.#header, this.#message.el, this.#actions);

    this.#cancelButton.setOnPress(() => {
      void this.#finish(false);
    });
    this.#confirmButton.setOnPress(() => {
      void this.#finish(true);
    });

    this.#scaffold.setBody(this.#shell);
    this.#icon.hidden = true;

    this.el = this.#scaffold.el;
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
      setChildren(this.#icon, [renderIcon(icon)]);
      this.#icon.hidden = false;
    } else {
      setChildren(this.#icon, []);
      this.#icon.hidden = true;
    }
    this.#header.classList.toggle(
      "ds-modal-dialog__header--iconless",
      this.#icon.hidden,
    );
    this.#scaffold.show();

    return await new Promise<boolean>((resolve) => {
      this.#resolve = resolve;
    });
  }

  onunmount(): void {
    this.#scaffold.onunmount?.();
    const resolve = this.#resolve;
    this.#resolve = null;
    resolve?.(false);
  }

  async #finish(value: boolean): Promise<void> {
    if (this.#resolve === null) {
      return;
    }
    await this.#scaffold.close({ animated: true });
    const resolve = this.#resolve;
    this.#resolve = null;
    resolve?.(value);
  }
}

export function createModalDialogView(): ModalDialogView {
  return new ModalDialogView();
}
