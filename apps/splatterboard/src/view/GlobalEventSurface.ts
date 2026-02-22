import type { KidsDrawUiIntent } from "../controller/KidsDrawUiIntent";

type ListenFn = (
  target: EventTarget,
  type: string,
  handler: (event: Event) => void,
) => void;

export class GlobalEventSurface {
  bindIntents(options: {
    listen: ListenFn;
    windowTarget: Window;
    documentTarget: Document;
    getCurrentLayoutProfile: () => string;
    isMobileActionsOpen: () => boolean;
    isInMobilePortraitChrome: (target: Node) => boolean;
    isDocumentPickerOpen: () => boolean;
    dispatch: (intent: KidsDrawUiIntent) => void;
  }): void {
    const {
      listen,
      windowTarget,
      documentTarget,
      getCurrentLayoutProfile,
      isMobileActionsOpen,
      isInMobilePortraitChrome,
      isDocumentPickerOpen,
      dispatch,
    } = options;

    listen(windowTarget, "resize", () => {
      dispatch({ type: "window_resize" });
    });
    if (windowTarget.visualViewport) {
      listen(windowTarget.visualViewport, "resize", () => {
        dispatch({ type: "window_resize" });
      });
    }
    listen(windowTarget, "pointerup", (event) => {
      dispatch({ type: "pointer_up", event: event as PointerEvent });
    });
    listen(windowTarget, "pointercancel", (event) => {
      dispatch({ type: "pointer_cancel", event: event as PointerEvent });
    });
    listen(windowTarget, "pointerdown", (event) => {
      if (
        getCurrentLayoutProfile() !== "mobile-portrait" ||
        !isMobileActionsOpen()
      ) {
        return;
      }
      const target = event.target as Node | null;
      if (target && isInMobilePortraitChrome(target)) {
        return;
      }
      dispatch({ type: "close_mobile_actions" });
    });
    listen(windowTarget, "blur", () => {
      dispatch({ type: "force_cancel_pointer_session" });
    });
    listen(windowTarget, "resize", () => {
      dispatch({ type: "position_mobile_actions_popover" });
    });
    listen(windowTarget, "scroll", () => {
      dispatch({ type: "position_mobile_actions_popover" });
    });
    if (windowTarget.visualViewport) {
      listen(windowTarget.visualViewport, "resize", () => {
        dispatch({ type: "position_mobile_actions_popover" });
      });
      listen(windowTarget.visualViewport, "scroll", () => {
        dispatch({ type: "position_mobile_actions_popover" });
      });
    }
    listen(windowTarget, "keydown", (event) => {
      if (!(event instanceof KeyboardEvent) || event.key !== "Escape") {
        return;
      }
      if (isMobileActionsOpen()) {
        event.preventDefault();
        dispatch({ type: "close_mobile_actions" });
        return;
      }
      if (isDocumentPickerOpen()) {
        event.preventDefault();
        dispatch({ type: "close_document_picker" });
      }
    });
    listen(documentTarget, "visibilitychange", () => {
      if (documentTarget.visibilityState === "hidden") {
        dispatch({ type: "force_cancel_pointer_session" });
      }
    });
  }
}
