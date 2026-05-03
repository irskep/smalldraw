import "./DialogChrome.css";
import "./ShareQrDialog.css";

import { el } from "redom";
import { Button } from "./Button";
import type { ReDomLike } from "./ReDomLike";

export interface ShareQrDialog extends ReDomLike<HTMLDivElement> {
  show(input: { joinUrl: string; qrDataUrl: string }): Promise<void>;
  onunmount(): void;
}

export function createShareQrDialog(): ShareQrDialog {
  const title = el("h2.ds-share-dialog__title", "Share drawing");
  const image = el("img.ds-share-dialog__qr", {
    alt: "QR code for joining this drawing",
  }) as HTMLImageElement;
  const imageSlot = el("div.ds-share-dialog__media", image);
  const urlInput = el("input.ds-share-dialog__url-input", {
    type: "text",
    readOnly: true,
    "aria-label": "Share URL",
  }) as HTMLInputElement;
  const copyButton = new Button({
    label: "Copy",
    tone: "neutral",
    autofocus: true,
    className: "ds-share-dialog__copy-button",
  });
  const urlRow = el("div.ds-share-dialog__url-row", urlInput, copyButton);
  const doneButton = new Button({
    label: "Done",
    tone: "primary",
    className: "ds-share-dialog__done-button",
  });
  const actions = el("div.ds-share-dialog__actions", doneButton);
  const body = el(
    "div.ds-share-dialog__body",
    title,
    urlRow,
    actions,
  );
  const dialog = el(
    "dialog.ds-dialog ds-share-dialog",
    el(
      "div.ds-dialog-surface ds-share-dialog__card",
      imageSlot,
      body,
    ),
  ) as HTMLDialogElement;
  const elRoot = el(
    "div.ds-dialog-host ds-share-dialog-host",
    dialog,
  ) as HTMLDivElement;
  let resolve: (() => void) | null = null;
  let currentJoinUrl = "";

  const selectUrl = (focus = true): void => {
    if (focus) {
      urlInput.focus();
    }
    urlInput.select();
    urlInput.setSelectionRange(0, urlInput.value.length);
  };

  const setCopyLabel = (label: string): void => {
    copyButton.setLabel(label);
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
    if (currentJoinUrl.length === 0) {
      return;
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(currentJoinUrl);
      setCopyLabel("Copied");
      return;
    }
    selectUrl();
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

  copyButton.setOnPress(() => {
    void copyUrl();
  });
  doneButton.setOnPress(close);
  urlInput.addEventListener("focus", () => {
    selectUrl(false);
  });
  urlInput.addEventListener("click", () => {
    selectUrl(false);
  });
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
      await new Promise<void>((nextResolve) => {
        resolve = nextResolve;
      });
    },
    onunmount(): void {
      close();
    },
  };
}
