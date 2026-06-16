import { describe, expect, test } from "bun:test";
import { AlertTriangle } from "lucide";
import {
  createDocumentAccessState,
  createModalDialogView,
  createParentalControlsDialog,
  createShareQrDialog,
} from "../src";

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
      joinUrl: "https://splatterboard.app/draw/?join=first",
      qrDataUrl: "data:image/png;base64,first",
    });
    const second = dialog.show({
      joinUrl: "https://splatterboard.app/draw/?join=second",
      qrDataUrl: "data:image/png;base64,second",
    });

    await first;
    const doneButton = Array.from(
      dialog.el.querySelectorAll<HTMLButtonElement>(
        ".ds-share-dialog .ds-button",
      ),
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
      joinUrl: "https://splatterboard.app/draw/?join=copy-me",
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
    expect(urlInput!.value).toBe(
      "https://splatterboard.app/draw/?join=copy-me",
    );

    const ensuredCopyButton = copyButton!;
    ensuredCopyButton.click();
    await Promise.resolve();

    expect(copied).toBe("https://splatterboard.app/draw/?join=copy-me");
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
      joinUrl: "http://192.168.1.58:3000/draw/?join=copy-me",
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
      joinUrl: "https://splatterboard.app/draw/?join=done",
      qrDataUrl: "data:image/png;base64,done",
    });

    const dialogEl = dialog.el.querySelector(
      "dialog.ds-share-dialog",
    ) as HTMLDialogElement | null;
    expect(dialogEl?.open).toBeTrue();

    const doneButton = Array.from(
      dialog.el.querySelectorAll<HTMLButtonElement>(
        ".ds-share-dialog .ds-button",
      ),
    ).find((button) => button.textContent?.trim() === "Done");
    doneButton!.click();
    await waitMs(240);
    expect(dialogEl?.open).toBeFalse();
    await pending;
  });
});

describe("ParentalControlsDialog", () => {
  test("requires the math prompt before saving settings", async () => {
    const dialog = createParentalControlsDialog();
    document.body.appendChild(dialog.el);

    const pending = dialog.show({
      initialState: { hasPin: false, sharingHidden: false },
      verifyPin: async () => false,
      isCorrectMathAnswer: (answer) => answer.trim() === "30",
    });

    const accessInput = dialog.el.querySelector(
      "#ds-parental-controls-access",
    ) as HTMLInputElement | null;
    const settingsPanel = dialog.el.querySelector(
      ".ds-parental-controls-dialog__settings-panel",
    ) as HTMLDivElement | null;
    expect(accessInput).not.toBeNull();
    expect(settingsPanel?.hidden).toBeTrue();
    accessInput!.value = "29";
    clickDialogButton(dialog.el, "Continue");
    await Promise.resolve();
    expect(dialog.el.textContent).toContain("Try again.");

    accessInput!.value = "30";
    clickDialogButton(dialog.el, "Continue");
    await Promise.resolve();
    expect(settingsPanel?.hidden).toBeFalse();

    const sharingInput = dialog.el.querySelector(
      ".ds-parental-controls-dialog__checkbox",
    ) as HTMLInputElement | null;
    const pinInput = dialog.el.querySelector(
      "#ds-parental-controls-pin",
    ) as HTMLInputElement | null;
    expect(sharingInput).not.toBeNull();
    expect(pinInput).not.toBeNull();
    sharingInput!.checked = true;
    pinInput!.value = "2468";
    clickDialogButton(dialog.el, "Save");

    expect(await pending).toEqual({
      sharingHidden: true,
      pinChange: { type: "set", pin: "2468" },
    });
  });

  test("uses the PIN prompt when a PIN exists", async () => {
    const dialog = createParentalControlsDialog();
    document.body.appendChild(dialog.el);

    const pending = dialog.show({
      initialState: { hasPin: true, sharingHidden: true },
      verifyPin: async (pin) => pin === "1357",
      isCorrectMathAnswer: () => false,
    });

    const accessInput = dialog.el.querySelector(
      "#ds-parental-controls-access",
    ) as HTMLInputElement | null;
    const settingsPanel = dialog.el.querySelector(
      ".ds-parental-controls-dialog__settings-panel",
    ) as HTMLDivElement | null;
    expect(accessInput?.type).toBe("password");
    expect(settingsPanel?.hidden).toBeTrue();
    accessInput!.value = "0000";
    clickDialogButton(dialog.el, "Continue");
    await Promise.resolve();
    expect(dialog.el.textContent).toContain("Incorrect PIN.");

    accessInput!.value = "1357";
    clickDialogButton(dialog.el, "Continue");
    await Promise.resolve();
    expect(settingsPanel?.hidden).toBeFalse();

    clickDialogButton(dialog.el, "Clear PIN");
    clickDialogButton(dialog.el, "Save");

    expect(await pending).toEqual({
      sharingHidden: true,
      pinChange: { type: "clear" },
    });
  });
});

describe("DocumentAccessState", () => {
  test("renders auth actions and invokes retry/reset handlers", async () => {
    const state = createDocumentAccessState({
      title: "You can't access this drawing",
      description:
        "This drawing needs account access. Log in or sign up to continue.",
      message: "Log in or sign up to open this account-linked drawing.",
      loginUrl: "http://localhost:3000/login?redirect=%2Fdraw%2F%3Fdoc%3Ddemo",
      signupUrl:
        "http://localhost:3000/register?redirect=%2Fdraw%2F%3Fdoc%3Ddemo",
      recoveryActions: "retry-and-reset",
    });
    document.body.appendChild(state.el);

    let retried = false;
    let reset = false;
    state.setOnRetry(() => {
      retried = true;
    });
    state.setOnReset(() => {
      reset = true;
    });

    const loginLink = state.el.querySelector(
      ".ds-document-access-state__auth-link--login",
    ) as HTMLAnchorElement | null;
    const signupLink = state.el.querySelector(
      ".ds-document-access-state__auth-link--signup",
    ) as HTMLAnchorElement | null;
    const retryButton = state.el.querySelector(
      ".ds-document-access-state__retry-button",
    ) as HTMLButtonElement | null;
    const resetButton = state.el.querySelector(
      ".ds-document-access-state__reset-button",
    ) as HTMLButtonElement | null;
    const actionGroups = Array.from(
      state.el.querySelectorAll(".ds-document-access-state__action-group"),
    ) as HTMLDivElement[];

    expect(loginLink?.href).toBe(
      "http://localhost:3000/login?redirect=%2Fdraw%2F%3Fdoc%3Ddemo",
    );
    expect(signupLink?.href).toBe(
      "http://localhost:3000/register?redirect=%2Fdraw%2F%3Fdoc%3Ddemo",
    );
    expect(loginLink?.hidden).toBeFalse();
    expect(signupLink?.hidden).toBeFalse();
    expect(
      loginLink?.classList.contains(
        "ds-document-access-state__auth-link--primary",
      ),
    ).toBeTrue();
    expect(
      signupLink?.classList.contains(
        "ds-document-access-state__auth-link--neutral",
      ),
    ).toBeTrue();
    expect(actionGroups).toHaveLength(2);
    expect(actionGroups[0]?.textContent).toContain("Retry");
    expect(actionGroups[0]?.textContent).toContain("Reset Local Session");
    expect(actionGroups[1]?.textContent).toContain("Sign Up");
    expect(actionGroups[1]?.textContent).toContain("Log In");

    retryButton?.click();
    resetButton?.click();
    expect(retried).toBeTrue();
    expect(reset).toBeTrue();
  });

  test("hides auth links for generic startup failures", () => {
    const state = createDocumentAccessState({
      title: "Could not open drawing",
      description: "Startup failed. This should not leave a blank screen.",
      message: "Unexpected failure",
      recoveryActions: "retry-and-reset",
    });
    document.body.appendChild(state.el);

    const loginLink = state.el.querySelector(
      ".ds-document-access-state__auth-link--login",
    ) as HTMLAnchorElement | null;
    const signupLink = state.el.querySelector(
      ".ds-document-access-state__auth-link--signup",
    ) as HTMLAnchorElement | null;
    const message = state.el.querySelector(
      ".ds-document-access-state__message",
    ) as HTMLPreElement | null;

    expect(loginLink?.hidden).toBeTrue();
    expect(signupLink?.hidden).toBeTrue();
    expect(message?.textContent).toBe("Unexpected failure");
  });

  test("can render loading copy without recovery actions", () => {
    const state = createDocumentAccessState({
      title: "Opening drawing…",
      description: "Shared drawings can take a moment to respond.",
      recoveryActions: "none",
    });
    document.body.appendChild(state.el);

    const utilityActions = state.el.querySelector(
      ".ds-document-access-state__action-group--utility",
    ) as HTMLDivElement | null;

    expect(utilityActions?.childElementCount).toBe(0);
  });
});

function clickDialogButton(root: HTMLElement, label: string): void {
  const button = Array.from(
    root.querySelectorAll<HTMLButtonElement>(".ds-button"),
  ).find((candidate) => candidate.textContent?.trim() === label);
  expect(button).not.toBeUndefined();
  button!.click();
}
