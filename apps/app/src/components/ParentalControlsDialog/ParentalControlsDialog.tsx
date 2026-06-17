import {
  createParentalControlsDialog,
  type ParentalControlsDialog as DsParentalControlsDialog,
} from "@smalldraw/design-system";
import { openParentalControlsSettings } from "@smalldraw/shared";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { mount, unmount } from "redom";

export interface ParentalControlsDialogHandle {
  open(): Promise<boolean>;
}

export const ParentalControlsDialog = forwardRef<ParentalControlsDialogHandle>(
  function ParentalControlsDialog(_props, ref) {
    const dialogRef = useRef<DsParentalControlsDialog | null>(null);

    useEffect(() => {
      const dialog = createParentalControlsDialog();
      mount(document.body, dialog);
      dialogRef.current = dialog;

      return () => {
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
          return await openParentalControlsDialog(dialog);
        },
      }),
      [],
    );

    return null;
  },
);

async function openParentalControlsDialog(
  dialog: DsParentalControlsDialog,
): Promise<boolean> {
  return await openParentalControlsSettings(dialog);
}
