import "./DropdownMenu.css";

import { type IconNode } from "lucide";
import { el, setChildren } from "redom";
import {
  AnchoredPopoverController,
  type AnchoredPopoverTrigger,
} from "./AnchoredPopoverController";
import { createButton, type Button } from "./Button";
import type { ReDomLike } from "./ReDomLike";
import { renderIcon } from "./renderIcon";
import { createIconButton, type IconButton } from "./SquareIconButton";

export interface DropdownMenuItem {
  type?: "item";
  id: string;
  label: string;
  icon: IconNode;
  danger?: boolean;
  disabled?: boolean;
}

export interface DropdownMenuRow {
  type: "row";
  items: DropdownMenuItem[];
  label?: string;
}

export interface DropdownMenuSeparator {
  type: "separator";
}

export type DropdownMenuEntry =
  | DropdownMenuItem
  | DropdownMenuRow
  | DropdownMenuSeparator;

export interface DropdownMenuOptions {
  triggerKind: "icon-button" | "button";
  triggerLabel: string;
  triggerIcon: IconNode | null;
  triggerAttributes?: Record<string, string>;
  menuLabel?: string;
  entries?: DropdownMenuEntry[];
}

type DropdownTriggerButton = IconButton | Button;

class DropdownMenuItemView implements ReDomLike<HTMLButtonElement> {
  readonly el: HTMLButtonElement;
  private clickHandler: (() => void) | null = null;

  constructor(item: DropdownMenuItem) {
    this.el = el(
      "button.ds-dropdown-menu__item",
      {
        type: "button",
        role: "menuitem",
      },
      el("span.ds-dropdown-menu__item-icon", renderIcon(item.icon)),
      el("span.ds-dropdown-menu__item-label", item.label),
    ) as HTMLButtonElement;
    this.el.dataset.menuItemId = item.id;
    this.el.classList.toggle("is-danger", item.danger ?? false);
    this.setDisabled(item.disabled ?? false);
  }

  setDisabled(disabled: boolean): void {
    this.el.disabled = disabled;
  }

  setOnPress(handler: (() => void) | null): void {
    if (this.clickHandler) {
      this.el.removeEventListener("click", this.clickHandler);
      this.clickHandler = null;
    }
    if (!handler) {
      return;
    }
    this.clickHandler = () => handler();
    this.el.addEventListener("click", this.clickHandler);
  }
}

export class DropdownMenu implements ReDomLike<HTMLDivElement> {
  readonly el: HTMLDivElement;
  readonly triggerButton: DropdownTriggerButton;

  private readonly popover: HTMLDivElement;
  private readonly panel: HTMLDivElement;
  private readonly itemViewById = new Map<string, DropdownMenuItemView>();
  private readonly popoverController: AnchoredPopoverController;
  private selectHandler: ((itemId: string) => void) | null = null;
  private isOpen = false;

  constructor(options: DropdownMenuOptions) {
    this.el = el("div.ds-dropdown-menu") as HTMLDivElement;
    const triggerAttributes = {
      "aria-haspopup": "menu",
      "aria-expanded": "false",
      ...options.triggerAttributes,
    };
    this.triggerButton =
      options.triggerKind === "button"
        ? createButton({
            label: options.triggerLabel,
            ...(options.triggerIcon ? { icon: options.triggerIcon } : {}),
            dropdown: true,
            attributes: triggerAttributes,
          })
        : createIconButton({
            className: "ds-dropdown-menu__trigger",
            label: options.triggerLabel,
            icon: options.triggerIcon ?? undefined,
            dropdown: true,
            attributes: triggerAttributes,
          });
    this.panel = el("div.ds-dropdown-menu__panel", {
      role: "menu",
      "aria-label": options.menuLabel ?? "Actions",
    }) as HTMLDivElement;
    this.popover = el(
      "div.ds-dropdown-menu__popover",
      {
        "aria-hidden": "true",
      },
      this.panel,
    ) as HTMLDivElement;
    this.popover.dataset.open = "false";
    this.popover.hidden = true;
    this.popoverController = new AnchoredPopoverController({
      trigger: this.triggerButton as AnchoredPopoverTrigger,
      root: this.el,
      popover: this.popover,
      panel: this.panel,
      closeOnPointerLeave: true,
      onOpenChange: (open) => {
        this.isOpen = open;
      },
    });

    this.triggerButton.setOnPress(() => {
      this.setOpen(!this.isOpen);
    });
    this.el.append(this.triggerButton.el, this.popover);

    if (options.entries) {
      this.setEntries(options.entries);
    }
  }

  setOpen(open: boolean): void {
    this.popoverController.setOpen(open);
  }

  setEntries(entries: DropdownMenuEntry[]): void {
    this.itemViewById.clear();
    const children: Array<HTMLElement> = [];

    for (const entry of entries) {
      if (entry.type === "separator") {
        const divider = el("div.ds-dropdown-menu__divider", {
          role: "separator",
        }) as HTMLDivElement;
        children.push(divider);
        continue;
      }

      if (entry.type === "row") {
        const row = el("div.ds-dropdown-menu__row") as HTMLDivElement;
        if (entry.label) {
          row.setAttribute("role", "group");
          row.setAttribute("aria-label", entry.label);
        }
        for (const item of entry.items) {
          const itemView = this.createItemView(item);
          row.append(itemView.el);
        }
        children.push(row);
        continue;
      }

      const itemView = this.createItemView(entry);
      children.push(itemView.el);
    }

    setChildren(this.panel, children);
  }

  setItemDisabled(itemId: string, disabled: boolean): void {
    this.itemViewById.get(itemId)?.setDisabled(disabled);
  }

  setOnSelect(handler: ((itemId: string) => void) | null): void {
    this.selectHandler = handler;
    for (const [itemId, itemView] of this.itemViewById) {
      itemView.setOnPress(
        handler
          ? () => {
              handler(itemId);
            }
          : null,
      );
    }
  }

  private createItemView(item: DropdownMenuItem): DropdownMenuItemView {
    const itemView = new DropdownMenuItemView(item);
    this.itemViewById.set(item.id, itemView);
    if (this.selectHandler) {
      itemView.setOnPress(() => {
        this.selectHandler?.(item.id);
      });
    }
    return itemView;
  }
}

export function createDropdownMenu(options: DropdownMenuOptions): DropdownMenu {
  return new DropdownMenu(options);
}
