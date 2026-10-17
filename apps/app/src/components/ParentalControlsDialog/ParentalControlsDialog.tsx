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
import { trpc } from "@/utils/trpc";

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
  const accountSettingsQuery = trpc.accountSettings.useQuery(undefined, {
    enabled: false,
    retry: false,
  });
  const saveAccountSettingsMutation = trpc.saveAccountSettings.useMutation();
  const verifyPinMutation = trpc.verifyAccountSettingsPin.useMutation();

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
          const accountSettings = await accountSettingsQuery.refetch();
          if (accountSettings.error || !accountSettings.data) {
            throw new Error("Could not load account settings");
          }
          const result = await dialog.show({
            initialState: accountSettings.data,
            verifyPin: async (pin) =>
              (await verifyPinMutation.mutateAsync({ pin })).valid,
            isCorrectMathAnswer: isCorrectParentalControlsMathAnswer,
          });
          if (!result) {
            return false;
          }
          await saveAccountSettingsMutation.mutateAsync(result);
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
    [
      accountSessionExpected,
      accountSettingsQuery,
      saveAccountSettingsMutation,
      verifyPinMutation,
    ],
  );

  return null;
});

async function openParentalControlsDialog(
  dialog: DsParentalControlsDialog,
): Promise<boolean> {
  return await openParentalControlsSettings(dialog);
}
