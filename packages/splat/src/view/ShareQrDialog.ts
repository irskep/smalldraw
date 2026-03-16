import "./ShareQrDialog.css";

import { el } from "redom";
import type { ReDomLike } from "./ReDomLike";

export interface ShareQrDialog extends ReDomLike<HTMLDivElement> {
  show(input: { joinUrl: string; qrDataUrl: string }): Promise<void>;
  onunmount(): void;
}

export function createShareQrDialog(): ShareQrDialog {
  const title = el("h2.kids-share-dialog__title", "Share drawing");
  const image = el("img.kids-share-dialog__qr", {
    alt: "QR code for joining this drawing",
  }) as HTMLImageElement;
  const urlText = el("p.kids-share-dialog__url") as HTMLParagraphElement;
  const doneButton = el(
    "button.kids-share-dialog__button",
    { type: "button" },
    "Done",
  ) as HTMLButtonElement;
  const dialog = el(
    "dialog.kids-share-dialog",
    el("div.kids-share-dialog__card", title, image, urlText, doneButton),
  ) as HTMLDialogElement;
  const elRoot = el("div.kids-share-dialog-host", dialog) as HTMLDivElement;
  let resolve: (() => void) | null = null;

  const close = (): void => {
    if (dialog.open) {
      dialog.close();
    }
    const nextResolve = resolve;
    resolve = null;
    nextResolve?.();
  };

  doneButton.addEventListener("click", close);
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      close();
    }
  });

  return {
    el: elRoot,
    async show(input): Promise<void> {
      const previousResolve = resolve;
      resolve = null;
      previousResolve?.();
      image.src = input.qrDataUrl;
      urlText.textContent = input.joinUrl;
      if (typeof dialog.showModal !== "function") {
        dialog.setAttribute("open", "");
      }
      if (!dialog.open) {
        dialog.showModal();
      }
      await new Promise<void>((nextResolve) => {
        resolve = nextResolve;
      });
    },
    onunmount(): void {
      close();
    },
  };
}
