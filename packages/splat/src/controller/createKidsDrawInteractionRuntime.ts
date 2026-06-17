import type { DrawingStore } from "@smalldraw/core";
import { type IconNode, Trash2 } from "lucide";
import type { ToolbarUiStore } from "../ui/stores/toolbarUiStore";
import type { CursorOverlayController } from "./createCursorOverlayController";
import type { DocumentPickerController } from "./createDocumentPickerController";
import type { InputSessionController } from "./createInputSessionController";
import { createKidsDrawCommandController } from "./createKidsDrawCommandController";
import { createKidsDrawUiIntentController } from "./createKidsDrawUiIntentController";
import type { LifecycleScope } from "./createLifecycleScope";
import type { SnapshotService } from "./createSnapshotService";
import type { ToolbarStateController } from "./createToolbarStateController";
import type { KidsDrawRuntimeStore } from "./stores/createKidsDrawRuntimeStore";
import type { UiIntentStore } from "./stores/createUiIntentStore";

type ConfirmDialogRequest = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  icon?: IconNode;
};

export function createKidsDrawInteractionRuntime(options: {
  store: DrawingStore;
  toolbarUiStore: ToolbarUiStore;
  toolbarStateController: ToolbarStateController;
  inputSessionController: InputSessionController;
  cursorOverlay: CursorOverlayController;
  uiIntentStore: Pick<UiIntentStore, "publish" | "subscribeDrainedIntents">;
  lifecycle: Pick<LifecycleScope, "add">;
  documentBrowserCommands: {
    closeDocumentPicker: () => void;
    openDocumentPicker: () => Promise<void>;
    shareCurrentDocument: () => Promise<void>;
    isSharingAllowed?: () => boolean;
    requestSharePermission?: () => Promise<boolean>;
  };
  openParentalControls: () => Promise<boolean>;
  snapshotService: SnapshotService;
  getSize: () => { width: number; height: number };
  confirmDestructiveAction: (dialog: ConfirmDialogRequest) => Promise<boolean>;
  savePngExport?: (input: {
    suggestedName: string;
    blob?: Blob;
    dataUrl?: string;
  }) => Promise<boolean>;
  runtimeStore: Pick<KidsDrawRuntimeStore, "getActiveDocument" | "isDestroyed">;
  documentPickerController: Pick<
    DocumentPickerController,
    "isOpen" | "openCreateDialog"
  >;
  scheduleResponsiveLayout: () => void;
  debugLifecycle: (...args: unknown[]) => void;
  onShareError?: (message: string) => void;
}) {
  const { closeDocumentPicker, openDocumentPicker, shareCurrentDocument } =
    options.documentBrowserCommands;
  const loadedDocumentCommands = {
    run(command: () => void | Promise<void>): void {
      if (options.runtimeStore.getActiveDocument().type !== "loaded") {
        return;
      }
      void command();
    },
  };
  const commandController = createKidsDrawCommandController({
    store: options.store,
    toolbarUiStore: options.toolbarUiStore,
    snapshotService: options.snapshotService,
    getSize: options.getSize,
    openDocumentPicker,
    openDocumentCreateDialog: () =>
      options.documentPickerController.openCreateDialog(),
    shareCurrentDocument,
    isSharingAllowed: options.documentBrowserCommands.isSharingAllowed,
    requestSharePermission:
      options.documentBrowserCommands.requestSharePermission,
    confirmDestructiveAction: options.confirmDestructiveAction,
    savePngExport: options.savePngExport,
    clearConfirmationIcon: Trash2,
    loadedDocumentCommands,
    isDestroyed: () => options.runtimeStore.isDestroyed(),
    debugLifecycle: options.debugLifecycle,
    onShareError: options.onShareError,
  });

  const uiIntentController = createKidsDrawUiIntentController({
    runtime: {
      drawingStore: options.store,
      toolbarStateController: options.toolbarStateController,
      inputSessionController: options.inputSessionController,
      cursorOverlay: options.cursorOverlay,
    },
    commands: {
      scheduleResponsiveLayout: options.scheduleResponsiveLayout,
      undo: commandController.undo,
      redo: commandController.redo,
      clear: commandController.clear,
      export: commandController.exportAndClose,
      newDrawing: commandController.newDrawingAndClose,
      browse: commandController.browseAndClose,
      share: commandController.shareAndClose,
      parentalControls: () => {
        void options.openParentalControls();
      },
      closeDocumentPicker,
    },
  });
  const unbindUiIntents = options.uiIntentStore.subscribeDrainedIntents(
    (intents) => {
      for (const intent of intents) {
        uiIntentController.handleUiIntent(intent);
      }
    },
  );
  options.lifecycle.add(unbindUiIntents);

  return {
    commandController,
  };
}
