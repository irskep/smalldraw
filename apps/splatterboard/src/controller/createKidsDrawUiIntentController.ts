import type { DrawingStore } from "@smalldraw/core";
import type { ToolbarUiStore } from "../ui/stores/toolbarUiStore";
import type { MobilePortraitActionsIntent } from "../view/MobilePortraitActionsView";
import type { CursorOverlayController } from "./createCursorOverlayController";
import type { InputSessionController } from "./createInputSessionController";
import type { ToolbarStateController } from "./createToolbarStateController";
import type { KidsDrawUiIntent } from "./KidsDrawUiIntent";

export function createKidsDrawUiIntentController(options: {
  runtime: {
    toolbarUiStore: Pick<
      ToolbarUiStore,
      "get" | "setMobileTopPanel" | "setMobileActionsOpen"
    >;
    drawingStore: Pick<DrawingStore, "updateSharedSettings">;
    toolbarStateController: Pick<
      ToolbarStateController,
      "activateFamilyTool" | "activateToolAndRemember"
    >;
    inputSessionController: Pick<
      InputSessionController,
      | "handlePointerDown"
      | "handlePointerMove"
      | "handlePointerRawUpdate"
      | "handlePointerUp"
      | "handlePointerCancel"
      | "forceCancelPointerSession"
    >;
    cursorOverlay: Pick<
      CursorOverlayController,
      "handlePointerEnter" | "handlePointerLeave"
    >;
  };
  commands: {
    scheduleResponsiveLayout: () => void;
    undo: () => void;
    redo: () => void;
    clear: () => void;
    export: () => void;
    newDrawing: () => void;
    browse: () => void;
    positionMobilePortraitActionsPopover: () => void;
    closeDocumentPicker: () => void;
  };
}) {
  const handleUiIntent = (intent: KidsDrawUiIntent): void => {
    switch (intent.type) {
      case "window_resize":
        options.commands.scheduleResponsiveLayout();
        return;
      case "activate_family_tool":
        options.runtime.toolbarStateController.activateFamilyTool(
          intent.familyId,
        );
        return;
      case "activate_tool_and_remember":
        options.runtime.toolbarStateController.activateToolAndRemember(
          intent.toolId,
        );
        return;
      case "undo":
        options.commands.undo();
        return;
      case "redo":
        options.commands.redo();
        return;
      case "toggle_mobile_actions":
        options.runtime.toolbarUiStore.setMobileActionsOpen(
          !options.runtime.toolbarUiStore.get().mobileActionsOpen,
        );
        return;
      case "set_mobile_top_panel":
        options.runtime.toolbarUiStore.setMobileTopPanel(intent.panel);
        return;
      case "clear":
        options.commands.clear();
        return;
      case "export":
        options.commands.export();
        return;
      case "new_drawing":
        options.commands.newDrawing();
        return;
      case "browse":
        options.commands.browse();
        return;
      case "set_stroke_color":
        options.runtime.drawingStore.updateSharedSettings({
          strokeColor: intent.strokeColor,
        });
        return;
      case "set_stroke_width":
        options.runtime.drawingStore.updateSharedSettings({
          strokeWidth: intent.strokeWidth,
        });
        return;
      case "pointer_down":
        options.runtime.inputSessionController.handlePointerDown(intent.event);
        return;
      case "pointer_move":
        options.runtime.inputSessionController.handlePointerMove(intent.event);
        return;
      case "pointer_rawupdate":
        options.runtime.inputSessionController.handlePointerRawUpdate(
          intent.event,
        );
        return;
      case "pointer_enter":
        options.runtime.cursorOverlay.handlePointerEnter(intent.event);
        return;
      case "pointer_up":
        options.runtime.inputSessionController.handlePointerUp(intent.event);
        return;
      case "pointer_cancel":
        options.runtime.inputSessionController.handlePointerCancel(
          intent.event,
        );
        return;
      case "lost_pointer_capture":
        options.runtime.inputSessionController.forceCancelPointerSession();
        return;
      case "pointer_leave":
        options.runtime.cursorOverlay.handlePointerLeave();
        return;
      case "force_cancel_pointer_session":
        options.runtime.inputSessionController.forceCancelPointerSession();
        return;
      case "close_mobile_actions":
        options.runtime.toolbarUiStore.setMobileActionsOpen(false);
        return;
      case "position_mobile_actions_popover":
        options.commands.positionMobilePortraitActionsPopover();
        return;
      case "close_document_picker":
        options.commands.closeDocumentPicker();
        return;
      default: {
        const exhaustiveCheck: never = intent;
        throw new Error(`Unhandled KidsDrawUiIntent: ${exhaustiveCheck}`);
      }
    }
  };

  const handleMobilePortraitActionsIntent = (
    intent: MobilePortraitActionsIntent,
  ): void => {
    switch (intent) {
      case "undo":
        handleUiIntent({ type: "undo" });
        return;
      case "redo":
        handleUiIntent({ type: "redo" });
        return;
      case "toggle_actions":
        handleUiIntent({ type: "toggle_mobile_actions" });
        return;
      case "show_colors":
        handleUiIntent({ type: "set_mobile_top_panel", panel: "colors" });
        return;
      case "show_strokes":
        handleUiIntent({ type: "set_mobile_top_panel", panel: "strokes" });
        return;
      case "clear":
        handleUiIntent({ type: "clear" });
        return;
      case "export":
        handleUiIntent({ type: "export" });
        return;
      case "new_drawing":
        handleUiIntent({ type: "new_drawing" });
        return;
      case "browse":
        handleUiIntent({ type: "browse" });
        return;
      default: {
        const exhaustiveCheck: never = intent;
        throw new Error(
          `Unhandled MobilePortraitActionsIntent: ${exhaustiveCheck}`,
        );
      }
    }
  };

  return {
    handleUiIntent,
    handleMobilePortraitActionsIntent,
  };
}
