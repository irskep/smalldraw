import "./ButtonGrid.css";

import { ChevronLeft, ChevronRight } from "lucide";
import type { ReadableAtom } from "nanostores";
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
  bindSelection(store: ReadableAtom<string>): () => void;
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

interface ButtonGridState {
  mode: ButtonGridMode;
  destroyed: boolean;
  layoutRetryFrame: number;
  selectionUnbind: (() => void) | null;
  currentPageIndex: number;
  selectedItemId: string;
  needsPaginationRecalc: boolean;
  measuredViewportMainSize: number;
  listsById: Map<string, ButtonGridItem[]>;
  orderedListIds: string[];
  activeListId: string;
  pageItemIndices: number[][];
  itemPageByIndex: number[];
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
  const state: ButtonGridState = {
    mode: resolveAutoMode(),
    destroyed: false,
    layoutRetryFrame: 0,
    selectionUnbind: null,
    currentPageIndex: 0,
    selectedItemId: "",
    needsPaginationRecalc: true,
    measuredViewportMainSize: 0,
    listsById: new Map<string, ButtonGridItem[]>(),
    orderedListIds: [],
    activeListId: "",
    pageItemIndices: [[0]],
    itemPageByIndex: [],
  };

  const updateState = (updater: (draft: ButtonGridState) => void): void => {
    updater(state);
  };

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
  elRoot.dataset.mode = state.mode;
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
    if (!state.activeListId) {
      return [];
    }
    return state.listsById.get(state.activeListId) ?? [];
  };

  const useHorizontalFlow = (): boolean =>
    orientation === "horizontal" || state.mode === "mobile";

  const shouldPaginate = (): boolean =>
    state.mode !== "large" || paginateInLarge;

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
    updateState((draft) => {
      draft.currentPageIndex = 0;
      draft.pageItemIndices = [[0]];
      draft.itemPageByIndex = [];
      draft.measuredViewportMainSize = 0;
      draft.needsPaginationRecalc = true;
    });
  };

  const clampPageIndex = (): void => {
    const lastPage = Math.max(0, state.pageItemIndices.length - 1);
    updateState((draft) => {
      draft.currentPageIndex = Math.max(
        0,
        Math.min(draft.currentPageIndex, lastPage),
      );
    });
  };

  const computePagination = (items: ButtonGridItem[]): void => {
    const itemCount = items.length;
    if (itemCount === 0) {
      updateState((draft) => {
        draft.pageItemIndices = [];
        draft.itemPageByIndex = [];
        draft.currentPageIndex = 0;
        draft.measuredViewportMainSize = 0;
      });
      return;
    }

    if (!shouldPaginate()) {
      updateState((draft) => {
        draft.pageItemIndices = [
          Array.from({ length: itemCount }, (_, index) => index),
        ];
        draft.itemPageByIndex = Array.from({ length: itemCount }, () => 0);
        draft.currentPageIndex = 0;
        draft.measuredViewportMainSize = 0;
      });
      return;
    }

    const horizontal = useHorizontalFlow();
    const viewportMainSize = getViewportMainSize(horizontal);
    updateState((draft) => {
      draft.measuredViewportMainSize = viewportMainSize;
    });
    const containers = getItemContainers();

    if (containers.length !== itemCount || viewportMainSize <= 1) {
      updateState((draft) => {
        draft.pageItemIndices = [
          Array.from({ length: itemCount }, (_, index) => index),
        ];
        draft.itemPageByIndex = Array.from({ length: itemCount }, () => 0);
        draft.currentPageIndex = 0;
        draft.measuredViewportMainSize = 0;
      });
      return;
    }

    const starts: number[] = [];
    const ends: number[] = [];
    for (const container of containers) {
      const start = getItemMainStart(container, horizontal);
      const end =
        start +
        getMainSizeFromRect(container.getBoundingClientRect(), horizontal);
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

    updateState((draft) => {
      draft.pageItemIndices =
        pages.length > 0
          ? pages
          : [Array.from({ length: itemCount }, (_, index) => index)];
      draft.itemPageByIndex = pageByItem;
    });
  };

  const syncSelectedPage = (items: ButtonGridItem[]): void => {
    if (!shouldPaginate() || items.length === 0 || !state.selectedItemId) {
      clampPageIndex();
      return;
    }

    const selectedIndex = items.findIndex(
      (item) => item.id === state.selectedItemId,
    );
    if (selectedIndex < 0) {
      clampPageIndex();
      return;
    }

    const selectedPage = state.itemPageByIndex[selectedIndex];
    if (typeof selectedPage === "number" && Number.isFinite(selectedPage)) {
      updateState((draft) => {
        draft.currentPageIndex = selectedPage;
      });
    }
    clampPageIndex();
  };

  const syncPagerControls = (items: ButtonGridItem[]): void => {
    if (
      !shouldPaginate() ||
      items.length === 0 ||
      state.pageItemIndices.length <= 1
    ) {
      prevButton.el.hidden = true;
      nextButton.el.hidden = true;
      return;
    }

    prevButton.el.hidden = false;
    nextButton.el.hidden = false;
    prevButton.setDisabled(state.currentPageIndex <= 0);
    nextButton.setDisabled(
      state.currentPageIndex >= state.pageItemIndices.length - 1,
    );
  };

  const render = (): void => {
    if (state.destroyed) {
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

    elRoot.dataset.mode = state.mode;
    // Structure is mounted once during setup; render updates only dynamic state.
    inlineHost.hidden = false;
    track.style.transform = "";

    if (state.needsPaginationRecalc) {
      listView.update(allModels);
      computePagination(items);
      syncSelectedPage(items);
      updateState((draft) => {
        draft.needsPaginationRecalc = false;
      });
    } else {
      clampPageIndex();
    }

    const currentPageItems =
      state.pageItemIndices[state.currentPageIndex] ?? [];
    const visibleModels =
      shouldPaginate() && items.length > 0
        ? currentPageItems
            .map((itemIndex) => allModels[itemIndex])
            .filter((model): model is ButtonGridItemViewModel => Boolean(model))
        : allModels;

    if (shouldPaginate() && state.measuredViewportMainSize > 1) {
      if (useHorizontalFlow()) {
        viewport.style.width = `${state.measuredViewportMainSize}px`;
      } else {
        viewport.style.height = `${state.measuredViewportMainSize}px`;
      }
    }

    listView.update(visibleModels);
    syncPagerControls(items);

    const horizontal = useHorizontalFlow();
    const viewportMainSize = getViewportMainSize(horizontal);
    if (
      shouldPaginate() &&
      state.mode === "mobile" &&
      items.length > 1 &&
      viewportMainSize <= 1 &&
      state.layoutRetryFrame === 0
    ) {
      updateState((draft) => {
        draft.layoutRetryFrame = window.requestAnimationFrame(() => {
          updateState((nextDraft) => {
            nextDraft.layoutRetryFrame = 0;
            nextDraft.needsPaginationRecalc = true;
          });
          render();
        });
      });
    }
  };

  const goToNextPage = (): void => {
    if (!shouldPaginate()) {
      return;
    }
    if (state.currentPageIndex >= state.pageItemIndices.length - 1) {
      return;
    }

    updateState((draft) => {
      draft.currentPageIndex += 1;
    });
    render();
  };

  const goToPreviousPage = (): void => {
    if (!shouldPaginate()) {
      return;
    }
    if (state.currentPageIndex <= 0) {
      return;
    }

    updateState((draft) => {
      draft.currentPageIndex -= 1;
    });
    render();
  };

  const ensureVisibleInternal = (itemId: string): void => {
    updateState((draft) => {
      draft.selectedItemId = itemId;
    });
    if (!shouldPaginate()) {
      return;
    }

    const items = getActiveItems();
    const itemIndex = items.findIndex((item) => item.id === itemId);
    if (itemIndex < 0) {
      return;
    }

    if (!state.needsPaginationRecalc) {
      const resolvedPage = state.itemPageByIndex[itemIndex];
      if (typeof resolvedPage === "number" && Number.isFinite(resolvedPage)) {
        updateState((draft) => {
          draft.currentPageIndex = resolvedPage;
        });
      }
    }

    render();
  };

  const onWindowResize = (): void => {
    const nextMode = resolveAutoMode();
    updateState((draft) => {
      if (nextMode !== draft.mode) {
        draft.mode = nextMode;
      }
      draft.needsPaginationRecalc = true;
    });
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
      updateState((draft) => {
        draft.listsById.clear();
        draft.orderedListIds = [];
        for (const listItem of lists) {
          draft.listsById.set(listItem.id, listItem.items);
          draft.orderedListIds.push(listItem.id);
        }
        if (!draft.listsById.has(draft.activeListId)) {
          draft.activeListId = draft.orderedListIds[0] ?? "";
        }
      });
      resetPagination();
      render();
    },
    setActiveList(listId: string): void {
      if (!state.listsById.has(listId)) {
        return;
      }
      updateState((draft) => {
        draft.activeListId = listId;
      });
      resetPagination();
      render();
    },
    setMode(nextMode: ButtonGridMode): void {
      if (nextMode === state.mode) {
        return;
      }
      updateState((draft) => {
        draft.mode = nextMode;
      });
      resetPagination();
      render();
    },
    bindSelection(store: ReadableAtom<string>): () => void {
      state.selectionUnbind?.();
      updateState((draft) => {
        draft.selectionUnbind = null;
      });

      const applySelection = (itemId: string): void => {
        if (itemId) {
          ensureVisibleInternal(itemId);
          return;
        }
        updateState((draft) => {
          draft.selectedItemId = "";
        });
        render();
      };

      applySelection(store.get());

      const unbind = store.subscribe((itemId) => {
        applySelection(itemId ?? "");
      });
      updateState((draft) => {
        draft.selectionUnbind = unbind;
      });

      return () => {
        if (state.selectionUnbind === unbind) {
          updateState((draft) => {
            draft.selectionUnbind = null;
          });
        }
        unbind();
      };
    },
    ensureItemVisible(itemId: string): void {
      ensureVisibleInternal(itemId);
    },
    syncLayout(): void {
      updateState((draft) => {
        draft.needsPaginationRecalc = true;
      });
      render();
    },
    destroy(): void {
      if (state.destroyed) {
        return;
      }
      updateState((draft) => {
        draft.destroyed = true;
      });
      if (state.layoutRetryFrame !== 0) {
        window.cancelAnimationFrame(state.layoutRetryFrame);
        updateState((draft) => {
          draft.layoutRetryFrame = 0;
        });
      }
      state.selectionUnbind?.();
      updateState((draft) => {
        draft.selectionUnbind = null;
      });
      window.removeEventListener("resize", onWindowResize);
      window.visualViewport?.removeEventListener("resize", onWindowResize);
    },
  };
}
