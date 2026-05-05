export interface AnchoredPopoverTrigger {
  el: HTMLButtonElement;
  setPressed(pressed: boolean): void;
  setAriaExpanded(expanded: boolean): void;
}

export interface AnchoredPopoverControllerOptions {
  trigger: AnchoredPopoverTrigger;
  root: HTMLElement;
  popover: HTMLElement;
  panel: HTMLElement;
  closeOnPointerLeave?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export class AnchoredPopoverController {
  private static readonly VIEWPORT_PADDING_PX = 8;
  private readonly trigger: AnchoredPopoverTrigger;
  private readonly root: HTMLElement;
  private readonly popover: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly closeOnPointerLeave: boolean;
  private readonly onOpenChange: ((open: boolean) => void) | null;
  private isOpen = false;
  private readonly documentPointerDownHandler: (event: PointerEvent) => void;
  private readonly documentPointerMoveHandler: (event: PointerEvent) => void;
  private readonly documentKeyDownHandler: (event: KeyboardEvent) => void;
  private readonly windowResizeHandler: () => void;
  private readonly windowScrollHandler: () => void;
  private pendingAnimationFrame: number | null = null;

  constructor(options: AnchoredPopoverControllerOptions) {
    this.trigger = options.trigger;
    this.root = options.root;
    this.popover = options.popover;
    this.panel = options.panel;
    this.closeOnPointerLeave = options.closeOnPointerLeave ?? false;
    this.onOpenChange = options.onOpenChange ?? null;

    this.documentPointerDownHandler = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || !this.isOpen) {
        return;
      }
      if (this.root.contains(target)) {
        return;
      }
      this.setOpen(false);
    };

    this.documentPointerMoveHandler = (event: PointerEvent) => {
      if (
        !this.isOpen ||
        !this.closeOnPointerLeave ||
        event.pointerType !== "mouse"
      ) {
        return;
      }

      const triggerRect = this.trigger.el.getBoundingClientRect();
      const panelRect = this.panel.getBoundingClientRect();
      const left = Math.min(triggerRect.left, panelRect.left);
      const right = Math.max(triggerRect.right, panelRect.right);
      const top = Math.min(triggerRect.top, panelRect.top);
      const bottom = Math.max(triggerRect.bottom, panelRect.bottom);
      const insideUnion =
        event.clientX >= left &&
        event.clientX <= right &&
        event.clientY >= top &&
        event.clientY <= bottom;

      if (!insideUnion) {
        this.setOpen(false);
      }
    };

    this.documentKeyDownHandler = (event: KeyboardEvent) => {
      if (!this.isOpen || event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      this.setOpen(false);
      this.trigger.el.focus();
    };

    this.windowResizeHandler = () => {
      if (!this.isOpen) {
        return;
      }
      this.updatePanelViewportConstraints();
    };

    this.windowScrollHandler = () => {
      if (!this.isOpen) {
        return;
      }
      this.updatePanelViewportConstraints();
    };
  }

  setOpen(open: boolean): void {
    if (this.isOpen === open) {
      return;
    }

    this.isOpen = open;
    this.popover.hidden = false;
    this.popover.dataset.open = open ? "true" : "false";
    this.popover.setAttribute("aria-hidden", open ? "false" : "true");
    this.trigger.setPressed(open);
    this.trigger.setAriaExpanded(open);
    this.onOpenChange?.(open);

    if (open) {
      this.updatePanelViewportConstraints();
      this.pendingAnimationFrame = requestAnimationFrame(() => {
        this.pendingAnimationFrame = null;
        this.updatePanelViewportConstraints();
      });
      document.addEventListener(
        "pointerdown",
        this.documentPointerDownHandler,
        true,
      );
      document.addEventListener(
        "pointermove",
        this.documentPointerMoveHandler,
        true,
      );
      document.addEventListener("keydown", this.documentKeyDownHandler, true);
      window.addEventListener("resize", this.windowResizeHandler);
      window.addEventListener("scroll", this.windowScrollHandler, true);
      return;
    }

    if (this.pendingAnimationFrame !== null) {
      cancelAnimationFrame(this.pendingAnimationFrame);
      this.pendingAnimationFrame = null;
    }
    this.panel.style.removeProperty("max-height");
    document.removeEventListener(
      "pointerdown",
      this.documentPointerDownHandler,
      true,
    );
    document.removeEventListener(
      "pointermove",
      this.documentPointerMoveHandler,
      true,
    );
    document.removeEventListener("keydown", this.documentKeyDownHandler, true);
    window.removeEventListener("resize", this.windowResizeHandler);
    window.removeEventListener("scroll", this.windowScrollHandler, true);
  }

  destroy(): void {
    if (this.pendingAnimationFrame !== null) {
      cancelAnimationFrame(this.pendingAnimationFrame);
      this.pendingAnimationFrame = null;
    }
    if (this.isOpen) {
      this.setOpen(false);
      return;
    }
    this.panel.style.removeProperty("max-height");
    document.removeEventListener(
      "pointerdown",
      this.documentPointerDownHandler,
      true,
    );
    document.removeEventListener(
      "pointermove",
      this.documentPointerMoveHandler,
      true,
    );
    document.removeEventListener("keydown", this.documentKeyDownHandler, true);
    window.removeEventListener("resize", this.windowResizeHandler);
    window.removeEventListener("scroll", this.windowScrollHandler, true);
  }

  private updatePanelViewportConstraints(): void {
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    let constraintBottom =
      viewportHeight - AnchoredPopoverController.VIEWPORT_PADDING_PX;

    for (
      let current: HTMLElement | null = this.root.parentElement;
      current;
      current = current.parentElement
    ) {
      const styles = window.getComputedStyle(current);
      const overflowY = styles.overflowY;
      const overflow = styles.overflow;
      const clipsVertically =
        overflowY === "hidden" ||
        overflowY === "auto" ||
        overflowY === "scroll" ||
        overflowY === "clip" ||
        overflow === "hidden" ||
        overflow === "auto" ||
        overflow === "scroll" ||
        overflow === "clip";
      if (!clipsVertically) {
        continue;
      }
      constraintBottom = Math.min(
        constraintBottom,
        current.getBoundingClientRect().bottom -
          AnchoredPopoverController.VIEWPORT_PADDING_PX,
      );
    }

    const triggerRect = this.trigger.el.getBoundingClientRect();
    const availableBelow = constraintBottom - triggerRect.bottom;
    this.panel.style.maxHeight = `${Math.max(0, Math.floor(availableBelow))}px`;
  }
}
