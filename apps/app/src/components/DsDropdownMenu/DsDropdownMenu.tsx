import {
  createDropdownMenu,
  type DropdownMenu,
  type DropdownMenuEntry,
} from "@smalldraw/design-system/dropdown-menu";
import { useEffect, useRef } from "react";
import { mount, unmount } from "redom";

export interface DsDropdownMenuProps {
  entries: DropdownMenuEntry[];
  label: string;
  menuLabel?: string;
  onSelect: (itemId: string) => void;
}

export function DsDropdownMenu({
  entries,
  label,
  menuLabel,
  onSelect,
}: DsDropdownMenuProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<DropdownMenu | null>(null);

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }

    const host = hostRef.current;
    const menu = createDropdownMenu({
      triggerKind: "button",
      triggerLabel: label,
      triggerIcon: null,
      menuLabel,
      entries: [],
    });
    mount(host, menu);
    menuRef.current = menu;

    return () => {
      unmount(host, menu);
      menuRef.current = null;
    };
  }, [label, menuLabel]);

  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) {
      return;
    }
    menu.setEntries(entries);
    menu.setOnSelect(onSelect);
  }, [entries, onSelect]);

  return <div ref={hostRef} />;
}
