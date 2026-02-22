import type { UiIntentStore } from "../controller/stores/createUiIntentStore";

export class GlobalEventSurface {
  bindIntents(options: {
    windowTarget: Window;
    documentTarget: Document;
    getCurrentLayoutProfile: () => string;
    isMobileActionsOpen: () => boolean;
    isInMobilePortraitChrome: (target: Node) => boolean;
    isDocumentPickerOpen: () => boolean;
    uiIntentStore: Pick<UiIntentStore, "publish">;
  }): () => void {
    const {
      windowTarget,
      documentTarget,
      getCurrentLayoutProfile,
      isMobileActionsOpen,
      isInMobilePortraitChrome,
      isDocumentPickerOpen,
      uiIntentStore,
    } = options;
    const disposers: Array<() => void> = [];
    const listen = (
      target: EventTarget,
      type: string,
      handler: (event: Event) => void,
    ): void => {
      const listener: EventListener = (event) => handler(event);
      target.addEventListener(type, listener);
      disposers.push(() => target.removeEventListener(type, listener));
    };

    listen(windowTarget, "resize", () => {
      uiIntentStore.publish({ type: "window_resize" });
    });
    if (windowTarget.visualViewport) {
      listen(windowTarget.visualViewport, "resize", () => {
        uiIntentStore.publish({ type: "window_resize" });
      });
    }
    listen(windowTarget, "pointerup", (event) => {
      uiIntentStore.publish({
        type: "pointer_up",
        event: event as PointerEvent,
      });
    });
    listen(windowTarget, "pointercancel", (event) => {
      uiIntentStore.publish({
        type: "pointer_cancel",
        event: event as PointerEvent,
      });
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
      uiIntentStore.publish({ type: "close_mobile_actions" });
    });
    listen(windowTarget, "blur", () => {
      uiIntentStore.publish({ type: "force_cancel_pointer_session" });
    });
    listen(windowTarget, "resize", () => {
      uiIntentStore.publish({ type: "position_mobile_actions_popover" });
    });
    listen(windowTarget, "scroll", () => {
      uiIntentStore.publish({ type: "position_mobile_actions_popover" });
    });
    if (windowTarget.visualViewport) {
      listen(windowTarget.visualViewport, "resize", () => {
        uiIntentStore.publish({ type: "position_mobile_actions_popover" });
      });
      listen(windowTarget.visualViewport, "scroll", () => {
        uiIntentStore.publish({ type: "position_mobile_actions_popover" });
      });
    }
    listen(windowTarget, "keydown", (event) => {
      if (!(event instanceof KeyboardEvent) || event.key !== "Escape") {
        return;
      }
      if (isMobileActionsOpen()) {
        event.preventDefault();
        uiIntentStore.publish({ type: "close_mobile_actions" });
        return;
      }
      if (isDocumentPickerOpen()) {
        event.preventDefault();
        uiIntentStore.publish({ type: "close_document_picker" });
      }
    });
    listen(documentTarget, "visibilitychange", () => {
      if (documentTarget.visibilityState === "hidden") {
        uiIntentStore.publish({ type: "force_cancel_pointer_session" });
      }
    });
    return () => {
      for (const dispose of disposers) {
        dispose();
      }
    };
  }
}
