import { Check, Image as ImageIcon, PaintBucket, Rows2, Shapes } from "lucide";
import { el, mount } from "redom";
import { createIconButton, PagedButtonGrid, type IconButton } from "../../src";

export interface HarnessStory {
  id: string;
  title: string;
  description: string;
  mount: (container: HTMLElement) => void;
}

interface DemoGridItem {
  id: string;
  label: string;
  icon: NonNullable<Parameters<typeof createIconButton>[0]["icon"]>;
}

const DEMO_IMAGE_ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect x='2' y='2' width='20' height='20' rx='5' fill='%23e2e8f0'/%3E%3Ccircle cx='12' cy='12' r='5' fill='%233b82f6'/%3E%3C/svg%3E";

export const stories: HarnessStory[] = [
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
      const status = el("output.ds-story-output", "No clicks yet.") as HTMLOutputElement;

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

      const interactive = createIconButton({ label: "Click Me", icon: ImageIcon });
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
  {
    id: "paged-button-grid",
    title: "Paged Button Grid",
    description:
      "The copied paged button grid, adapted in place to use direct item selection instead of a store binding.",
    mount: (container) => {
      const canvas = el("div.ds-story-stack") as HTMLDivElement;
      const controls = el("div.ds-story-row") as HTMLDivElement;
      const frame = el("div.ds-story-frame") as HTMLDivElement;
      const items: DemoGridItem[] = [
        { id: "fill", label: "Fill", icon: PaintBucket },
        { id: "shapes", label: "Shapes", icon: Shapes },
        { id: "check", label: "Check", icon: Check },
        { id: "image", label: "Image", icon: { kind: "image", src: DEMO_IMAGE_ICON } },
        { id: "row-a", label: "Row A", icon: Rows2 },
        { id: "row-b", label: "Row B", icon: Rows2 },
        { id: "row-c", label: "Row C", icon: Rows2 },
        { id: "row-d", label: "Row D", icon: Rows2 },
      ];

      const itemButtons = new Map<string, IconButton>();
      let activeItemId = items[0].id;
      let grid: PagedButtonGrid<DemoGridItem>;

      const syncSelection = (): void => {
        for (const item of items) {
          itemButtons.get(item.id)?.setPressed(item.id === activeItemId);
        }
      };

      grid = new PagedButtonGrid({
        initialMode: "mobile",
        orientation: "horizontal",
        createItemComponent: (item) => {
          const button = createIconButton({ label: item.label, icon: item.icon });
          itemButtons.set(item.id, button);
          button.setOnPress(() => {
            activeItemId = item.id;
            grid.setActiveItemId(item.id);
            syncSelection();
          });
          return button;
        },
        updateItemComponent: (component, item) => {
          const button = component as IconButton;
          button.setLabel(item.label);
          button.setIcon(item.icon);
          button.setPressed(item.id === activeItemId);
        },
      });

      grid.setItems([...items]);
      grid.setActiveItemId(activeItemId);
      syncSelection();

      const jumpLast = el(
        "button",
        {
          type: "button",
        },
        "Show Last Item",
      ) as HTMLButtonElement;
      jumpLast.addEventListener("click", () => {
        activeItemId = items[items.length - 1].id;
        grid.setActiveItemId(activeItemId);
        syncSelection();
      });

      const jumpFirst = el(
        "button",
        {
          type: "button",
        },
        "Show First Item",
      ) as HTMLButtonElement;
      jumpFirst.addEventListener("click", () => {
        activeItemId = items[0].id;
        grid.setActiveItemId(activeItemId);
        syncSelection();
      });

      controls.append(jumpFirst, jumpLast);
      frame.append(grid.el);

      canvas.append(
        el("h2.ds-story-heading", "Controls"),
        controls,
        el("h2.ds-story-heading", "Grid"),
        frame,
      );
      container.replaceChildren(canvas);
    },
  },
];
