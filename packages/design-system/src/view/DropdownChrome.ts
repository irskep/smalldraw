import "./DropdownChrome.css";

import { el, mount, unmount } from "redom";
import {
  AnchoredPopoverController,
  type AnchoredPopoverTrigger,
} from "./AnchoredPopoverController";
import type { ReDomLike } from "./ReDomLike";

export interface DropdownChromeOptions {
  trigger: AnchoredPopoverTrigger;
  panelRole: string;
  panelLabel: string;
  align?: "start" | "end";
  closeOnPointerLeave?: boolean;
  className?: string;
  panelClassName?: string;
}

export class DropdownChrome implements ReDomLike<HTMLDivElement> {
  readonly el: HTMLDivElement;
  readonly panel: HTMLDivElement;

  private readonly popover: HTMLDivElement;
  private readonly trigger: AnchoredPopoverTrigger;
  private readonly popoverController: AnchoredPopoverController;
  private isOpen = false;

  constructor(options: DropdownChromeOptions) {
    this.trigger = options.trigger;
    this.el = el("div.ds-dropdown-chrome") as HTMLDivElement;
    if (options.className) {
      this.el.classList.add(...options.className.split(/\s+/).filter(Boolean));
    }

    this.panel = el("div.ds-dropdown-chrome__panel", {
      role: options.panelRole,
      "aria-label": options.panelLabel,
    }) as HTMLDivElement;
    if (options.panelClassName) {
      this.panel.classList.add(
        ...options.panelClassName.split(/\s+/).filter(Boolean),
      );
    }

    this.popover = el(
      "div.ds-dropdown-chrome__popover",
      { "aria-hidden": "true" },
      this.panel,
    ) as HTMLDivElement;
    this.popover.dataset.open = "false";
    this.popover.dataset.align = options.align ?? "start";
    this.popover.hidden = true;

    this.popoverController = new AnchoredPopoverController({
      trigger: this.trigger,
      root: this.el,
      popover: this.popover,
      panel: this.panel,
      closeOnPointerLeave: options.closeOnPointerLeave ?? true,
      onOpenChange: (open) => {
        this.isOpen = open;
      },
    });

    mount(this.el, this.trigger);
    this.el.append(this.popover);
  }

  get open(): boolean {
    return this.isOpen;
  }

  setOpen(open: boolean): void {
    this.popoverController.setOpen(open);
  }

  setContent(content: HTMLElement | ReDomLike<HTMLElement>): void {
    this.panel.replaceChildren();
    if (content instanceof HTMLElement) {
      this.panel.append(content);
      return;
    }
    mount(this.panel, content);
  }

  onunmount(): void {
    this.popoverController.destroy();
    for (const child of Array.from(this.panel.children)) {
      unmount(this.panel, child);
    }
  }
}

export function createDropdownChrome(
  options: DropdownChromeOptions,
): DropdownChrome {
  return new DropdownChrome(options);
}
