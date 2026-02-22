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
  };
  snapshotService: SnapshotService;
  getSize: () => { width: number; height: number };
  confirmDestructiveAction: (dialog: ConfirmDialogRequest) => Promise<boolean>;
  runtimeStore: Pick<KidsDrawRuntimeStore, "isDestroyed">;
  documentPickerController: Pick<
    DocumentPickerController,
    "isOpen" | "openCreateDialog"
  >;
  scheduleResponsiveLayout: () => void;
  positionMobilePortraitActionsPopover: () => void;
  applyToolbarLayoutProfile: () => void;
  debugLifecycle: (...args: unknown[]) => void;
}) {
  const { closeDocumentPicker, openDocumentPicker } =
    options.documentBrowserCommands;
  const commandController = createKidsDrawCommandController({
    store: options.store,
    toolbarUiStore: options.toolbarUiStore,
    snapshotService: options.snapshotService,
    getSize: options.getSize,
    openDocumentPicker,
    openDocumentCreateDialog: () =>
      options.documentPickerController.openCreateDialog(),
    confirmDestructiveAction: options.confirmDestructiveAction,
    clearConfirmationIcon: Trash2,
    isDestroyed: () => options.runtimeStore.isDestroyed(),
    debugLifecycle: options.debugLifecycle,
  });

  let lastMobileTopPanel = options.toolbarUiStore.get().mobileTopPanel;
  let lastMobileActionsOpen = options.toolbarUiStore.get().mobileActionsOpen;
  const unbindMobileLayoutState = options.toolbarUiStore.subscribe((state) => {
    const topPanelChanged = state.mobileTopPanel !== lastMobileTopPanel;
    const actionsOpenChanged =
      state.mobileActionsOpen !== lastMobileActionsOpen;
    if (!topPanelChanged && !actionsOpenChanged) {
      return;
    }
    lastMobileTopPanel = state.mobileTopPanel;
    lastMobileActionsOpen = state.mobileActionsOpen;
    options.applyToolbarLayoutProfile();
    if (state.mobileActionsOpen) {
      options.positionMobilePortraitActionsPopover();
    }
  });
  options.lifecycle.add(unbindMobileLayoutState);

  const uiIntentController = createKidsDrawUiIntentController({
    runtime: {
      toolbarUiStore: options.toolbarUiStore,
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
      positionMobilePortraitActionsPopover:
        options.positionMobilePortraitActionsPopover,
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
