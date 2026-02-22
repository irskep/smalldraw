import type { DrawingStore } from "@smalldraw/core";
import { type IconNode, Trash2 } from "lucide";
import type { ToolbarUiStore } from "../ui/stores/toolbarUiStore";
import type { GlobalEventSurface } from "../view/GlobalEventSurface";
import type { KidsDrawStage } from "../view/KidsDrawStage";
import type { KidsDrawToolbar } from "../view/KidsDrawToolbar";
import type { MobilePortraitActionsView } from "../view/MobilePortraitActionsView";
import type { CursorOverlayController } from "./createCursorOverlayController";
import type { DocumentPickerController } from "./createDocumentPickerController";
import type { InputSessionController } from "./createInputSessionController";
import { createKidsDrawCommandController } from "./createKidsDrawCommandController";
import { createKidsDrawUiIntentController } from "./createKidsDrawUiIntentController";
import type { LayoutController } from "./createLayoutController";
import type { LifecycleScope } from "./createLifecycleScope";
import type { SnapshotService } from "./createSnapshotService";
import type { ToolbarStateController } from "./createToolbarStateController";
import type { KidsDrawRuntimeStore } from "./stores/createKidsDrawRuntimeStore";

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
  layoutController: LayoutController;
  toolbar: KidsDrawToolbar;
  stage: KidsDrawStage;
  mobilePortraitActionsUi: MobilePortraitActionsView;
  globalEventSurface: GlobalEventSurface;
  lifecycle: Pick<LifecycleScope, "add" | "listen">;
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

  options.mobilePortraitActionsUi.bindViewEvents({
    listen: options.lifecycle.listen,
    getCurrentLayoutProfile: () =>
      options.layoutController.getCurrentLayoutProfile(),
    onIntent: uiIntentController.handleMobilePortraitActionsIntent,
  });
  options.toolbar.bindIntents({
    listen: options.lifecycle.listen,
    onIntent: uiIntentController.handleUiIntent,
  });
  options.stage.bindPointerIntents({
    listen: options.lifecycle.listen,
    onIntent: uiIntentController.handleUiIntent,
  });
  options.globalEventSurface.bindIntents({
    listen: options.lifecycle.listen,
    windowTarget: window,
    documentTarget: document,
    getCurrentLayoutProfile: () =>
      options.layoutController.getCurrentLayoutProfile(),
    isMobileActionsOpen: () => options.toolbarUiStore.get().mobileActionsOpen,
    isInMobilePortraitChrome: (target) =>
      options.mobilePortraitActionsUi.containsTarget(target),
    isDocumentPickerOpen: () => options.documentPickerController.isOpen(),
    dispatch: uiIntentController.handleUiIntent,
  });

  return {
    commandController,
  };
}
