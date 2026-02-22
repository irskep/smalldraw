import "./ButtonGrid.css";

import { ChevronLeft, ChevronRight } from "lucide";
import type { ReadableAtom } from "nanostores";
import { el, list, mount, setChildren } from "redom";
import type { ReDomLike } from "./ReDomLike";
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

type ButtonGridListView = {
  update(items: ButtonGridItemViewModel[]): void;
};

class ButtonGridItemView
  implements ReDomLike<HTMLDivElement, ButtonGridItemViewModel>
{
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

export class ButtonGrid implements ReDomLike<HTMLDivElement> {
  readonly el: HTMLDivElement;
  private readonly prevButton: SquareIconButton;
  private readonly nextButton: SquareIconButton;

  private readonly orientation: ButtonGridOrientation;
  private readonly largeLayout: ButtonGridLargeLayout;
  private readonly paginateInLarge: boolean;

  private readonly track: HTMLDivElement;
  private readonly viewport: HTMLDivElement;
  private readonly listView: ButtonGridListView;

  private readonly state: ButtonGridState;

  constructor(options: ButtonGridOptions = {}) {
    this.orientation = options.orientation ?? "horizontal";
    this.largeLayout = options.largeLayout ?? "two-row";
    this.paginateInLarge = options.paginateInLarge ?? false;

    this.state = {
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

    this.el = el("div.button-grid") as HTMLDivElement;
    if (options.className) {
      for (const className of options.className.split(/\s+/)) {
        if (className) {
          this.el.classList.add(className);
        }
      }
    }
    this.el.dataset.orientation = this.orientation;
    this.el.dataset.largeLayout = this.largeLayout;
    this.el.dataset.mode = this.state.mode;
    this.el.dataset.paginateLarge = this.paginateInLarge ? "true" : "false";

    this.prevButton = createSquareIconButton({
      className: "button-grid-nav button-grid-nav-prev",
      label: "",
      icon: ChevronLeft,
      attributes: {
        "aria-label": "Previous page",
        title: "Previous page",
        "data-button-grid-nav": "prev",
      },
    });
    this.nextButton = createSquareIconButton({
      className: "button-grid-nav button-grid-nav-next",
      label: "",
      icon: ChevronRight,
      attributes: {
        "aria-label": "Next page",
        title: "Next page",
        "data-button-grid-nav": "next",
      },
    });

    this.track = el("div.button-grid-track") as HTMLDivElement;
    this.listView = list(
      this.track,
      ButtonGridItemView,
      "id",
    ) as ButtonGridListView;
    this.viewport = el(
      "div.button-grid-viewport",
      this.track,
    ) as HTMLDivElement;

    const shell = el(
      "div.button-grid-shell",
      this.prevButton.el,
      this.viewport,
      this.nextButton.el,
    ) as HTMLDivElement;
    const inlineHost = el("div.button-grid-inline-host") as HTMLDivElement;

    mount(inlineHost, shell);
    mount(this.el, inlineHost);

    this.prevButton.setOnPress(() => this.goToPreviousPage());
    this.nextButton.setOnPress(() => this.goToNextPage());
    window.addEventListener("resize", this.onWindowResize);
    window.visualViewport?.addEventListener("resize", this.onWindowResize);
  }

  configureFamilyVariantStrip(options: {
    familyId: string;
    familyLabel: string;
    variantLayout: string;
    includeFamilyNavData: boolean;
  }): void {
    this.el.setAttribute("role", "radiogroup");
    this.el.setAttribute("aria-label", `${options.familyLabel} tools`);
    this.el.setAttribute("data-tool-family-toolbar", options.familyId);
    this.el.setAttribute("data-variant-layout", options.variantLayout);

    if (options.includeFamilyNavData) {
      this.prevButton.el.setAttribute(
        "data-tool-family-prev",
        options.familyId,
      );
      this.nextButton.el.setAttribute(
        "data-tool-family-next",
        options.familyId,
      );
      return;
    }

    this.prevButton.el.removeAttribute("data-tool-family-prev");
    this.nextButton.el.removeAttribute("data-tool-family-next");
  }

  setHidden(hidden: boolean): void {
    this.el.hidden = hidden;
  }

  setLists(lists: ButtonGridList[]): void {
    this.state.listsById.clear();
    this.state.orderedListIds = [];
    for (const listItem of lists) {
      this.state.listsById.set(listItem.id, listItem.items);
      this.state.orderedListIds.push(listItem.id);
    }
    if (!this.state.listsById.has(this.state.activeListId)) {
      this.state.activeListId = this.state.orderedListIds[0] ?? "";
    }
    this.resetPagination();
    this.render();
  }

  setActiveList(listId: string): void {
    if (!this.state.listsById.has(listId)) {
      return;
    }
    this.state.activeListId = listId;
    this.resetPagination();
    this.render();
  }

  setMode(nextMode: ButtonGridMode): void {
    if (nextMode === this.state.mode) {
      return;
    }
    this.state.mode = nextMode;
    this.resetPagination();
    this.render();
  }

  bindSelection(store: ReadableAtom<string>): () => void {
    this.state.selectionUnbind?.();
    this.state.selectionUnbind = null;

    const applySelection = (itemId: string): void => {
      if (itemId) {
        this.ensureVisibleInternal(itemId);
        return;
      }
      this.state.selectedItemId = "";
      this.render();
    };

    applySelection(store.get());

    const unbind = store.subscribe((itemId) => {
      applySelection(itemId ?? "");
    });
    this.state.selectionUnbind = unbind;

    return () => {
      if (this.state.selectionUnbind === unbind) {
        this.state.selectionUnbind = null;
      }
      unbind();
    };
  }

  ensureItemVisible(itemId: string): void {
    this.ensureVisibleInternal(itemId);
  }

  syncLayout(): void {
    this.state.needsPaginationRecalc = true;
    this.render();
  }

  destroy(): void {
    if (this.state.destroyed) {
      return;
    }

    this.state.destroyed = true;

    if (this.state.layoutRetryFrame !== 0) {
      window.cancelAnimationFrame(this.state.layoutRetryFrame);
      this.state.layoutRetryFrame = 0;
    }

    this.state.selectionUnbind?.();
    this.state.selectionUnbind = null;

    this.prevButton.setOnPress(null);
    this.nextButton.setOnPress(null);

    window.removeEventListener("resize", this.onWindowResize);
    window.visualViewport?.removeEventListener("resize", this.onWindowResize);
  }

  private getActiveItems(): ButtonGridItem[] {
    if (!this.state.activeListId) {
      return [];
    }
    return this.state.listsById.get(this.state.activeListId) ?? [];
  }

  private useHorizontalFlow(): boolean {
    return this.orientation === "horizontal" || this.state.mode === "mobile";
  }

  private shouldPaginate(): boolean {
    return this.state.mode !== "large" || this.paginateInLarge;
  }

  private getItemContainers(): HTMLDivElement[] {
    return Array.from(this.track.children) as HTMLDivElement[];
  }

  private getMainSizeFromRect(rect: DOMRect, horizontal: boolean): number {
    return horizontal ? rect.width : rect.height;
  }

  private getItemMainStart(itemEl: HTMLElement, horizontal: boolean): number {
    const trackRect = this.track.getBoundingClientRect();
    const itemRect = itemEl.getBoundingClientRect();
    return horizontal
      ? itemRect.left - trackRect.left
      : itemRect.top - trackRect.top;
  }

  private getViewportMainSize(horizontal: boolean): number {
    return this.getMainSizeFromRect(
      this.viewport.getBoundingClientRect(),
      horizontal,
    );
  }

  private resetPagination(): void {
    this.state.currentPageIndex = 0;
    this.state.pageItemIndices = [[0]];
    this.state.itemPageByIndex = [];
    this.state.measuredViewportMainSize = 0;
    this.state.needsPaginationRecalc = true;
  }

  private clampPageIndex(): void {
    const lastPage = Math.max(0, this.state.pageItemIndices.length - 1);
    this.state.currentPageIndex = Math.max(
      0,
      Math.min(this.state.currentPageIndex, lastPage),
    );
  }

  private computePagination(items: ButtonGridItem[]): void {
    const itemCount = items.length;

    if (itemCount === 0) {
      this.state.pageItemIndices = [];
      this.state.itemPageByIndex = [];
      this.state.currentPageIndex = 0;
      this.state.measuredViewportMainSize = 0;
      return;
    }

    if (!this.shouldPaginate()) {
      this.state.pageItemIndices = [
        Array.from({ length: itemCount }, (_, index) => index),
      ];
      this.state.itemPageByIndex = Array.from({ length: itemCount }, () => 0);
      this.state.currentPageIndex = 0;
      this.state.measuredViewportMainSize = 0;
      return;
    }

    const horizontal = this.useHorizontalFlow();
    const viewportMainSize = this.getViewportMainSize(horizontal);
    this.state.measuredViewportMainSize = viewportMainSize;

    const containers = this.getItemContainers();
    if (containers.length !== itemCount || viewportMainSize <= 1) {
      this.state.pageItemIndices = [
        Array.from({ length: itemCount }, (_, index) => index),
      ];
      this.state.itemPageByIndex = Array.from({ length: itemCount }, () => 0);
      this.state.currentPageIndex = 0;
      this.state.measuredViewportMainSize = 0;
      return;
    }

    const starts: number[] = [];
    const ends: number[] = [];
    for (const container of containers) {
      const start = this.getItemMainStart(container, horizontal);
      const end =
        start +
        this.getMainSizeFromRect(container.getBoundingClientRect(), horizontal);
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

    this.state.pageItemIndices =
      pages.length > 0
        ? pages
        : [Array.from({ length: itemCount }, (_, index) => index)];
    this.state.itemPageByIndex = pageByItem;
  }

  private syncSelectedPage(items: ButtonGridItem[]): void {
    if (
      !this.shouldPaginate() ||
      items.length === 0 ||
      !this.state.selectedItemId
    ) {
      this.clampPageIndex();
      return;
    }

    const selectedIndex = items.findIndex(
      (item) => item.id === this.state.selectedItemId,
    );
    if (selectedIndex < 0) {
      this.clampPageIndex();
      return;
    }

    const selectedPage = this.state.itemPageByIndex[selectedIndex];
    if (typeof selectedPage === "number" && Number.isFinite(selectedPage)) {
      this.state.currentPageIndex = selectedPage;
    }
    this.clampPageIndex();
  }

  private syncPagerControls(items: ButtonGridItem[]): void {
    if (
      !this.shouldPaginate() ||
      items.length === 0 ||
      this.state.pageItemIndices.length <= 1
    ) {
      this.prevButton.el.hidden = true;
      this.nextButton.el.hidden = true;
      return;
    }

    this.prevButton.el.hidden = false;
    this.nextButton.el.hidden = false;
    this.prevButton.setDisabled(this.state.currentPageIndex <= 0);
    this.nextButton.setDisabled(
      this.state.currentPageIndex >= this.state.pageItemIndices.length - 1,
    );
  }

  private render(): void {
    if (this.state.destroyed) {
      return;
    }

    const items = this.getActiveItems();
    const allModels = items.map((item) => ({
      id: item.id,
      element: item.element,
    }));

    this.viewport.style.width = "";
    this.viewport.style.maxWidth = "";
    this.viewport.style.height = "";
    this.viewport.style.maxHeight = "";

    this.el.dataset.mode = this.state.mode;
    this.track.style.transform = "";

    if (this.state.needsPaginationRecalc) {
      this.listView.update(allModels);
      this.computePagination(items);
      this.syncSelectedPage(items);
      this.state.needsPaginationRecalc = false;
    } else {
      this.clampPageIndex();
    }

    const currentPageItems =
      this.state.pageItemIndices[this.state.currentPageIndex] ?? [];
    const visibleModels =
      this.shouldPaginate() && items.length > 0
        ? currentPageItems
            .map((itemIndex) => allModels[itemIndex])
            .filter((model): model is ButtonGridItemViewModel => Boolean(model))
        : allModels;

    if (this.shouldPaginate() && this.state.measuredViewportMainSize > 1) {
      if (this.useHorizontalFlow()) {
        this.viewport.style.width = `${this.state.measuredViewportMainSize}px`;
      } else {
        this.viewport.style.height = `${this.state.measuredViewportMainSize}px`;
      }
    }

    this.listView.update(visibleModels);
    this.syncPagerControls(items);

    const horizontal = this.useHorizontalFlow();
    const viewportMainSize = this.getViewportMainSize(horizontal);
    if (
      this.shouldPaginate() &&
      this.state.mode === "mobile" &&
      items.length > 1 &&
      viewportMainSize <= 1 &&
      this.state.layoutRetryFrame === 0
    ) {
      this.state.layoutRetryFrame = window.requestAnimationFrame(() => {
        this.state.layoutRetryFrame = 0;
        this.state.needsPaginationRecalc = true;
        this.render();
      });
    }
  }

  private goToNextPage(): void {
    if (!this.shouldPaginate()) {
      return;
    }
    if (this.state.currentPageIndex >= this.state.pageItemIndices.length - 1) {
      return;
    }

    this.state.currentPageIndex += 1;
    this.render();
  }

  private goToPreviousPage(): void {
    if (!this.shouldPaginate()) {
      return;
    }
    if (this.state.currentPageIndex <= 0) {
      return;
    }

    this.state.currentPageIndex -= 1;
    this.render();
  }

  private ensureVisibleInternal(itemId: string): void {
    this.state.selectedItemId = itemId;

    if (!this.shouldPaginate()) {
      return;
    }

    const items = this.getActiveItems();
    const itemIndex = items.findIndex((item) => item.id === itemId);
    if (itemIndex < 0) {
      return;
    }

    if (!this.state.needsPaginationRecalc) {
      const resolvedPage = this.state.itemPageByIndex[itemIndex];
      if (typeof resolvedPage === "number" && Number.isFinite(resolvedPage)) {
        this.state.currentPageIndex = resolvedPage;
      }
    }

    this.render();
  }

  private readonly onWindowResize = (): void => {
    const nextMode = resolveAutoMode();
    if (nextMode !== this.state.mode) {
      this.state.mode = nextMode;
    }
    this.state.needsPaginationRecalc = true;
    this.render();
  };
}
