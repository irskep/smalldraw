import { AlertTriangle, Check, Trash2, Zap } from "lucide";
import { el, mount } from "redom";
import { createButton, createSyncIndicator } from "../../src";
import type { HarnessStory } from "./types";

export const buttonStories: HarnessStory[] = [
  {
    id: "button",
    title: "Button",
    description:
      "Text button with tone variants (neutral, primary, danger) and optional leading icon.",
    mount: (container) => {
      const canvas = el("div.ds-story-stack") as HTMLDivElement;
      const status = el(
        "output.ds-story-output",
        "No clicks yet.",
      ) as HTMLOutputElement;

      const tonesRow = el("div.ds-story-row") as HTMLDivElement;
      const neutral = createButton({ label: "Cancel" });
      const primary = createButton({ label: "Save", tone: "primary" });
      const danger = createButton({ label: "Delete", tone: "danger" });
      mount(tonesRow, neutral);
      mount(tonesRow, primary);
      mount(tonesRow, danger);

      const iconsRow = el("div.ds-story-row") as HTMLDivElement;
      const withIcon = createButton({
        label: "Delete",
        tone: "danger",
        icon: Trash2,
      });
      const withIconPrimary = createButton({
        label: "Check",
        tone: "primary",
        icon: Check,
      });
      const withIconNeutral = createButton({
        label: "Warning",
        icon: AlertTriangle,
      });
      mount(iconsRow, withIcon);
      mount(iconsRow, withIconPrimary);
      mount(iconsRow, withIconNeutral);

      const disabledRow = el("div.ds-story-row") as HTMLDivElement;
      const disabledNeutral = createButton({ label: "Disabled" });
      disabledNeutral.setDisabled(true);
      const disabledPrimary = createButton({
        label: "Disabled",
        tone: "primary",
      });
      disabledPrimary.setDisabled(true);
      mount(disabledRow, disabledNeutral);
      mount(disabledRow, disabledPrimary);

      const interactionRow = el("div.ds-story-row") as HTMLDivElement;
      const clickMe = createButton({
        label: "Click Me",
        tone: "primary",
        icon: Zap,
      });
      clickMe.setOnPress(() => {
        status.value = "Button clicked.";
        status.textContent = status.value;
      });
      mount(interactionRow, clickMe);
      interactionRow.append(status);

      canvas.append(
        el("h2.ds-story-heading", "Tones"),
        tonesRow,
        el("h2.ds-story-heading", "With icons"),
        iconsRow,
        el("h2.ds-story-heading", "Disabled"),
        disabledRow,
        el("h2.ds-story-heading", "Interaction"),
        interactionRow,
      );

      container.replaceChildren(canvas);
    },
  },
  {
    id: "sync-indicator",
    title: "Sync Indicator",
    description:
      "Compact sync status text with hidden unknown state and a secondary tone by default.",
    mount: (container) => {
      const canvas = el("div.ds-story-stack") as HTMLDivElement;
      const hiddenIndicator = createSyncIndicator({ state: "unknown" });
      const localOnlyIndicator = createSyncIndicator({ state: "local-only" });
      const offlineIndicator = createSyncIndicator({
        state: "synced-to-server-but-offline",
      });
      const errorIndicator = createSyncIndicator({
        state: "error",
        description:
          "Sync is taking longer than expected. Changes may not be reaching the server.",
      });
      const onlineIndicator = createSyncIndicator({ state: "online" });

      const states = [
        ["Unknown", hiddenIndicator],
        ["Local only", localOnlyIndicator],
        ["Saved to server, offline", offlineIndicator],
        ["Sync issue", errorIndicator],
        ["Online", onlineIndicator],
      ] as const;

      for (const [label, indicator] of states) {
        const row = el(
          "div.ds-story-row",
          el("strong", label),
          indicator,
        ) as HTMLDivElement;
        if (indicator.el.hidden) {
          row.append(el("span", "(hidden)"));
        }
        canvas.append(row);
      }

      container.replaceChildren(canvas);
    },
  },
];
