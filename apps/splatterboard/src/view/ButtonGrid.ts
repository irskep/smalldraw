import "./ButtonGrid.css";

import { ChevronLeft, ChevronRight } from "lucide";
import { el, list, mount, setChildren } from "redom";
import {
  createSquareIconButton,
  type SquareIconButton,
} from "./SquareIconButton";

export type ButtonGridMode = "large" | "medium" | "mobile";
export type ButtonGridOrientation = "horizontal" | "vertical";
export type ButtonGridLargeLayout = "two-row" | "two-row-xlarge";

export interface ButtonGridItem {
  id: string;
  element: HTMLElement;
}

export interface ButtonGridList {
  id: string;
  items: ButtonGridItem[];
}

export interface ButtonGrid {
  readonly el: HTMLDivElement;
  readonly prevButton: SquareIconButton;
  readonly nextButton: SquareIconButton;
  setLists(lists: ButtonGridList[]): void;
  setActiveList(listId: string): void;
  setMode(mode: ButtonGridMode): void;
  ensureItemVisible(itemId: string): void;
  syncLayout(): void;
  destroy(): void;
}

interface ButtonGridOptions {
  className?: string;
  orientation?: ButtonGridOrientation;
  largeLayout?: ButtonGridLargeLayout;
  paginateInLarge?: boolean;
}

interface ButtonGridItemViewModel {
  id: string;
  element: HTMLElement;
}

class ButtonGridItemView {
  readonly el: HTMLDivElement;
  private mountedElement: HTMLElement | null = null;

  constructor() {
    this.el = el("div.button-grid-item") as HTMLDivElement;
  }

  update(item: ButtonGridItemViewModel): void {
    if (this.mountedElement === item.element) {
      return;
    }
    this.mountedElement = item.element;
    setChildren(this.el, [item.element]);
  }
}

const LARGE_MODE_MIN = 1024;
const MOBILE_MODE_MAX = 768;
const SHORT_VIEWPORT_MAX = 540;
const EPSILON = 1.5;

const resolveAutoMode = (): ButtonGridMode => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  if (
    width <= MOBILE_MODE_MAX ||
    (width <= LARGE_MODE_MIN && height <= SHORT_VIEWPORT_MAX)
  ) {
    return "mobile";
  }
  if (width < LARGE_MODE_MIN) {
    return "medium";
  }
  return "large";
};

export function createButtonGrid(options: ButtonGridOptions = {}): ButtonGrid {
  const orientation = options.orientation ?? "horizontal";
  const largeLayout = options.largeLayout ?? "two-row";
  const paginateInLarge = options.paginateInLarge ?? false;
  let mode: ButtonGridMode = resolveAutoMode();
  let destroyed = false;
  let layoutRetryFrame = 0;
  let currentPageIndex = 0;
  let selectedItemId = "";
  let needsPaginationRecalc = true;
  let measuredViewportMainSize = 0;

  const listsById = new Map<string, ButtonGridItem[]>();
  let orderedListIds: string[] = [];
  let activeListId = "";

  let pageItemIndices: number[][] = [[0]];
  let itemPageByIndex: number[] = [];

  const elRoot = el("div.button-grid") as HTMLDivElement;
  if (options.className) {
    for (const className of options.className.split(/\s+/)) {
      if (className) {
        elRoot.classList.add(className);
      }
    }
  }
  elRoot.dataset.orientation = orientation;
  elRoot.dataset.largeLayout = largeLayout;
  elRoot.dataset.mode = mode;
  elRoot.dataset.paginateLarge = paginateInLarge ? "true" : "false";

  const prevButton = createSquareIconButton({
    className: "button-grid-nav button-grid-nav-prev",
    label: "",
    icon: ChevronLeft,
    attributes: {
      "aria-label": "Previous page",
      title: "Previous page",
      "data-button-grid-nav": "prev",
    },
  });
  const nextButton = createSquareIconButton({
    className: "button-grid-nav button-grid-nav-next",
    label: "",
    icon: ChevronRight,
    attributes: {
      "aria-label": "Next page",
      title: "Next page",
      "data-button-grid-nav": "next",
    },
  });

  const track = el("div.button-grid-track") as HTMLDivElement;
  const listView = list(track, ButtonGridItemView, "id");
  const viewport = el("div.button-grid-viewport", track) as HTMLDivElement;
  const shell = el(
    "div.button-grid-shell",
    prevButton.el,
    viewport,
    nextButton.el,
  ) as HTMLDivElement;
  const inlineHost = el("div.button-grid-inline-host") as HTMLDivElement;

  mount(inlineHost, shell);
  mount(elRoot, inlineHost);

  const getActiveItems = (): ButtonGridItem[] => {
    if (!activeListId) {
      return [];
    }
    return listsById.get(activeListId) ?? [];
  };

  const useHorizontalFlow = (): boolean =>
    orientation === "horizontal" || mode === "mobile";

  const shouldPaginate = (): boolean => mode !== "large" || paginateInLarge;

  const getItemContainers = (): HTMLDivElement[] =>
    Array.from(track.children) as HTMLDivElement[];

  const getMainSizeFromRect = (rect: DOMRect, horizontal: boolean): number =>
    horizontal ? rect.width : rect.height;

  const getItemMainStart = (
    itemEl: HTMLElement,
    horizontal: boolean,
  ): number => {
    const trackRect = track.getBoundingClientRect();
    const itemRect = itemEl.getBoundingClientRect();
    return horizontal
      ? itemRect.left - trackRect.left
      : itemRect.top - trackRect.top;
  };

  const getViewportMainSize = (horizontal: boolean): number =>
    getMainSizeFromRect(viewport.getBoundingClientRect(), horizontal);

  const resetPagination = (): void => {
    currentPageIndex = 0;
    pageItemIndices = [[0]];
    itemPageByIndex = [];
    measuredViewportMainSize = 0;
    needsPaginationRecalc = true;
  };

  const clampPageIndex = (): void => {
    const lastPage = Math.max(0, pageItemIndices.length - 1);
    currentPageIndex = Math.max(0, Math.min(currentPageIndex, lastPage));
  };

  const computePagination = (items: ButtonGridItem[]): void => {
    const itemCount = items.length;
    if (itemCount === 0) {
      pageItemIndices = [];
      itemPageByIndex = [];
      currentPageIndex = 0;
      measuredViewportMainSize = 0;
      return;
    }

    if (!shouldPaginate()) {
      pageItemIndices = [Array.from({ length: itemCount }, (_, index) => index)];
      itemPageByIndex = Array.from({ length: itemCount }, () => 0);
      currentPageIndex = 0;
      measuredViewportMainSize = 0;
      return;
    }

    const horizontal = useHorizontalFlow();
    const viewportMainSize = getViewportMainSize(horizontal);
    measuredViewportMainSize = viewportMainSize;
    const containers = getItemContainers();

    if (containers.length !== itemCount || viewportMainSize <= 1) {
      pageItemIndices = [Array.from({ length: itemCount }, (_, index) => index)];
      itemPageByIndex = Array.from({ length: itemCount }, () => 0);
      currentPageIndex = 0;
      measuredViewportMainSize = 0;
      return;
    }

    const starts: number[] = [];
    const ends: number[] = [];
    for (const container of containers) {
      const start = getItemMainStart(container, horizontal);
      const end =
        start + getMainSizeFromRect(container.getBoundingClientRect(), horizontal);
      starts.push(start);
      ends.push(end);
    }

    const pages: number[][] = [];
    const pageByItem: number[] = Array.from({ length: itemCount }, () => 0);

    let cursor = 0;
    while (cursor < itemCount) {
      const pageStart = starts[cursor] ?? 0;
      const pageLimit = pageStart + viewportMainSize + EPSILON;
      let endIndex = cursor;

      while (endIndex + 1 < itemCount) {
        const candidateEnd = ends[endIndex + 1] ?? 0;
        if (candidateEnd <= pageLimit) {
          endIndex += 1;
          continue;
        }
        break;
      }

      if (endIndex < cursor) {
        endIndex = cursor;
      }

      const pageIndex = pages.length;
      const pageItems: number[] = [];
      for (let itemIndex = cursor; itemIndex <= endIndex; itemIndex += 1) {
        pageItems.push(itemIndex);
        pageByItem[itemIndex] = pageIndex;
      }
      pages.push(pageItems);
      cursor = endIndex + 1;
    }

    pageItemIndices = pages.length > 0 ? pages : [Array.from({ length: itemCount }, (_, index) => index)];
    itemPageByIndex = pageByItem;
  };

  const syncSelectedPage = (items: ButtonGridItem[]): void => {
    if (!shouldPaginate() || items.length === 0 || !selectedItemId) {
      clampPageIndex();
      return;
    }

    const selectedIndex = items.findIndex((item) => item.id === selectedItemId);
    if (selectedIndex < 0) {
      clampPageIndex();
      return;
    }

    const selectedPage = itemPageByIndex[selectedIndex];
    if (typeof selectedPage === "number" && Number.isFinite(selectedPage)) {
      currentPageIndex = selectedPage;
    }
    clampPageIndex();
  };

  const syncPagerControls = (items: ButtonGridItem[]): void => {
    if (!shouldPaginate() || items.length === 0 || pageItemIndices.length <= 1) {
      prevButton.el.hidden = true;
      nextButton.el.hidden = true;
      return;
    }

    prevButton.el.hidden = false;
    nextButton.el.hidden = false;
    prevButton.setDisabled(currentPageIndex <= 0);
    nextButton.setDisabled(currentPageIndex >= pageItemIndices.length - 1);
  };

  const render = (): void => {
    if (destroyed) {
      return;
    }

    const items = getActiveItems();
    const allModels = items.map((item) => ({
      id: item.id,
      element: item.element,
    }));

    viewport.style.width = "";
    viewport.style.maxWidth = "";
    viewport.style.height = "";
    viewport.style.maxHeight = "";

    elRoot.dataset.mode = mode;
    mount(inlineHost, shell);
    inlineHost.hidden = false;
    track.style.transform = "";

    if (needsPaginationRecalc) {
      listView.update(allModels);
      computePagination(items);
      syncSelectedPage(items);
      needsPaginationRecalc = false;
    } else {
      clampPageIndex();
    }

    const currentPageItems = pageItemIndices[currentPageIndex] ?? [];
    const visibleModels =
      shouldPaginate() && items.length > 0
        ? currentPageItems
            .map((itemIndex) => allModels[itemIndex])
            .filter((model): model is ButtonGridItemViewModel =>
              Boolean(model),
            )
        : allModels;

    if (shouldPaginate() && measuredViewportMainSize > 1) {
      if (useHorizontalFlow()) {
        viewport.style.width = `${measuredViewportMainSize}px`;
      } else {
        viewport.style.height = `${measuredViewportMainSize}px`;
      }
    }

    listView.update(visibleModels);
    syncPagerControls(items);

    const horizontal = useHorizontalFlow();
    const viewportMainSize = getViewportMainSize(horizontal);
    if (
      shouldPaginate() &&
      mode === "mobile" &&
      items.length > 1 &&
      viewportMainSize <= 1 &&
      layoutRetryFrame === 0
    ) {
      layoutRetryFrame = window.requestAnimationFrame(() => {
        layoutRetryFrame = 0;
        needsPaginationRecalc = true;
        render();
      });
    }
  };

  const goToNextPage = (): void => {
    if (!shouldPaginate()) {
      return;
    }
    if (currentPageIndex >= pageItemIndices.length - 1) {
      return;
    }

    currentPageIndex += 1;
    render();
  };

  const goToPreviousPage = (): void => {
    if (!shouldPaginate()) {
      return;
    }
    if (currentPageIndex <= 0) {
      return;
    }

    currentPageIndex -= 1;
    render();
  };

  const onWindowResize = (): void => {
    const nextMode = resolveAutoMode();
    if (nextMode !== mode) {
      mode = nextMode;
    }
    needsPaginationRecalc = true;
    render();
  };

  prevButton.el.addEventListener("click", goToPreviousPage);
  nextButton.el.addEventListener("click", goToNextPage);
  window.addEventListener("resize", onWindowResize);
  window.visualViewport?.addEventListener("resize", onWindowResize);

  return {
    el: elRoot,
    prevButton,
    nextButton,
    setLists(lists: ButtonGridList[]): void {
      listsById.clear();
      orderedListIds = [];
      for (const listItem of lists) {
        listsById.set(listItem.id, listItem.items);
        orderedListIds.push(listItem.id);
      }
      if (!listsById.has(activeListId)) {
        activeListId = orderedListIds[0] ?? "";
      }
      resetPagination();
      render();
    },
    setActiveList(listId: string): void {
      if (!listsById.has(listId)) {
        return;
      }
      activeListId = listId;
      resetPagination();
      render();
    },
    setMode(nextMode: ButtonGridMode): void {
      if (nextMode === mode) {
        return;
      }
      mode = nextMode;
      resetPagination();
      render();
    },
    ensureItemVisible(itemId: string): void {
      selectedItemId = itemId;
      if (!shouldPaginate()) {
        return;
      }

      const items = getActiveItems();
      const itemIndex = items.findIndex((item) => item.id === itemId);
      if (itemIndex < 0) {
        return;
      }

      if (!needsPaginationRecalc) {
        const resolvedPage = itemPageByIndex[itemIndex];
        if (typeof resolvedPage === "number" && Number.isFinite(resolvedPage)) {
          currentPageIndex = resolvedPage;
        }
      }

      render();
    },
    syncLayout(): void {
      needsPaginationRecalc = true;
      render();
    },
    destroy(): void {
      if (destroyed) {
        return;
      }
      destroyed = true;
      if (layoutRetryFrame !== 0) {
        window.cancelAnimationFrame(layoutRetryFrame);
        layoutRetryFrame = 0;
      }
      window.removeEventListener("resize", onWindowResize);
      window.visualViewport?.removeEventListener("resize", onWindowResize);
    },
  };
}
