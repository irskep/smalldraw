import "./ShareQrDialog.css";

import { Button } from "./Button";
import { DialogScaffold } from "./DialogScaffold";
import type { ReDomLike } from "./ReDomLike";
import { Text } from "./Text";

export interface ShareQrDialog extends ReDomLike<HTMLDivElement> {
  show(input: { joinUrl: string; qrDataUrl: string }): Promise<void>;
  onunmount(): void;
}

export function createShareQrDialog(): ShareQrDialog {
  const title = new Text({
    tag: "h2",
    text: "Share drawing",
    kind: "title",
    className: "ds-share-dialog__title",
  });
  const image = document.createElement("img");
  image.className = "ds-share-dialog__qr";
  image.alt = "QR code for joining this drawing";
  const imageSlot = document.createElement("div");
  imageSlot.className = "ds-share-dialog__media";
  imageSlot.append(image);
  const urlInput = document.createElement("input");
  urlInput.className = "ds-share-dialog__url-input";
  urlInput.type = "text";
  urlInput.readOnly = true;
  urlInput.setAttribute("aria-label", "Share URL");
  const copyButton = new Button({
    label: "Copy",
    tone: "neutral",
    possibleLabels: ["Copy", "Copied"],
    autofocus: true,
    className: "ds-share-dialog__copy-button",
  });
  const urlRow = document.createElement("div");
  urlRow.className = "ds-share-dialog__url-row";
  urlRow.append(urlInput, copyButton.el);
  const doneButton = new Button({
    label: "Done",
    tone: "primary",
    className: "ds-share-dialog__done-button",
  });
  const actions = document.createElement("div");
  actions.className = "ds-share-dialog__actions";
  actions.append(doneButton.el);
  const body = document.createElement("div");
  body.className = "ds-share-dialog__body";
  body.append(title.el, urlRow, actions);
  const content = document.createElement("div");
  content.className = "ds-share-dialog__content";
  content.append(imageSlot, body);

  const scaffold = new DialogScaffold();
  scaffold.setDialogClassName("ds-share-dialog");
  scaffold.setSurfaceClassName("ds-share-dialog__card");
  scaffold.setBody(content);

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
    void scaffold.close({ animated: true }).then(() => {
      const nextResolve = resolve;
      resolve = null;
      nextResolve?.();
    });
  };

  scaffold.setOnDismiss(close);
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

  return {
    el: scaffold.el,
    async show(input): Promise<void> {
      const previousResolve = resolve;
      resolve = null;
      previousResolve?.();
      image.src = input.qrDataUrl;
      currentJoinUrl = input.joinUrl;
      urlInput.value = input.joinUrl;
      setCopyLabel("Copy");
      scaffold.show();
      await new Promise<void>((nextResolve) => {
        resolve = nextResolve;
      });
    },
    onunmount(): void {
      scaffold.onunmount();
      const nextResolve = resolve;
      resolve = null;
      nextResolve?.();
    },
  };
}
