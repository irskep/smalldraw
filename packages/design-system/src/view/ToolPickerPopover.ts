import type { IconNode } from "lucide";
import { Pen } from "lucide";
import { el } from "redom";
import { AnchoredPopoverController } from "./AnchoredPopoverController";
import type { ReDomLike } from "./ReDomLike";
import {
  createIconButton,
  type IconButton,
  type IconButtonSource,
} from "./SquareIconButton";

export interface ToolPickerPopoverOptions {
  className?: string;
  panelClassName?: string;
  label?: string;
  icon?: IconButtonSource;
  panelLabel?: string;
}

export class ToolPickerPopover implements ReDomLike<HTMLDivElement> {
  readonly el: HTMLDivElement;
  readonly trigger: IconButton;

  private readonly popover: HTMLDivElement;
  private readonly panel: HTMLDivElement;
  private readonly controller: AnchoredPopoverController;
  private isOpen = false;

  constructor(options: ToolPickerPopoverOptions = {}) {
    this.el = el(
      `div.${options.className ?? "ds-splat-context__tool-dropdown"}`,
    ) as HTMLDivElement;
    this.trigger = createIconButton({
      className: "ds-splat-context__tool-menu-trigger",
      label: options.label ?? "Tools",
      icon: options.icon ?? (Pen as IconNode),
      dropdown: true,
      attributes: {
        "aria-haspopup": "dialog",
        "aria-expanded": "false",
        title: "Show tools",
      },
    });
    this.panel = el(
      `div.${options.panelClassName ?? "ds-splat-context__tool-dropdown-panel"}`,
      {
        role: "dialog",
        "aria-label": options.panelLabel ?? "Tool picker",
      },
    ) as HTMLDivElement;
    this.popover = el(
      "div.ds-splat-context__tool-dropdown-popover",
      { "aria-hidden": "true" },
      this.panel,
    ) as HTMLDivElement;
    this.popover.dataset.open = "false";
    this.popover.hidden = true;
    this.controller = new AnchoredPopoverController({
      trigger: this.trigger,
      root: this.el,
      popover: this.popover,
      panel: this.panel,
      closeOnPointerLeave: true,
      onOpenChange: (open) => {
        this.isOpen = open;
      },
    });

    this.trigger.setOnPress(() => {
      this.setOpen(!this.isOpen);
    });
    this.el.append(this.trigger.el, this.popover);
  }

  setContent(content: HTMLElement): void {
    this.panel.replaceChildren(content);
  }

  setOpen(open: boolean): void {
    this.controller.setOpen(open);
  }

  onunmount(): void {
    this.trigger.setOnPress(null);
    this.controller.destroy();
  }
}

export function createToolPickerPopover(
  options?: ToolPickerPopoverOptions,
): ToolPickerPopover {
  return new ToolPickerPopover(options);
}
