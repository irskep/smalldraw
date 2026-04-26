import "./DropdownMenu.css";

import { MoreHorizontal, type IconNode } from "lucide";
import { el, setChildren } from "redom";
import type { ReDomLike } from "./ReDomLike";
import { createIconButton, type IconButton } from "./SquareIconButton";
import { renderIcon } from "./renderIcon";

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
  triggerLabel?: string;
  triggerIcon?: IconNode;
  triggerAttributes?: Record<string, string>;
  menuLabel?: string;
  entries?: DropdownMenuEntry[];
}

function isDropdownMenuItem(entry: DropdownMenuEntry): entry is DropdownMenuItem {
  return entry.type === undefined || entry.type === "item";
}

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
  readonly triggerButton: IconButton;

  private readonly popover: HTMLDivElement;
  private readonly panel: HTMLDivElement;
  private readonly itemViewById = new Map<string, DropdownMenuItemView>();
  private selectHandler: ((itemId: string) => void) | null = null;
  private isOpen = false;
  private readonly documentPointerDownHandler: (event: PointerEvent) => void;

  constructor(options: DropdownMenuOptions = {}) {
    this.el = el("div.ds-dropdown-menu") as HTMLDivElement;
    this.triggerButton = createIconButton({
      className: "ds-dropdown-menu__trigger",
      label: options.triggerLabel ?? "Actions",
      icon: options.triggerIcon ?? MoreHorizontal,
      attributes: {
        "aria-haspopup": "menu",
        "aria-expanded": "false",
        ...options.triggerAttributes,
      },
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
    this.documentPointerDownHandler = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (!this.isOpen) {
        return;
      }
      if (this.el.contains(target)) {
        return;
      }
      this.setOpen(false);
    };

    this.triggerButton.setOnPress(() => {
      this.setOpen(!this.isOpen);
    });
    this.el.append(this.triggerButton.el, this.popover);

    if (options.entries) {
      this.setEntries(options.entries);
    }
  }

  setOpen(open: boolean): void {
    if (this.isOpen === open) {
      return;
    }
    this.isOpen = open;
    this.popover.hidden = false;
    this.popover.dataset.open = open ? "true" : "false";
    this.popover.setAttribute("aria-hidden", open ? "false" : "true");
    this.triggerButton.setAriaExpanded(open);
    if (open) {
      document.addEventListener(
        "pointerdown",
        this.documentPointerDownHandler,
        true,
      );
      return;
    }
    document.removeEventListener(
      "pointerdown",
      this.documentPointerDownHandler,
      true,
    );
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
