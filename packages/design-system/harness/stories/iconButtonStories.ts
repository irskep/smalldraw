import { Check, Image as ImageIcon, PaintBucket, Rows2, Shapes } from "lucide";
import { el, mount } from "redom";
import { createIconButton } from "../../src";
import { DEMO_IMAGE_ICON } from "./gridDemo";
import type { HarnessStory } from "./types";

export const iconButtonStories: HarnessStory[] = [
  {
    id: "icon-button",
    title: "Icon Button",
    description:
      "The copied square icon button, adapted in place to a generic design-system icon button API.",
    mount: (container) => {
      const canvas = el("div.ds-story-stack") as HTMLDivElement;
      const defaultsRow = el("div.ds-story-row") as HTMLDivElement;
      const selectionRow = el("div.ds-story-row") as HTMLDivElement;
      const layoutRow = el("div.ds-story-row") as HTMLDivElement;
      const interactionRow = el("div.ds-story-row") as HTMLDivElement;
      const status = el(
        "output.ds-story-output",
        "No clicks yet.",
      ) as HTMLOutputElement;

      const plain = createIconButton({ label: "Fill", icon: PaintBucket });
      const selected = createIconButton({ label: "Checked", icon: Check });
      selected.setPressed(true);
      const disabled = createIconButton({ label: "Disabled", icon: Shapes });
      disabled.setDisabled(true);
      const imageIcon = createIconButton({
        label: "Image",
        icon: { kind: "image", src: DEMO_IMAGE_ICON },
      });

      const radioA = createIconButton({ label: "Option A", icon: Rows2 });
      const radioB = createIconButton({ label: "Option B", icon: Rows2 });
      radioA.setChecked(true);
      radioB.setChecked(false);

      const column = createIconButton({ label: "Column", icon: Shapes });
      const row = createIconButton({ label: "Row", icon: Shapes });
      row.setLayout("row");

      const interactive = createIconButton({
        label: "Click Me",
        icon: ImageIcon,
      });
      interactive.setOnPress(() => {
        status.value = "Button clicked.";
        status.textContent = status.value;
      });
      interactive.setAriaExpanded(false);

      mount(defaultsRow, plain);
      mount(defaultsRow, selected);
      mount(defaultsRow, disabled);
      mount(defaultsRow, imageIcon);

      mount(selectionRow, radioA);
      mount(selectionRow, radioB);

      mount(layoutRow, column);
      mount(layoutRow, row);

      mount(interactionRow, interactive);
      interactionRow.append(status);

      canvas.append(
        el("h2.ds-story-heading", "States"),
        defaultsRow,
        el("h2.ds-story-heading", "Radio semantics"),
        selectionRow,
        el("h2.ds-story-heading", "Layout"),
        layoutRow,
        el("h2.ds-story-heading", "Interaction"),
        interactionRow,
      );

      container.replaceChildren(canvas);
    },
  },
];
