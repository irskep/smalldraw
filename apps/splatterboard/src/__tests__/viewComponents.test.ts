import { describe, expect, test } from "bun:test";
import { AlertTriangle } from "lucide";
import { createModalDialogView } from "../view/ModalDialog";
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
});
