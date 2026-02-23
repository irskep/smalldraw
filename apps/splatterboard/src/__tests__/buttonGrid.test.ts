import { describe, expect, test } from "bun:test";
import { atom } from "nanostores";
import {
  type ButtonGridItemSpec,
  PagedButtonGrid,
} from "../view/PagedButtonGrid";

function createItems(count: number): ButtonGridItemSpec[] {
  return Array.from({ length: count }, (_, index) => {
    return { id: `item-${index}` };
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

function getPrevButton(root: HTMLElement): HTMLButtonElement {
  const button = root.querySelector(
    '[data-button-grid-nav="prev"]',
  ) as HTMLButtonElement | null;
  if (!button) {
    throw new Error("Missing previous nav button");
  }
  return button;
}

function getNextButton(root: HTMLElement): HTMLButtonElement {
  const button = root.querySelector(
    '[data-button-grid-nav="next"]',
  ) as HTMLButtonElement | null;
  if (!button) {
    throw new Error("Missing next nav button");
  }
  return button;
}

describe("PagedButtonGrid", () => {
  test("paginates and updates nav controls for medium mode", () => {
    const grid = new PagedButtonGrid<ButtonGridItemSpec>({
      orientation: "horizontal",
      createItemComponent: (item) => {
        const element = document.createElement("button");
        element.type = "button";
        element.textContent = item.id;
        return { el: element };
      },
    });
    document.body.appendChild(grid.el);
    grid.setMode("medium");
    grid.setItems(createItems(5));
    mockGridRects(grid.el);
    grid.syncLayout();
    const prevButton = getPrevButton(grid.el);
    const nextButton = getNextButton(grid.el);

    expect(prevButton.hidden).toBeFalse();
    expect(nextButton.hidden).toBeFalse();
    expect(prevButton.disabled).toBeTrue();
    expect(nextButton.disabled).toBeFalse();

    nextButton.click();

    expect(prevButton.disabled).toBeFalse();
    expect(nextButton.disabled).toBeFalse();

    grid.destroy();
    grid.el.remove();
  });

  test("ensureItemVisible navigates to target item page", () => {
    const grid = new PagedButtonGrid<ButtonGridItemSpec>({
      orientation: "horizontal",
      createItemComponent: (item) => {
        const element = document.createElement("button");
        element.type = "button";
        element.textContent = item.id;
        return { el: element };
      },
    });
    document.body.appendChild(grid.el);
    grid.setMode("medium");
    grid.setItems(createItems(5));
    mockGridRects(grid.el);
    grid.syncLayout();
    const prevButton = getPrevButton(grid.el);
    const nextButton = getNextButton(grid.el);

    grid.ensureItemVisible("item-4");

    expect(prevButton.disabled).toBeFalse();
    expect(nextButton.disabled).toBeTrue();

    grid.destroy();
    grid.el.remove();
  });

  test("bindSelection follows store updates and unbind stops updates", () => {
    const grid = new PagedButtonGrid<ButtonGridItemSpec>({
      orientation: "horizontal",
      createItemComponent: (item) => {
        const element = document.createElement("button");
        element.type = "button";
        element.textContent = item.id;
        return { el: element };
      },
    });
    document.body.appendChild(grid.el);
    grid.setMode("medium");
    grid.setItems(createItems(5));
    mockGridRects(grid.el);
    grid.syncLayout();
    const prevButton = getPrevButton(grid.el);
    const nextButton = getNextButton(grid.el);

    const selectedItem = atom("item-0");
    const unbind = grid.bindSelection(selectedItem);

    selectedItem.set("item-3");
    expect(prevButton.disabled).toBeFalse();
    expect(nextButton.disabled).toBeFalse();

    unbind();
    selectedItem.set("item-0");
    expect(prevButton.disabled).toBeFalse();

    grid.destroy();
    grid.el.remove();
  });

  test("pagination only mounts current page items", () => {
    const grid = new PagedButtonGrid<ButtonGridItemSpec>({
      orientation: "horizontal",
      createItemComponent: (item) => {
        const element = document.createElement("button");
        element.type = "button";
        element.textContent = item.id;
        element.setAttribute("data-item-id", item.id);
        return { el: element };
      },
    });
    document.body.appendChild(grid.el);
    grid.setMode("medium");
    grid.setItems(createItems(5));
    mockGridRects(grid.el);
    grid.syncLayout();
    const prevButton = getPrevButton(grid.el);
    const nextButton = getNextButton(grid.el);
    const currentItemIds = () =>
      Array.from(
        grid.el.querySelectorAll(".button-grid-item [data-item-id]"),
      ).map((node) => (node as HTMLElement).getAttribute("data-item-id"));

    expect(currentItemIds()).toEqual(["item-0", "item-1"]);

    expect(prevButton.hidden).toBeFalse();
    expect(nextButton.hidden).toBeFalse();
    expect(prevButton.disabled).toBeTrue();
    expect(nextButton.disabled).toBeFalse();

    nextButton.click();
    expect(currentItemIds()).toEqual(["item-2", "item-3"]);
    expect(prevButton.disabled).toBeFalse();
    expect(nextButton.disabled).toBeFalse();

    nextButton.click();
    expect(currentItemIds()).toEqual(["item-4"]);
    expect(nextButton.disabled).toBeTrue();

    grid.destroy();
    grid.el.remove();
  });
});
