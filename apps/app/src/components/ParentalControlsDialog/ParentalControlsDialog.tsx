import {
  createModalDialogView,
  createParentalControlsDialog,
  type ParentalControlsDialog as DsParentalControlsDialog,
} from "@smalldraw/design-system";
import {
  isCorrectParentalControlsMathAnswer,
  openParentalControlsSettings,
} from "@smalldraw/shared";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { mount, unmount } from "redom";

import { useAction } from "@/hooks/useResource";
import { api } from "@/utils/api";

export interface ParentalControlsDialogHandle {
  open(): Promise<boolean>;
}

export const ParentalControlsDialog = forwardRef<
  ParentalControlsDialogHandle,
  { accountSessionExpected: boolean }
>(function ParentalControlsDialog({ accountSessionExpected }, ref) {
  const errorDialogRef = useRef<ReturnType<
    typeof createModalDialogView
  > | null>(null);
  const dialogRef = useRef<DsParentalControlsDialog | null>(null);
  const saveAccountSettingsMutation = useAction(api.saveAccountSettings.mutate);
  const verifyPinMutation = useAction(api.verifyAccountSettingsPin.mutate);

  useEffect(() => {
    const errorDialog = createModalDialogView();
    mount(document.body, errorDialog);
    errorDialogRef.current = errorDialog;
    const dialog = createParentalControlsDialog();
    mount(document.body, dialog);
    dialogRef.current = dialog;

    return () => {
      unmount(document.body, errorDialog);
      errorDialogRef.current = null;
      unmount(document.body, dialog);
      dialogRef.current = null;
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      async open() {
        const dialog = dialogRef.current;
        if (!dialog) {
          return false;
        }
        try {
          if (!accountSessionExpected) {
            return await openParentalControlsDialog(dialog);
          }
          const accountSettings = await api.accountSettings.query();
          const result = await dialog.show({
            initialState: accountSettings,
            verifyPin: async (pin) =>
              (await verifyPinMutation.run({ pin })).valid,
            isCorrectMathAnswer: isCorrectParentalControlsMathAnswer,
          });
          if (!result) {
            return false;
          }
          await saveAccountSettingsMutation.run(result);
          return true;
        } catch {
          await errorDialogRef.current?.showConfirm({
            title: "Unable to update parental controls",
            message:
              "Your settings could not be loaded or saved. Please try again.",
            confirmLabel: "OK",
            cancelLabel: "Dismiss",
          });
          return false;
        }
      },
    }),
    [accountSessionExpected, saveAccountSettingsMutation, verifyPinMutation],
  );

  return null;
});

async function openParentalControlsDialog(
  dialog: DsParentalControlsDialog,
): Promise<boolean> {
  return await openParentalControlsSettings(dialog);
}
