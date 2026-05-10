import { describe, expect, test } from "bun:test";
import { AlertTriangle } from "lucide";
import { createModalDialogView, createShareQrDialog } from "../src";

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("ModalDialogView", () => {
  test("resolves confirm and cancel flows", async () => {
    const dialog = createModalDialogView();
    document.body.appendChild(dialog.el);

    const confirmPromise = dialog.showConfirm({
      title: "Delete?",
      message: "This cannot be undone.",
      confirmLabel: "Delete",
      cancelLabel: "Keep",
      tone: "danger",
      icon: AlertTriangle,
    });

    const confirmButton = dialog.el.querySelector(
      ".ds-modal-dialog__shell .ds-button[data-tone='danger']",
    ) as HTMLButtonElement | null;
    expect(confirmButton).not.toBeNull();
    confirmButton!.click();
    expect(await confirmPromise).toBeTrue();

    const cancelPromise = dialog.showConfirm({
      title: "Delete?",
      message: "This cannot be undone.",
      confirmLabel: "Delete",
    });

    const cancelButton = Array.from(
      dialog.el.querySelectorAll<HTMLButtonElement>(
        ".ds-modal-dialog__shell .ds-button",
      ),
    ).find((button) => button.textContent?.trim() === "Cancel");
    expect(cancelButton).not.toBeUndefined();
    cancelButton!.click();
    expect(await cancelPromise).toBeFalse();
  });

  test("resolves pending prompt on onunmount", async () => {
    const dialog = createModalDialogView();
    document.body.appendChild(dialog.el);

    const pending = dialog.showConfirm({
      title: "Prompt",
      message: "Pending",
      confirmLabel: "OK",
    });

    dialog.onunmount();
    expect(await pending).toBeFalse();
  });
});

describe("ShareQrDialog", () => {
  test("resolves previous show call when reopened", async () => {
    const dialog = createShareQrDialog();
    document.body.appendChild(dialog.el);

    const first = dialog.show({
      joinUrl: "https://splatterboard.app/?join=first",
      qrDataUrl: "data:image/png;base64,first",
    });
    const second = dialog.show({
      joinUrl: "https://splatterboard.app/?join=second",
      qrDataUrl: "data:image/png;base64,second",
    });

    await first;
    const doneButton = Array.from(
      dialog.el.querySelectorAll<HTMLButtonElement>(".ds-share-dialog .ds-button"),
    ).find((button) => button.textContent?.trim() === "Done");
    expect(doneButton).not.toBeUndefined();
    doneButton!.click();
    await second;
  });

  test("copies the join URL", async () => {
    const dialog = createShareQrDialog();
    document.body.appendChild(dialog.el);

    let copied = "";
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string): Promise<void> => {
          copied = value;
        },
      },
    });

    const pending = dialog.show({
      joinUrl: "https://splatterboard.app/?join=copy-me",
      qrDataUrl: "data:image/png;base64,copy",
    });

    const copyButton = dialog.el.querySelector(
      ".ds-share-dialog__copy-button",
    ) as HTMLButtonElement | null;
    const urlInput = dialog.el.querySelector(
      ".ds-share-dialog__url-input",
    ) as HTMLInputElement | null;

    expect(copyButton).not.toBeNull();
    expect(urlInput).not.toBeNull();
    expect(urlInput!.value).toBe("https://splatterboard.app/?join=copy-me");

    const ensuredCopyButton = copyButton!;
    ensuredCopyButton.click();
    await Promise.resolve();

    expect(copied).toBe("https://splatterboard.app/?join=copy-me");
    expect(
      ensuredCopyButton.querySelector(".ds-button__label")?.textContent?.trim(),
    ).toBe("Copied");

    dialog.onunmount();
    await pending;
  });

  test("falls back to execCommand copy", async () => {
    const dialog = createShareQrDialog();
    document.body.appendChild(dialog.el);

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    const originalExecCommand = document.execCommand;
    let copiedCommand = "";
    document.execCommand = ((command: string) => {
      copiedCommand = command;
      return true;
    }) as typeof document.execCommand;

    const pending = dialog.show({
      joinUrl: "http://192.168.1.58:3000/?join=copy-me",
      qrDataUrl: "data:image/png;base64,copy",
    });

    const copyButton = dialog.el.querySelector(
      ".ds-share-dialog__copy-button",
    ) as HTMLButtonElement | null;
    expect(copyButton).not.toBeNull();

    const ensuredCopyButton = copyButton!;
    ensuredCopyButton.click();
    await Promise.resolve();

    expect(copiedCommand).toBe("copy");
    expect(
      ensuredCopyButton.querySelector(".ds-button__label")?.textContent?.trim(),
    ).toBe("Copied");

    document.execCommand = originalExecCommand;
    dialog.onunmount();
    await pending;
  });

  test("closes its dialog after animation", async () => {
    const dialog = createShareQrDialog();
    document.body.appendChild(dialog.el);

    const pending = dialog.show({
      joinUrl: "https://splatterboard.app/?join=done",
      qrDataUrl: "data:image/png;base64,done",
    });

    const dialogEl = dialog.el.querySelector("dialog.ds-share-dialog") as
      | HTMLDialogElement
      | null;
    expect(dialogEl?.open).toBeTrue();

    const doneButton = Array.from(
      dialog.el.querySelectorAll<HTMLButtonElement>(".ds-share-dialog .ds-button"),
    ).find((button) => button.textContent?.trim() === "Done");
    doneButton!.click();
    await waitMs(240);
    expect(dialogEl?.open).toBeFalse();
    await pending;
  });
});
