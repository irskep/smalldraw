import type { UiIntentStore } from "../controller/stores/createUiIntentStore";

export class GlobalEventSurface {
  bindIntents(options: {
    windowTarget: Window;
    documentTarget: Document;
    isDocumentPickerOpen: () => boolean;
    uiIntentStore: Pick<UiIntentStore, "publish">;
  }): () => void {
    const {
      windowTarget,
      documentTarget,
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
    listen(windowTarget, "blur", () => {
      uiIntentStore.publish({ type: "force_cancel_pointer_session" });
    });
    listen(windowTarget, "keydown", (event) => {
      if (!(event instanceof KeyboardEvent) || event.key !== "Escape") {
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
