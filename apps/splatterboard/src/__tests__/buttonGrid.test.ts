import { describe, expect, test } from "bun:test";
import { atom } from "nanostores";
import { createButtonGrid } from "../view/ButtonGrid";

function createItems(
  count: number,
): Array<{ id: string; element: HTMLElement }> {
  return Array.from({ length: count }, (_, index) => {
    const element = document.createElement("button");
    element.type = "button";
    element.textContent = `item-${index}`;
    return { id: `item-${index}`, element };
  });
}

function makeRect(input: {
  left?: number;
  top?: number;
  width: number;
  height: number;
}): DOMRect {
  const left = input.left ?? 0;
  const top = input.top ?? 0;
  const width = input.width;
  const height = input.height;
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON() {
      return {};
    },
  } as DOMRect;
}

function mockGridRects(root: HTMLElement): void {
  const track = root.querySelector(".button-grid-track") as HTMLElement | null;
  const viewport = root.querySelector(
    ".button-grid-viewport",
  ) as HTMLElement | null;
  const itemContainers = Array.from(
    root.querySelectorAll(".button-grid-item"),
  ) as HTMLElement[];

  if (!track || !viewport) {
    throw new Error("Missing track/viewport for grid test");
  }

  track.getBoundingClientRect = () =>
    makeRect({
      width: Math.max(100, itemContainers.length * 45 + 40),
      height: 60,
    });
  viewport.getBoundingClientRect = () => makeRect({ width: 100, height: 60 });
  for (const [index, container] of itemContainers.entries()) {
    container.getBoundingClientRect = () =>
      makeRect({
        left: index * 45,
        width: 40,
        height: 40,
      });
  }
}

describe("ButtonGrid", () => {
  test("paginates and updates nav controls for medium mode", () => {
    const grid = createButtonGrid({ orientation: "horizontal" });
    document.body.appendChild(grid.el);
    grid.setMode("medium");
    grid.setLists([{ id: "main", items: createItems(5) }]);
    mockGridRects(grid.el);
    grid.syncLayout();

    expect(grid.prevButton.el.hidden).toBeFalse();
    expect(grid.nextButton.el.hidden).toBeFalse();
    expect(grid.prevButton.el.disabled).toBeTrue();
    expect(grid.nextButton.el.disabled).toBeFalse();

    grid.nextButton.el.click();

    expect(grid.prevButton.el.disabled).toBeFalse();
    expect(grid.nextButton.el.disabled).toBeFalse();

    grid.destroy();
    grid.el.remove();
  });

  test("ensureItemVisible navigates to target item page", () => {
    const grid = createButtonGrid({ orientation: "horizontal" });
    document.body.appendChild(grid.el);
    grid.setMode("medium");
    grid.setLists([{ id: "main", items: createItems(5) }]);
    mockGridRects(grid.el);
    grid.syncLayout();

    grid.ensureItemVisible("item-4");

    expect(grid.prevButton.el.disabled).toBeFalse();
    expect(grid.nextButton.el.disabled).toBeTrue();

    grid.destroy();
    grid.el.remove();
  });

  test("bindSelection follows store updates and unbind stops updates", () => {
    const grid = createButtonGrid({ orientation: "horizontal" });
    document.body.appendChild(grid.el);
    grid.setMode("medium");
    grid.setLists([{ id: "main", items: createItems(5) }]);
    mockGridRects(grid.el);
    grid.syncLayout();

    const selectedItem = atom("item-0");
    const unbind = grid.bindSelection(selectedItem);

    selectedItem.set("item-3");
    expect(grid.prevButton.el.disabled).toBeFalse();
    expect(grid.nextButton.el.disabled).toBeFalse();

    unbind();
    selectedItem.set("item-0");
    expect(grid.prevButton.el.disabled).toBeFalse();

    grid.destroy();
    grid.el.remove();
  });
});
