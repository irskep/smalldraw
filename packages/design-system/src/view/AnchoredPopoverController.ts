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
      return;
    }

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
  }
}
