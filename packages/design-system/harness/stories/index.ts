import {
  AlertTriangle,
  Check,
  Circle,
  Heart,
  Image as ImageIcon,
  PaintBucket,
  Pencil,
  Rows2,
  Shapes,
  Square,
  Star,
  Trash2,
  Triangle,
  Zap,
} from "lucide";
import { el, mount } from "redom";
import {
  createButton,
  createIconButton,
  createModalDialogView,
  createShareQrDialog,
  PagedButtonGrid,
  type IconButton,
} from "../../src";

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

const GRID_ITEMS: DemoGridItem[] = [
  { id: "pencil", label: "Pencil", icon: Pencil },
  { id: "fill", label: "Fill", icon: PaintBucket },
  { id: "shapes", label: "Shapes", icon: Shapes },
  { id: "check", label: "Check", icon: Check },
  { id: "star", label: "Star", icon: Star },
  { id: "heart", label: "Heart", icon: Heart },
  { id: "circle", label: "Circle", icon: Circle },
  { id: "square", label: "Square", icon: Square },
  { id: "triangle", label: "Triangle", icon: Triangle },
  { id: "zap", label: "Zap", icon: Zap },
  { id: "image", label: "Image", icon: { kind: "image", src: DEMO_IMAGE_ICON } },
  { id: "rows", label: "Rows", icon: Rows2 },
];

function buildGridDemo(options: {
  items?: DemoGridItem[];
  mode?: "large" | "medium" | "mobile";
  orientation?: "horizontal" | "vertical";
  largeLayout?: "two-row" | "two-row-xlarge";
  paginateInLarge?: boolean;
  frameWidth?: string;
  frameHeight?: string;
}): {
  grid: PagedButtonGrid<DemoGridItem>;
  itemButtons: Map<string, IconButton>;
  activeItemId: string;
  setActive: (id: string) => void;
  setItems: (items: DemoGridItem[]) => void;
} {
  const items = [...(options.items ?? GRID_ITEMS)];
  const itemButtons = new Map<string, IconButton>();
  let activeItemId = items[0]?.id ?? "";

  const grid = new PagedButtonGrid<DemoGridItem>({
    initialMode: options.mode ?? "mobile",
    orientation: options.orientation ?? "horizontal",
    largeLayout: options.largeLayout,
    paginateInLarge: options.paginateInLarge,
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
      const btn = component as IconButton;
      btn.setLabel(item.label);
      btn.setIcon(item.icon);
      btn.setPressed(item.id === activeItemId);
    },
  });

  const syncSelection = (): void => {
    for (const item of items) {
      itemButtons.get(item.id)?.setPressed(item.id === activeItemId);
    }
  };

  grid.setItems(items);
  grid.setActiveItemId(activeItemId);
  syncSelection();

  const setActive = (id: string): void => {
    activeItemId = id;
    grid.setActiveItemId(id);
    syncSelection();
  };

  const setItems = (next: DemoGridItem[]): void => {
    items.length = 0;
    items.push(...next);
    grid.setItems([...next]);
    if (!next.find((i) => i.id === activeItemId) && next.length > 0) {
      setActive(next[0].id);
    } else {
      syncSelection();
    }
  };

  return { grid, itemButtons, activeItemId, setActive, setItems };
}

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
    id: "grid-pagination",
    title: "Grid: Pagination",
    description:
      "Horizontal mobile grid with 12 items. Exercises prev/next navigation, jump-to-item, and page boundary clamping.",
    mount: (container) => {
      const canvas = el("div.ds-story-stack") as HTMLDivElement;
      const frame = el("div.ds-story-frame") as HTMLDivElement;
      const status = el("output.ds-story-output", "") as HTMLOutputElement;
      const { grid, setActive } = buildGridDemo({ mode: "mobile" });

      const jumpFirst = el("button", { type: "button" }, "First") as HTMLButtonElement;
      const jumpLast = el("button", { type: "button" }, "Last") as HTMLButtonElement;
      const jumpMiddle = el("button", { type: "button" }, "Middle") as HTMLButtonElement;
      jumpFirst.addEventListener("click", () => {
        setActive(GRID_ITEMS[0].id);
        status.textContent = `Active: ${GRID_ITEMS[0].label}`;
      });
      jumpLast.addEventListener("click", () => {
        setActive(GRID_ITEMS[GRID_ITEMS.length - 1].id);
        status.textContent = `Active: ${GRID_ITEMS[GRID_ITEMS.length - 1].label}`;
      });
      jumpMiddle.addEventListener("click", () => {
        const mid = GRID_ITEMS[Math.floor(GRID_ITEMS.length / 2)];
        setActive(mid.id);
        status.textContent = `Active: ${mid.label}`;
      });

      frame.append(grid.el);
      canvas.append(
        el("h2.ds-story-heading", "Jump to item"),
        el("div.ds-story-row", jumpFirst, jumpMiddle, jumpLast),
        el("h2.ds-story-heading", "Grid"),
        frame,
        status,
      );
      container.replaceChildren(canvas);
    },
  },
  {
    id: "grid-mode-switching",
    title: "Grid: Mode Switching",
    description:
      "Switch between large (unpaginated two-row), medium, and mobile modes at runtime.",
    mount: (container) => {
      const canvas = el("div.ds-story-stack") as HTMLDivElement;
      const frame = el("div.ds-story-frame") as HTMLDivElement;
      frame.style.width = "min(100%, 36rem)";
      const status = el("output.ds-story-output", "Mode: mobile") as HTMLOutputElement;
      const { grid } = buildGridDemo({ mode: "mobile" });

      const modes = ["mobile", "medium", "large"] as const;
      const modeRow = el("div.ds-story-row") as HTMLDivElement;
      for (const mode of modes) {
        const btn = el("button", { type: "button", "data-mode": mode }, mode) as HTMLButtonElement;
        btn.addEventListener("click", () => {
          grid.setMode(mode);
          status.textContent = `Mode: ${mode}`;
        });
        modeRow.append(btn);
      }

      frame.append(grid.el);
      canvas.append(
        el("h2.ds-story-heading", "Mode"),
        modeRow,
        el("h2.ds-story-heading", "Grid"),
        frame,
        status,
      );
      container.replaceChildren(canvas);
    },
  },
  {
    id: "grid-vertical",
    title: "Grid: Vertical",
    description: "Vertical orientation with pagination along the block axis.",
    mount: (container) => {
      const canvas = el("div.ds-story-stack") as HTMLDivElement;
      const { grid, setActive } = buildGridDemo({
        mode: "mobile",
        orientation: "vertical",
      });
      // The vertical shell needs a height constraint to trigger pagination.
      grid.el.style.height = "24rem";

      const jumpLast = el("button", { type: "button" }, "Jump to last") as HTMLButtonElement;
      jumpLast.addEventListener("click", () => {
        setActive(GRID_ITEMS[GRID_ITEMS.length - 1].id);
      });

      // Force re-layout after mount so pagination can measure.
      requestAnimationFrame(() => grid.syncLayout());

      canvas.append(
        el("div.ds-story-row", jumpLast),
        grid.el,
      );
      container.replaceChildren(canvas);
    },
  },
  {
    id: "grid-dynamic-items",
    title: "Grid: Dynamic Items",
    description:
      "Add and remove items at runtime. The grid re-paginates and clamps the active page.",
    mount: (container) => {
      const canvas = el("div.ds-story-stack") as HTMLDivElement;
      const frame = el("div.ds-story-frame") as HTMLDivElement;
      const status = el("output.ds-story-output", `Items: ${GRID_ITEMS.length}`) as HTMLOutputElement;

      const { grid, setItems } = buildGridDemo({ mode: "mobile" });
      let currentItems = [...GRID_ITEMS];

      const addBtn = el("button", { type: "button" }, "Add item") as HTMLButtonElement;
      const removeBtn = el("button", { type: "button" }, "Remove last") as HTMLButtonElement;
      const resetBtn = el("button", { type: "button" }, "Reset") as HTMLButtonElement;

      let addCounter = 0;
      addBtn.addEventListener("click", () => {
        addCounter += 1;
        currentItems = [
          ...currentItems,
          { id: `added-${addCounter}`, label: `New ${addCounter}`, icon: Zap },
        ];
        setItems(currentItems);
        status.textContent = `Items: ${currentItems.length}`;
      });
      removeBtn.addEventListener("click", () => {
        if (currentItems.length <= 1) return;
        currentItems = currentItems.slice(0, -1);
        setItems(currentItems);
        status.textContent = `Items: ${currentItems.length}`;
      });
      resetBtn.addEventListener("click", () => {
        currentItems = [...GRID_ITEMS];
        setItems(currentItems);
        status.textContent = `Items: ${currentItems.length}`;
      });

      frame.append(grid.el);
      canvas.append(
        el("h2.ds-story-heading", "Controls"),
        el("div.ds-story-row", addBtn, removeBtn, resetBtn),
        el("h2.ds-story-heading", "Grid"),
        frame,
        status,
      );
      container.replaceChildren(canvas);
    },
  },
  {
    id: "grid-two-row",
    title: "Grid: Two-Row",
    description:
      "Large mode with a 2-row grid layout, showing all items without pagination. Switch to medium/mobile to paginate.",
    mount: (container) => {
      const canvas = el("div.ds-story-stack") as HTMLDivElement;
      const frame = el("div.ds-story-frame") as HTMLDivElement;
      const status = el("output.ds-story-output", "Mode: large") as HTMLOutputElement;
      const { grid } = buildGridDemo({ mode: "large", largeLayout: "two-row" });

      const modes = ["large", "medium", "mobile"] as const;
      const modeRow = el("div.ds-story-row") as HTMLDivElement;
      for (const mode of modes) {
        const btn = el("button", { type: "button" }, mode) as HTMLButtonElement;
        btn.addEventListener("click", () => {
          grid.setMode(mode);
          status.textContent = `Mode: ${mode}`;
        });
        modeRow.append(btn);
      }

      frame.append(grid.el);
      canvas.append(
        el("h2.ds-story-heading", "Mode"),
        modeRow,
        el("h2.ds-story-heading", "Grid"),
        frame,
        status,
      );
      container.replaceChildren(canvas);
    },
  },
  {
    id: "grid-two-row-xlarge",
    title: "Grid: Two-Row XLarge",
    description:
      "Large mode with two-row-xlarge layout (doubled cell size). Paginated in large mode to demonstrate stamp-image-style grids.",
    mount: (container) => {
      const canvas = el("div.ds-story-stack") as HTMLDivElement;
      const frame = el("div.ds-story-frame") as HTMLDivElement;
      frame.style.width = "min(100%, 36rem)";
      const { grid } = buildGridDemo({
        mode: "large",
        largeLayout: "two-row-xlarge",
        paginateInLarge: true,
      });

      frame.append(grid.el);
      canvas.append(
        el("h2.ds-story-heading", "Grid"),
        frame,
      );
      container.replaceChildren(canvas);
    },
  },
  {
    id: "grid-vertical-two-col",
    title: "Grid: Vertical Two-Column",
    description:
      "Vertical orientation in large mode showing a 2-column grid. Switch to mobile for single-column paginated.",
    mount: (container) => {
      const canvas = el("div.ds-story-stack") as HTMLDivElement;
      const status = el("output.ds-story-output", "Mode: large") as HTMLOutputElement;
      const { grid } = buildGridDemo({
        mode: "large",
        orientation: "vertical",
      });

      const applyMode = (mode: "large" | "mobile"): void => {
        // Height constraint only needed for vertical pagination
        grid.el.style.height = mode === "large" ? "" : "24rem";
        grid.setMode(mode);
        status.textContent = `Mode: ${mode}`;
        requestAnimationFrame(() => grid.syncLayout());
      };

      const modes = ["large", "mobile"] as const;
      const modeRow = el("div.ds-story-row") as HTMLDivElement;
      for (const mode of modes) {
        const btn = el("button", { type: "button" }, mode) as HTMLButtonElement;
        btn.addEventListener("click", () => applyMode(mode));
        modeRow.append(btn);
      }

      canvas.append(
        el("h2.ds-story-heading", "Mode"),
        modeRow,
        el("h2.ds-story-heading", "Grid"),
        grid.el,
        status,
      );
      container.replaceChildren(canvas);
    },
  },
  {
    id: "button",
    title: "Button",
    description:
      "Text button with tone variants (neutral, primary, danger) and optional leading icon.",
    mount: (container) => {
      const canvas = el("div.ds-story-stack") as HTMLDivElement;
      const status = el("output.ds-story-output", "No clicks yet.") as HTMLOutputElement;

      // Tones
      const tonesRow = el("div.ds-story-row") as HTMLDivElement;
      const neutral = createButton({ label: "Cancel" });
      const primary = createButton({ label: "Save", tone: "primary" });
      const danger = createButton({ label: "Delete", tone: "danger" });
      mount(tonesRow, neutral);
      mount(tonesRow, primary);
      mount(tonesRow, danger);

      // With icons
      const iconsRow = el("div.ds-story-row") as HTMLDivElement;
      const withIcon = createButton({ label: "Delete", tone: "danger", icon: Trash2 });
      const withIconPrimary = createButton({ label: "Check", tone: "primary", icon: Check });
      const withIconNeutral = createButton({ label: "Warning", icon: AlertTriangle });
      mount(iconsRow, withIcon);
      mount(iconsRow, withIconPrimary);
      mount(iconsRow, withIconNeutral);

      // Disabled
      const disabledRow = el("div.ds-story-row") as HTMLDivElement;
      const disabledNeutral = createButton({ label: "Disabled" });
      disabledNeutral.setDisabled(true);
      const disabledPrimary = createButton({ label: "Disabled", tone: "primary" });
      disabledPrimary.setDisabled(true);
      mount(disabledRow, disabledNeutral);
      mount(disabledRow, disabledPrimary);

      // Interaction
      const interactionRow = el("div.ds-story-row") as HTMLDivElement;
      const clickMe = createButton({ label: "Click Me", tone: "primary", icon: Zap });
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
    id: "modal-dialog",
    title: "Modal Dialog",
    description: "Confirm/cancel dialog with optional icon and danger tone.",
    mount: (container) => {
      const canvas = el("div.ds-story-stack") as HTMLDivElement;
      const status = el("output.ds-story-output", "No result yet.") as HTMLOutputElement;
      const dialog = createModalDialogView();

      const openDefault = el("button", { type: "button" }, "Default confirm") as HTMLButtonElement;
      openDefault.addEventListener("click", async () => {
        const result = await dialog.showConfirm({
          title: "Save changes?",
          message: "You have unsaved changes that will be lost.",
          confirmLabel: "Save",
          cancelLabel: "Discard",
        });
        status.textContent = result ? "Confirmed" : "Cancelled";
      });

      const openDanger = el("button", { type: "button" }, "Danger confirm") as HTMLButtonElement;
      openDanger.addEventListener("click", async () => {
        const result = await dialog.showConfirm({
          title: "Delete drawing?",
          message: "This action cannot be undone.",
          confirmLabel: "Delete",
          tone: "danger",
          icon: Trash2,
        });
        status.textContent = result ? "Confirmed (danger)" : "Cancelled (danger)";
      });

      const openIcon = el("button", { type: "button" }, "With icon") as HTMLButtonElement;
      openIcon.addEventListener("click", async () => {
        const result = await dialog.showConfirm({
          title: "Warning",
          message: "Something needs your attention.",
          confirmLabel: "OK",
          icon: AlertTriangle,
        });
        status.textContent = result ? "Confirmed (icon)" : "Cancelled (icon)";
      });

      const controls = el("div.ds-story-row", openDefault, openDanger, openIcon);
      canvas.append(controls, status);
      container.replaceChildren(canvas);
      mount(container, dialog);
    },
  },
  {
    id: "share-qr-dialog",
    title: "Share QR Dialog",
    description: "Dialog showing a QR code and copyable URL for sharing.",
    mount: (container) => {
      const canvas = el("div.ds-story-stack") as HTMLDivElement;
      const status = el("output.ds-story-output", "Dialog not opened yet.") as HTMLOutputElement;
      const dialog = createShareQrDialog();

      // 1px blue dot as a placeholder QR image
      const PLACEHOLDER_QR =
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Crect width='256' height='256' fill='white'/%3E%3Ctext x='128' y='140' text-anchor='middle' font-size='24' fill='%23666'%3EQR placeholder%3C/text%3E%3C/svg%3E";

      const openButton = el("button", { type: "button" }, "Open share dialog") as HTMLButtonElement;
      openButton.addEventListener("click", async () => {
        status.textContent = "Dialog open…";
        await dialog.show({
          joinUrl: "https://example.com/join/abc123",
          qrDataUrl: PLACEHOLDER_QR,
        });
        status.textContent = "Dialog closed.";
      });

      const controls = el("div.ds-story-row", openButton);
      canvas.append(controls, status);
      container.replaceChildren(canvas);
      mount(container, dialog);
    },
  },
];
