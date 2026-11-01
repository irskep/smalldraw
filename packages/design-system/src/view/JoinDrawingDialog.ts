import "./JoinDrawingDialog.css";
import { el } from "redom";

import { Button } from "./Button";
import { DialogScaffold } from "./DialogScaffold";

/** Previewing an invitation never implies consent to join it. */
export class JoinDrawingDialog {
  readonly scaffold = new DialogScaffold();
  readonly el = this.scaffold.el;
  #resolve: ((joined: boolean) => void) | null = null;
  #image = el("img.ds-join-drawing__preview", {
    alt: "Drawing preview",
  }) as HTMLImageElement;
  #message = el("p") as HTMLParagraphElement;
  #join = new Button({
    label: "Join drawing",
    tone: "primary",
    autofocus: true,
  });
  constructor() {
    const cancel = new Button({ label: "Not now" });
    this.scaffold.setDialogClassName("ds-join-drawing");
    this.scaffold.setTitle("You're invited to draw");
    this.scaffold.setBody(
      el("div.ds-join-drawing__body", this.#image, this.#message),
    );
    this.scaffold.setFooter(
      el("div.ds-join-drawing__actions", cancel, this.#join),
    );
    cancel.setOnPress(() => this.#finish(false));
    this.#join.setOnPress(() => this.#finish(true));
    this.scaffold.setOnDismiss(() => this.#finish(false));
  }
  show(input: {
    thumbnailUrl: string | null;
    message: string;
    canJoin: boolean;
  }): Promise<boolean> {
    this.#image.hidden = !input.thumbnailUrl;
    if (input.thumbnailUrl) this.#image.src = input.thumbnailUrl;
    else this.#image.removeAttribute("src");
    this.#message.textContent = input.message;
    this.#join.setDisabled(!input.canJoin);
    this.scaffold.show();
    return new Promise((resolve) => {
      this.#resolve = resolve;
    });
  }
  #finish(joined: boolean): void {
    void this.scaffold.close({ animated: true }).then(() => {
      this.#resolve?.(joined);
      this.#resolve = null;
    });
  }
  onmount(): void {
    this.scaffold.onmount();
  }
  onunmount(): void {
    this.scaffold.onunmount();
    this.#resolve?.(false);
    this.#resolve = null;
  }
}
