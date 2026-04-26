import {
  Check,
  Circle,
  Heart,
  PaintBucket,
  Pencil,
  Rows2,
  Shapes,
  Square,
  Star,
  Triangle,
  Zap,
} from "lucide";
import { createIconButton, type IconButton, PagedButtonGrid } from "../../src";

export interface DemoGridItem {
  id: string;
  label: string;
  icon: NonNullable<Parameters<typeof createIconButton>[0]["icon"]>;
}

export const DEMO_IMAGE_ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect x='2' y='2' width='20' height='20' rx='5' fill='%23e2e8f0'/%3E%3Ccircle cx='12' cy='12' r='5' fill='%233b82f6'/%3E%3C/svg%3E";

export const GRID_ITEMS: DemoGridItem[] = [
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
  {
    id: "image",
    label: "Image",
    icon: { kind: "image", src: DEMO_IMAGE_ICON },
  },
  { id: "rows", label: "Rows", icon: Rows2 },
];

export function buildGridDemo(options: {
  items?: DemoGridItem[];
  mode?: "large" | "medium" | "mobile";
  orientation?: "horizontal" | "vertical";
  largeLayout?: "two-row" | "two-row-xlarge";
  paginateInLarge?: boolean;
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
    if (!next.find((item) => item.id === activeItemId) && next.length > 0) {
      setActive(next[0].id);
      return;
    }
    syncSelection();
  };

  return { grid, itemButtons, activeItemId, setActive, setItems };
}
