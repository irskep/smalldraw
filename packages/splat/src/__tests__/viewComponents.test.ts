import { describe, expect, test } from "bun:test";
import { AlertTriangle } from "lucide";
import { createModalDialogView } from "../view/ModalDialog";
import { createShareQrDialog } from "../view/ShareQrDialog";
import { createSquareIconButton } from "../view/SquareIconButton";

describe("view components", () => {
  test("SquareIconButton reflects selected/disabled state", () => {
    const button = createSquareIconButton({
      className: "kids-draw-tool-button",
      label: "Pen",
      icon: AlertTriangle,
      attributes: {
        title: "Pen",
        "aria-label": "Pen",
      },
    });

    button.setSelected(true);
    button.setDisabled(true);

    expect(button.el.classList.contains("is-selected")).toBeTrue();
    expect(button.el.getAttribute("aria-pressed")).toBe("true");
    expect(button.el.disabled).toBeTrue();
  });

  test("SquareIconButton can expose radio semantics", () => {
    const button = createSquareIconButton({
      className: "kids-draw-tool-variant-button",
      label: "Marker",
      icon: AlertTriangle,
      attributes: {
        title: "Marker",
        "aria-label": "Marker",
      },
    });

    button.setRadioSelected(true);

    expect(button.el.classList.contains("is-selected")).toBeTrue();
    expect(button.el.getAttribute("role")).toBe("radio");
    expect(button.el.getAttribute("aria-checked")).toBe("true");
    expect(button.el.getAttribute("aria-pressed")).toBeNull();
    expect(button.el.tabIndex).toBe(0);
  });

  test("ModalDialogView resolves confirm and cancel flows", async () => {
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
      ".kids-modal-dialog__button--confirm",
    ) as HTMLButtonElement | null;
    expect(confirmButton).not.toBeNull();
    confirmButton!.click();
    expect(await confirmPromise).toBeTrue();

    const cancelPromise = dialog.showConfirm({
      title: "Delete?",
      message: "This cannot be undone.",
      confirmLabel: "Delete",
    });

    const cancelButton = dialog.el.querySelector(
      ".kids-modal-dialog__button--cancel",
    ) as HTMLButtonElement | null;
    expect(cancelButton).not.toBeNull();
    cancelButton!.click();
    expect(await cancelPromise).toBeFalse();
  });

  test("ModalDialogView resolves pending prompt on onunmount", async () => {
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

  test("ShareQrDialog resolves previous show call when reopened", async () => {
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
    const doneButton = dialog.el.querySelector(
      ".kids-share-dialog__button--done",
    ) as HTMLButtonElement | null;
    expect(doneButton).not.toBeNull();
    doneButton!.click();
    await second;

    dialog.onunmount();
  });

  test("ShareQrDialog copies the join URL", async () => {
    const dialog = createShareQrDialog();
    document.body.appendChild(dialog.el);

    const writeText = async (value: string): Promise<void> => {
      copied = value;
    };
    let copied = "";
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    const pending = dialog.show({
      joinUrl: "https://splatterboard.app/?join=copy-me",
      qrDataUrl: "data:image/png;base64,copy",
    });

    const copyButton = dialog.el.querySelector(
      ".kids-share-dialog__button--secondary",
    ) as HTMLButtonElement | null;
    const urlInput = dialog.el.querySelector(
      ".kids-share-dialog__url-input",
    ) as HTMLInputElement | null;

    expect(copyButton).not.toBeNull();
    expect(urlInput).not.toBeNull();
    expect(urlInput!.value).toBe("https://splatterboard.app/?join=copy-me");

    copyButton!.click();
    await Promise.resolve();

    expect(copied).toBe("https://splatterboard.app/?join=copy-me");
    expect(copyButton!.textContent).toBe("Copied");

    dialog.onunmount();
    await pending;
  });

  test("ShareQrDialog falls back to execCommand copy", async () => {
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
      ".kids-share-dialog__button--secondary",
    ) as HTMLButtonElement | null;
    expect(copyButton).not.toBeNull();

    copyButton!.click();
    await Promise.resolve();

    expect(copiedCommand).toBe("copy");
    expect(copyButton!.textContent).toBe("Copied");

    document.execCommand = originalExecCommand;
    dialog.onunmount();
    await pending;
  });
});
