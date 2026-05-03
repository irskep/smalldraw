import { Zap } from "lucide";
import { el } from "redom";
import { buildGridDemo, GRID_ITEMS } from "./gridDemo";
import type { HarnessStory } from "./types";

export const gridStories: HarnessStory[] = [
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

      const jumpFirst = el(
        "button",
        { type: "button" },
        "First",
      ) as HTMLButtonElement;
      const jumpLast = el(
        "button",
        { type: "button" },
        "Last",
      ) as HTMLButtonElement;
      const jumpMiddle = el(
        "button",
        { type: "button" },
        "Middle",
      ) as HTMLButtonElement;
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
      frame.style.width = "min(100%, var(--height-frame-md))";
      const status = el(
        "output.ds-story-output",
        "Mode: mobile",
      ) as HTMLOutputElement;
      const { grid } = buildGridDemo({ mode: "mobile" });

      const modes = ["mobile", "medium", "large"] as const;
      const modeRow = el("div.ds-story-row") as HTMLDivElement;
      for (const mode of modes) {
        const btn = el(
          "button",
          { type: "button", "data-mode": mode },
          mode,
        ) as HTMLButtonElement;
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
      grid.el.style.height = "var(--width-frame-sm)";

      const jumpLast = el(
        "button",
        { type: "button" },
        "Jump to last",
      ) as HTMLButtonElement;
      jumpLast.addEventListener("click", () => {
        setActive(GRID_ITEMS[GRID_ITEMS.length - 1].id);
      });

      canvas.append(el("div.ds-story-row", jumpLast), grid.el);
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
      const status = el(
        "output.ds-story-output",
        `Items: ${GRID_ITEMS.length}`,
      ) as HTMLOutputElement;

      const { grid, setItems } = buildGridDemo({ mode: "mobile" });
      let currentItems = [...GRID_ITEMS];

      const addBtn = el(
        "button",
        { type: "button" },
        "Add item",
      ) as HTMLButtonElement;
      const removeBtn = el(
        "button",
        { type: "button" },
        "Remove last",
      ) as HTMLButtonElement;
      const resetBtn = el(
        "button",
        { type: "button" },
        "Reset",
      ) as HTMLButtonElement;

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
      const status = el(
        "output.ds-story-output",
        "Mode: large",
      ) as HTMLOutputElement;
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
      frame.style.width = "min(100%, var(--height-frame-md))";
      const { grid } = buildGridDemo({
        mode: "large",
        largeLayout: "two-row-xlarge",
        paginateInLarge: true,
      });

      frame.append(grid.el);
      canvas.append(el("h2.ds-story-heading", "Grid"), frame);
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
      const status = el(
        "output.ds-story-output",
        "Mode: large",
      ) as HTMLOutputElement;
      const { grid } = buildGridDemo({
        mode: "large",
        orientation: "vertical",
      });

      const applyMode = (mode: "large" | "mobile"): void => {
        grid.el.style.height = mode === "large" ? "" : "var(--width-frame-sm)";
        grid.setMode(mode);
        status.textContent = `Mode: ${mode}`;
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
];
