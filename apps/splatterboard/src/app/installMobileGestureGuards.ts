type Disposer = () => void;

function isTouchLikeDevice(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  if (navigator.maxTouchPoints > 0) {
    return true;
  }
  return window.matchMedia?.("(pointer: coarse)").matches ?? false;
}

function preventDefaultIfCancelable(event: Event): void {
  if (event.cancelable) {
    event.preventDefault();
  }
}

function listenNonPassive(
  target: EventTarget,
  type: string,
  handler: (event: Event) => void,
): Disposer {
  const listener: EventListener = (event) => handler(event);
  target.addEventListener(type, listener, { passive: false });
  return () => target.removeEventListener(type, listener);
}

export function installMobileGestureGuards(): Disposer {
  if (!isTouchLikeDevice() || typeof document === "undefined") {
    return () => {};
  }

  const disposers: Disposer[] = [];

  disposers.push(
    listenNonPassive(document, "touchmove", (event) => {
      preventDefaultIfCancelable(event);
    }),
  );

  disposers.push(
    listenNonPassive(document, "gesturestart", (event) => {
      preventDefaultIfCancelable(event);
    }),
  );

  disposers.push(
    listenNonPassive(document, "gesturechange", (event) => {
      preventDefaultIfCancelable(event);
    }),
  );

  disposers.push(
    listenNonPassive(document, "gestureend", (event) => {
      preventDefaultIfCancelable(event);
    }),
  );

  disposers.push(
    listenNonPassive(document, "wheel", (event) => {
      const wheelEvent = event as WheelEvent;
      if (wheelEvent.ctrlKey) {
        preventDefaultIfCancelable(event);
      }
    }),
  );

  return (): void => {
    while (disposers.length > 0) {
      disposers.pop()?.();
    }
  };
}
