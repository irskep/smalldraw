import "./DropdownMenu.css";

import { type IconNode } from "lucide";
import { el, setChildren } from "redom";
import { createButton, type Button } from "./Button";
import { DropdownChrome } from "./DropdownChrome";
import type { ReDomLike } from "./ReDomLike";
import { renderIcon } from "./renderIcon";
import { createIconButton, type IconButton } from "./SquareIconButton";
import { Text } from "./Text";

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
      new Text({
        tag: "span",
        text: item.label,
        kind: "label",
        className: "ds-dropdown-menu__item-label",
      }),
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

  private readonly chrome: DropdownChrome;
  private readonly panel: HTMLDivElement;
  private readonly itemViewById = new Map<string, DropdownMenuItemView>();
  private selectHandler: ((itemId: string) => void) | null = null;

  constructor(options: DropdownMenuOptions) {
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
    this.chrome = new DropdownChrome({
      trigger: this.triggerButton,
      className: "ds-dropdown-menu",
      panelClassName: "ds-dropdown-menu__panel",
      panelRole: "menu",
      panelLabel: options.menuLabel ?? "Actions",
      align: "end",
      closeOnPointerLeave: true,
    });
    this.el = this.chrome.el;
    this.panel = this.chrome.panel;

    this.triggerButton.setOnPress(() => {
      this.setOpen(!this.chrome.open);
    });

    if (options.entries) {
      this.setEntries(options.entries);
    }
  }

  setOpen(open: boolean): void {
    this.chrome.setOpen(open);
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
