import {
  Download,
  FilePlus,
  FolderOpen,
  MoreHorizontal,
  Redo2,
  Share2,
  Trash2,
  Undo2,
} from "lucide";
import { el } from "redom";
import { createDropdownMenu, type DropdownMenuEntry } from "../../src";
import type { HarnessStory } from "./types";

const MOBILE_ACTIONS_MENU_ENTRIES: DropdownMenuEntry[] = [
  {
    type: "row",
    label: "History",
    items: [
      { id: "undo", label: "Undo", icon: Undo2 },
      { id: "redo", label: "Redo", icon: Redo2, disabled: true },
    ],
  },
  { type: "separator" },
  { id: "new-drawing", label: "New Drawing", icon: FilePlus },
  { id: "browse", label: "Browse Drawings", icon: FolderOpen },
  { id: "export", label: "Export PNG", icon: Download },
  { id: "share", label: "Share", icon: Share2 },
  { type: "separator" },
  { id: "clear", label: "Clear Canvas", icon: Trash2, danger: true },
];

export const menuStories: HarnessStory[] = [
  {
    id: "dropdown-menu",
    title: "Dropdown Menu",
    description:
      "Port of the mobile actions dropdown used in splat's portrait layout, reproduced as a standalone menu component.",
    mount: (container) => {
      const canvas = el("div.ds-story-stack") as HTMLDivElement;
      const status = el(
        "output.ds-story-output",
        "No action selected yet.",
      ) as HTMLOutputElement;
      const row = el("div.ds-story-row") as HTMLDivElement;
      const menu = createDropdownMenu({
        triggerKind: "icon-button",
        triggerLabel: "Actions",
        triggerIcon: MoreHorizontal,
        menuLabel: "Actions",
        entries: MOBILE_ACTIONS_MENU_ENTRIES,
      });

      menu.setOnSelect((itemId) => {
        status.value = `Selected: ${itemId}`;
        status.textContent = status.value;
        menu.setOpen(false);
      });

      const openButton = el(
        "button",
        { type: "button" },
        "Open menu",
      ) as HTMLButtonElement;
      openButton.addEventListener("click", () => menu.setOpen(true));

      const closeButton = el(
        "button",
        { type: "button" },
        "Close menu",
      ) as HTMLButtonElement;
      closeButton.addEventListener("click", () => menu.setOpen(false));

      row.append(menu.el, openButton, closeButton);
      canvas.append(row, status);
      container.replaceChildren(canvas);
    },
  },
];
