import "./ShareQrDialog.css";

import { el } from "redom";
import type { ReDomLike } from "./ReDomLike";

export interface ShareQrDialog extends ReDomLike<HTMLDivElement> {
  show(input: {
    joinUrl: string;
    qrDataUrl: string;
  }): Promise<void>;
  onunmount(): void;
}

export function createShareQrDialog(): ShareQrDialog {
  const title = el("h2.kids-share-dialog__title", "Share drawing");
  const image = el("img.kids-share-dialog__qr", {
    alt: "QR code for joining this drawing",
  }) as HTMLImageElement;
  const urlInput = el("input.kids-share-dialog__url-input", {
    type: "text",
    readOnly: true,
    "aria-label": "Share URL",
  }) as HTMLInputElement;
  const copyButton = el(
    "button.kids-share-dialog__button kids-share-dialog__button--secondary",
    { type: "button" },
    "Copy",
  ) as HTMLButtonElement;
  const urlRow = el(
    "div.kids-share-dialog__url-row",
    urlInput,
    copyButton,
  );
  const doneButton = el(
    "button.kids-share-dialog__button kids-share-dialog__button--primary kids-share-dialog__button--done",
    { type: "button" },
    "Done",
  ) as HTMLButtonElement;
  const dialog = el(
    "dialog.kids-share-dialog",
    el(
      "div.kids-share-dialog__card",
      title,
      image,
      urlRow,
      doneButton,
    ),
  ) as HTMLDialogElement;
  const elRoot = el("div.kids-share-dialog-host", dialog) as HTMLDivElement;
  let resolve: (() => void) | null = null;
  let currentJoinUrl = "";

  const selectUrl = (): void => {
    urlInput.focus();
    urlInput.select();
    urlInput.setSelectionRange(0, urlInput.value.length);
  };

  const setCopyLabel = (label: string): void => {
    copyButton.textContent = label;
  };

  const tryLegacyCopy = (): boolean => {
    if (typeof document.execCommand !== "function") {
      return false;
    }
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    }
  };

  const copyUrl = async (): Promise<void> => {
    selectUrl();
    if (currentJoinUrl.length === 0) {
      return;
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(currentJoinUrl);
      setCopyLabel("Copied");
      return;
    }
    setCopyLabel(tryLegacyCopy() ? "Copied" : "Copy manually");
  };

  const close = (): void => {
    if (dialog.open) {
      dialog.close();
    }
    const nextResolve = resolve;
    resolve = null;
    nextResolve?.();
  };

  copyButton.addEventListener("click", () => {
    void copyUrl();
  });
  doneButton.addEventListener("click", close);
  urlInput.addEventListener("focus", selectUrl);
  urlInput.addEventListener("click", selectUrl);
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
      currentJoinUrl = input.joinUrl;
      urlInput.value = input.joinUrl;
      setCopyLabel("Copy");
      if (typeof dialog.showModal !== "function") {
        dialog.setAttribute("open", "");
      }
      if (!dialog.open) {
        dialog.showModal();
      }
      selectUrl();
      await new Promise<void>((nextResolve) => {
        resolve = nextResolve;
      });
    },
    onunmount(): void {
      close();
    },
  };
}
