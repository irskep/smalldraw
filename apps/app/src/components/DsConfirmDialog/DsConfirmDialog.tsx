import {
  createModalDialogView,
  type ModalDialogOptions,
  type ModalDialogView,
} from "@smalldraw/design-system";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { mount, unmount } from "redom";

export interface DsConfirmDialogHandle {
  confirm(options: ModalDialogOptions): Promise<boolean>;
}

export const DsConfirmDialog = forwardRef<DsConfirmDialogHandle>(
  function DsConfirmDialog(_props, ref) {
    const dialogRef = useRef<ModalDialogView | null>(null);

    useEffect(() => {
      const dialog = createModalDialogView();
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
        async confirm(options) {
          const dialog = dialogRef.current;
          if (!dialog) {
            return false;
          }
          return await dialog.showConfirm(options);
        },
      }),
      [],
    );

    return null;
  },
);
