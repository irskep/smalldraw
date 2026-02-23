import "./ButtonGrid.css";

import { ChevronLeft, ChevronRight } from "lucide";
import type { ReadableAtom } from "nanostores";
import { el, mount, setChildren } from "redom";
import type { ReDomLike } from "./ReDomLike";
import {
  createSquareIconButton,
  type SquareIconButton,
} from "./SquareIconButton";

export type PagedButtonGridMode = "large" | "medium" | "mobile";
export type PagedButtonGridOrientation = "horizontal" | "vertical";
export type PagedButtonGridLargeLayout = "two-row" | "two-row-xlarge";

export interface ButtonGridItemSpec {
  id: string;
}

interface PagedButtonGridOptions<TItem extends ButtonGridItemSpec> {
  className?: string;
  orientation?: PagedButtonGridOrientation;
  largeLayout?: PagedButtonGridLargeLayout;
  paginateInLarge?: boolean;
  autoMode?: boolean;
  mobilePortraitHorizontalFlow?: boolean;
  rootAttributes?: Record<string, string>;
  navAttributes?: {
    prev?: Record<string, string>;
    next?: Record<string, string>;
  };
  createItemComponent: (item: TItem) => ReDomLike<HTMLElement | SVGElement>;
  updateItemComponent?: (
    component: ReDomLike<HTMLElement | SVGElement>,
    item: TItem,
  ) => void;
}

interface PagedButtonGridState<TItem extends ButtonGridItemSpec> {
  mode: PagedButtonGridMode;
  destroyed: boolean;
  layoutRetryFrame: number;
  selectionUnbind: (() => void) | null;
  currentPageIndex: number;
  selectedItemId: string;
  needsPaginationRecalc: boolean;
  measuredViewportMainSize: number;
  items: TItem[];
  pageItemIndices: number[][];
  itemPageByIndex: number[];
}

const LARGE_MODE_MIN = 1024;
const MOBILE_MODE_MAX = 768;
const SHORT_VIEWPORT_MAX = 540;
const EPSILON = 1.5;

const resolveAutoMode = (): PagedButtonGridMode => {
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

export class PagedButtonGrid<TItem extends ButtonGridItemSpec>
  implements ReDomLike<HTMLDivElement>
{
  private static autoModeSubscribers = new Set<{
    applyAutoMode: (mode: PagedButtonGridMode) => void;
  }>();
  private static autoModeListenersBound = false;
  private static readonly onWindowResize = (): void => {
    const nextMode = resolveAutoMode();
    for (const grid of PagedButtonGrid.autoModeSubscribers) {
      grid.applyAutoMode(nextMode);
    }
  };

  readonly el: HTMLDivElement;

  private readonly prevButton: SquareIconButton;
  private readonly nextButton: SquareIconButton;

  private readonly orientation: PagedButtonGridOrientation;
  private readonly largeLayout: PagedButtonGridLargeLayout;
  private readonly paginateInLarge: boolean;
  private readonly createItemComponent: (
    item: TItem,
  ) => ReDomLike<HTMLElement | SVGElement>;
  private readonly updateItemComponent?:
    | ((component: ReDomLike<HTMLElement | SVGElement>, item: TItem) => void)
    | undefined;
  private readonly autoMode: boolean;
  private readonly mobilePortraitHorizontalFlow: boolean;

  private readonly track: HTMLDivElement;
  private readonly viewport: HTMLDivElement;
  private readonly itemContainerById = new Map<string, HTMLDivElement>();
  private readonly itemComponentById = new Map<
    string,
    ReDomLike<HTMLElement | SVGElement>
  >();

  private readonly state: PagedButtonGridState<TItem>;

  constructor(options: PagedButtonGridOptions<TItem>) {
    this.orientation = options.orientation ?? "horizontal";
    this.largeLayout = options.largeLayout ?? "two-row";
    this.paginateInLarge = options.paginateInLarge ?? false;
    this.autoMode = options.autoMode ?? true;
    this.mobilePortraitHorizontalFlow =
      options.mobilePortraitHorizontalFlow ?? false;
    this.createItemComponent = options.createItemComponent;
    this.updateItemComponent = options.updateItemComponent;

    this.state = {
      mode: resolveAutoMode(),
      destroyed: false,
      layoutRetryFrame: 0,
      selectionUnbind: null,
      currentPageIndex: 0,
      selectedItemId: "",
      needsPaginationRecalc: true,
      measuredViewportMainSize: 0,
      items: [],
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
    this.el.dataset.resolvedOrientation = this.orientation;
    this.el.dataset.largeLayout = this.largeLayout;
    this.el.dataset.mode = this.state.mode;
    this.el.dataset.paginateLarge = this.paginateInLarge ? "true" : "false";
    this.setElementAttributes(this.el, options.rootAttributes);

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
    this.setElementAttributes(this.prevButton.el, options.navAttributes?.prev);
    this.setElementAttributes(this.nextButton.el, options.navAttributes?.next);

    this.track = el("div.button-grid-track") as HTMLDivElement;
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
    if (this.autoMode) {
      PagedButtonGrid.subscribeAutoMode(this);
    }
  }

  setHidden(hidden: boolean): void {
    this.el.hidden = hidden;
  }

  setItems(items: TItem[]): void {
    this.pruneRemovedItems(items);
    this.state.items = items;
    this.resetPagination();
    this.render();
  }

  setMode(nextMode: PagedButtonGridMode): void {
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
    this.itemComponentById.clear();
    this.itemContainerById.clear();
    if (this.autoMode) {
      PagedButtonGrid.unsubscribeAutoMode(this);
    }
  }

  private setElementAttributes(
    node: HTMLElement,
    attributes?: Record<string, string>,
  ): void {
    if (!attributes) {
      return;
    }
    for (const [key, value] of Object.entries(attributes)) {
      node.setAttribute(key, value);
    }
  }

  private useHorizontalFlow(): boolean {
    if (this.orientation === "horizontal") {
      return true;
    }
    if (!this.mobilePortraitHorizontalFlow || this.state.mode !== "mobile") {
      return false;
    }
    return window.innerHeight > window.innerWidth;
  }

  private shouldPaginate(): boolean {
    return this.state.mode !== "large" || this.paginateInLarge;
  }

  private getItemContainers(): HTMLDivElement[] {
    return Array.from(this.track.children) as HTMLDivElement[];
  }

  private pruneRemovedItems(nextItems: TItem[]): void {
    const nextIds = new Set(nextItems.map((item) => item.id));
    for (const [id] of this.itemComponentById) {
      if (nextIds.has(id)) {
        continue;
      }
      this.itemComponentById.delete(id);
      this.itemContainerById.delete(id);
    }
  }

  private getOrCreateItemContainer(item: TItem): HTMLDivElement {
    let container = this.itemContainerById.get(item.id);
    if (!container) {
      container = el("div.button-grid-item") as HTMLDivElement;
      this.itemContainerById.set(item.id, container);
    }

    let itemComponent = this.itemComponentById.get(item.id);
    if (!itemComponent) {
      itemComponent = this.createItemComponent(item);
      const maybeNode = itemComponent?.el as Node | undefined;
      if (!maybeNode || maybeNode.nodeType !== 1) {
        throw new Error(
          `PagedButtonGrid.createItemComponent must return ReDomLike with Element el for item '${item.id}'`,
        );
      }
      this.itemComponentById.set(item.id, itemComponent);
      setChildren(container, [itemComponent]);
      return container;
    }

    if (container.firstElementChild !== itemComponent.el) {
      setChildren(container, [itemComponent]);
    }
    this.updateItemComponent?.(itemComponent, item);
    return container;
  }

  private renderItems(items: TItem[]): void {
    const containers = items.map((item) => this.getOrCreateItemContainer(item));
    setChildren(this.track, containers);
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

  private computePagination(items: TItem[]): void {
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

  private syncSelectedPage(items: TItem[]): void {
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

  private syncPagerControls(items: TItem[]): void {
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

    const items = this.state.items;

    this.viewport.style.width = "";
    this.viewport.style.maxWidth = "";
    this.viewport.style.height = "";
    this.viewport.style.maxHeight = "";

    this.el.dataset.mode = this.state.mode;
    this.el.dataset.resolvedOrientation = this.useHorizontalFlow()
      ? "horizontal"
      : "vertical";
    this.track.style.transform = "";

    if (this.state.needsPaginationRecalc) {
      this.renderItems(items);
      this.computePagination(items);
      this.syncSelectedPage(items);
      this.state.needsPaginationRecalc = false;
    } else {
      this.clampPageIndex();
    }

    const currentPageItems =
      this.state.pageItemIndices[this.state.currentPageIndex] ?? [];
    const visibleItems =
      this.shouldPaginate() && items.length > 0
        ? currentPageItems
            .map((itemIndex) => items[itemIndex])
            .filter((item): item is TItem => Boolean(item))
        : items;

    if (this.shouldPaginate() && this.state.measuredViewportMainSize > 1) {
      if (this.useHorizontalFlow()) {
        this.viewport.style.width = `${this.state.measuredViewportMainSize}px`;
      } else {
        this.viewport.style.height = `${this.state.measuredViewportMainSize}px`;
      }
    }

    this.renderItems(visibleItems);
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

    const items = this.state.items;
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

  applyAutoMode(nextMode: PagedButtonGridMode): void {
    if (nextMode !== this.state.mode) {
      this.state.mode = nextMode;
    }
    this.state.needsPaginationRecalc = true;
    this.render();
  }

  private static subscribeAutoMode(grid: {
    applyAutoMode: (mode: PagedButtonGridMode) => void;
  }): void {
    PagedButtonGrid.autoModeSubscribers.add(grid);
    if (PagedButtonGrid.autoModeListenersBound) {
      return;
    }
    window.addEventListener("resize", PagedButtonGrid.onWindowResize);
    window.visualViewport?.addEventListener(
      "resize",
      PagedButtonGrid.onWindowResize,
    );
    PagedButtonGrid.autoModeListenersBound = true;
  }

  private static unsubscribeAutoMode(grid: {
    applyAutoMode: (mode: PagedButtonGridMode) => void;
  }): void {
    PagedButtonGrid.autoModeSubscribers.delete(grid);
    if (PagedButtonGrid.autoModeSubscribers.size > 0) {
      return;
    }
    window.removeEventListener("resize", PagedButtonGrid.onWindowResize);
    window.visualViewport?.removeEventListener(
      "resize",
      PagedButtonGrid.onWindowResize,
    );
    PagedButtonGrid.autoModeListenersBound = false;
  }
}
