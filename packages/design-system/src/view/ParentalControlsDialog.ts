import "./ParentalControlsDialog.css";

import { Button } from "./Button";
import { DialogScaffold } from "./DialogScaffold";
import type { ReDomLike } from "./ReDomLike";

export type ParentalControlsDialogInitialState = {
  hasPin: boolean;
  sharingHidden: boolean;
};

export type ParentalControlsDialogResult = {
  sharingHidden: boolean;
  pinChange:
    | { type: "unchanged" }
    | { type: "set"; pin: string }
    | { type: "clear" };
};

export type ParentalControlsDialogOptions = {
  initialState: ParentalControlsDialogInitialState;
  verifyPin: (pin: string) => Promise<boolean>;
  isCorrectMathAnswer: (answer: string) => boolean;
};

export interface ParentalControlsDialog extends ReDomLike<HTMLDivElement> {
  show(
    options: ParentalControlsDialogOptions,
  ): Promise<ParentalControlsDialogResult | null>;
}

type Step = "access" | "settings";

export class ParentalControlsDialogView implements ParentalControlsDialog {
  readonly el: HTMLDivElement;

  readonly #scaffold = new DialogScaffold();
  readonly #content = document.createElement("div");
  readonly #form = document.createElement("form");
  readonly #accessField = document.createElement("div");
  readonly #accessLabel = document.createElement("label");
  readonly #accessInput = document.createElement("input");
  readonly #accessPanel = document.createElement("div");
  readonly #settingsPanel = document.createElement("div");
  readonly #sharingField = document.createElement("label");
  readonly #sharingInput = document.createElement("input");
  readonly #pinField = document.createElement("div");
  readonly #pinLabel = document.createElement("label");
  readonly #pinInput = document.createElement("input");
  readonly #clearPinRow = document.createElement("div");
  readonly #clearPinButton = new Button({
    label: "Clear PIN",
    tone: "neutral",
  });
  readonly #error = document.createElement("p");
  readonly #hint = document.createElement("p");
  readonly #cancelButton = new Button({ label: "Cancel", tone: "neutral" });
  readonly #confirmButton = new Button({ label: "Continue", tone: "primary" });
  readonly #actions = document.createElement("div");

  #options: ParentalControlsDialogOptions | null = null;
  #resolve: ((value: ParentalControlsDialogResult | null) => void) | null =
    null;
  #step: Step = "access";
  #pinChange: ParentalControlsDialogResult["pinChange"] = {
    type: "unchanged",
  };

  constructor() {
    this.#scaffold.setDialogClassName("ds-parental-controls-dialog");
    this.#scaffold.setSurfaceClassName("ds-parental-controls-dialog__shell");
    this.#scaffold.setOnDismiss(() => {
      void this.#finish(null);
    });
    this.#content.className = "ds-parental-controls-dialog__content";
    this.#form.className = "ds-parental-controls-dialog__form";
    this.#accessPanel.className =
      "ds-parental-controls-dialog__form ds-parental-controls-dialog__access-panel";
    this.#accessField.className = "ds-parental-controls-dialog__field";
    this.#accessLabel.className = "ds-parental-controls-dialog__label";
    this.#accessLabel.htmlFor = "ds-parental-controls-access";
    this.#accessInput.className = "ds-parental-controls-dialog__input";
    this.#accessInput.id = "ds-parental-controls-access";
    this.#accessInput.inputMode = "numeric";
    this.#accessInput.autocomplete = "off";
    this.#accessField.append(this.#accessLabel, this.#accessInput);
    this.#accessPanel.append(this.#accessField);

    this.#settingsPanel.className =
      "ds-parental-controls-dialog__form ds-parental-controls-dialog__settings-panel";
    this.#sharingField.className =
      "ds-parental-controls-dialog__checkbox-field";
    this.#sharingInput.className = "ds-parental-controls-dialog__checkbox";
    this.#sharingInput.type = "checkbox";
    this.#sharingField.append(this.#sharingInput, "Hide sharing");

    this.#pinField.className = "ds-parental-controls-dialog__field";
    this.#pinLabel.className = "ds-parental-controls-dialog__label";
    this.#pinLabel.htmlFor = "ds-parental-controls-pin";
    this.#pinLabel.textContent = "PIN";
    this.#pinInput.className = "ds-parental-controls-dialog__input";
    this.#pinInput.id = "ds-parental-controls-pin";
    this.#pinInput.type = "password";
    this.#pinInput.autocomplete = "new-password";
    this.#pinInput.placeholder = "Optional";
    this.#pinField.append(this.#pinLabel, this.#pinInput);

    this.#clearPinRow.className = "ds-parental-controls-dialog__clear-row";
    this.#clearPinRow.append(this.#clearPinButton.el);
    this.#settingsPanel.append(
      this.#sharingField,
      this.#pinField,
      this.#clearPinRow,
    );

    this.#error.className = "ds-parental-controls-dialog__error";
    this.#error.hidden = true;
    this.#hint.className = "ds-parental-controls-dialog__hint";
    this.#actions.className = "ds-parental-controls-dialog__actions";
    this.#actions.append(this.#cancelButton.el, this.#confirmButton.el);
    this.#form.append(
      this.#accessPanel,
      this.#settingsPanel,
      this.#hint,
      this.#error,
      this.#actions,
    );
    this.#content.append(this.#form);
    this.#scaffold.setBody(this.#content);
    this.el = this.#scaffold.el;

    this.#form.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.#submit();
    });
    this.#cancelButton.setOnPress(() => {
      void this.#finish(null);
    });
    this.#confirmButton.setOnPress(() => {
      void this.#submit();
    });
    this.#clearPinButton.setOnPress(() => {
      this.#pinChange = { type: "clear" };
      this.#pinInput.value = "";
      this.#setError("");
      this.#hint.textContent = "PIN will be cleared when you save.";
    });
  }

  async show(
    options: ParentalControlsDialogOptions,
  ): Promise<ParentalControlsDialogResult | null> {
    this.#resolve?.(null);
    this.#options = options;
    this.#pinChange = { type: "unchanged" };
    this.#sharingInput.checked = options.initialState.sharingHidden;
    this.#pinInput.value = "";
    this.#accessInput.value = "";
    this.#clearPinRow.hidden = !options.initialState.hasPin;
    this.#setStep("access");
    this.#scaffold.show();
    this.#accessInput.focus();

    return await new Promise((resolve) => {
      this.#resolve = resolve;
    });
  }

  onunmount(): void {
    this.#scaffold.onunmount?.();
    this.#resolve?.(null);
    this.#resolve = null;
  }

  async #submit(): Promise<void> {
    if (this.#step === "access") {
      await this.#submitAccess();
      return;
    }
    await this.#submitSettings();
  }

  async #submitAccess(): Promise<void> {
    const options = this.#requireOptions();
    const value = this.#accessInput.value;
    const allowed = options.initialState.hasPin
      ? await options.verifyPin(value)
      : options.isCorrectMathAnswer(value);
    if (!allowed) {
      this.#setError(
        options.initialState.hasPin ? "Incorrect PIN." : "Try again.",
      );
      this.#accessInput.select();
      return;
    }
    this.#setStep("settings");
    this.#sharingInput.focus();
  }

  async #submitSettings(): Promise<void> {
    const pin = this.#pinInput.value.trim();
    const pinChange = pin ? ({ type: "set", pin } as const) : this.#pinChange;
    await this.#finish({
      sharingHidden: this.#sharingInput.checked,
      pinChange,
    });
  }

  #setStep(step: Step): void {
    const hasPin = this.#requireOptions().initialState.hasPin;
    this.#step = step;
    this.#setError("");
    this.#accessPanel.hidden = step !== "access";
    this.#settingsPanel.hidden = step !== "settings";
    this.#confirmButton.setLabel(step === "access" ? "Continue" : "Save");
    if (step === "access") {
      this.#scaffold.setTitle("Parental controls");
      this.#scaffold.setSubtitle(
        hasPin ? "Enter your PIN to continue." : "Solve 5 x 6 to continue.",
      );
      this.#accessLabel.textContent = hasPin ? "PIN" : "What is 5 x 6?";
      this.#accessInput.type = hasPin ? "password" : "text";
      this.#hint.textContent = "";
      return;
    }
    this.#scaffold.setTitle("Parental controls");
    this.#scaffold.setSubtitle("Manage local controls for this browser.");
    this.#hint.textContent = hasPin
      ? "Leave PIN blank to keep the current PIN."
      : "Set a PIN to skip the math puzzle next time.";
  }

  async #finish(value: ParentalControlsDialogResult | null): Promise<void> {
    if (!this.#resolve) {
      return;
    }
    await this.#scaffold.close({ animated: true });
    const resolve = this.#resolve;
    this.#resolve = null;
    this.#options = null;
    resolve(value);
  }

  #setError(message: string): void {
    this.#error.textContent = message;
    this.#error.hidden = message.length === 0;
  }

  #requireOptions(): ParentalControlsDialogOptions {
    if (!this.#options) {
      throw new Error("Parental controls dialog is not open");
    }
    return this.#options;
  }
}

export function createParentalControlsDialog(): ParentalControlsDialog {
  return new ParentalControlsDialogView();
}
