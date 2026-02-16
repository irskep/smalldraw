import "./ButtonGrid.css";

import { ChevronLeft, ChevronRight, PanelBottomOpen, X } from "lucide";
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
  readonly mobileTriggerButton: SquareIconButton;
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
  mobileLabel?: string;
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
  let currentAnchorIndex = 0;
  let currentOffsetPx = 0;
  let anchorHistory: number[] = [0];

  const listsById = new Map<string, ButtonGridItem[]>();
  let orderedListIds: string[] = [];
  let activeListId = "";

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

  const mobileTriggerButton = createSquareIconButton({
    className: "button-grid-mobile-trigger",
    label: options.mobileLabel ?? "Tools",
    icon: PanelBottomOpen,
    attributes: {
      "aria-label": options.mobileLabel ?? "Open tools",
      title: options.mobileLabel ?? "Open tools",
      layout: "row",
    },
  });
  const mobileCloseButton = createSquareIconButton({
    className: "button-grid-mobile-close",
    label: "Close",
    icon: X,
    attributes: {
      "aria-label": "Close tools",
      title: "Close tools",
      layout: "row",
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
  const mobileHeader = el(
    "div.button-grid-mobile-header",
    el("div.button-grid-mobile-title", options.mobileLabel ?? "Tools"),
    mobileCloseButton.el,
  ) as HTMLDivElement;
  const inlineHost = el("div.button-grid-inline-host") as HTMLDivElement;
  const mobileBody = el("div.button-grid-mobile-body") as HTMLDivElement;
  const mobilePopover = el(
    "div.button-grid-mobile-popover",
    mobileHeader,
    mobileBody,
  ) as HTMLDivElement;

  mount(inlineHost, shell);
  mount(elRoot, inlineHost);
  mount(elRoot, mobileTriggerButton.el);
  mount(elRoot, mobilePopover);

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

  const getViewportRange = (
    horizontal: boolean,
  ): { start: number; end: number } => {
    const rect = viewport.getBoundingClientRect();
    return horizontal
      ? { start: rect.left, end: rect.right }
      : { start: rect.top, end: rect.bottom };
  };

  const setTrackOffset = (offsetPx: number, horizontal: boolean): void => {
    currentOffsetPx = Math.max(0, offsetPx);
    track.style.transform = horizontal
      ? `translateX(${-currentOffsetPx}px)`
      : `translateY(${-currentOffsetPx}px)`;
  };

  const getTrackMainSize = (horizontal: boolean): number =>
    horizontal ? track.scrollWidth : track.scrollHeight;

  const getViewportMainSize = (horizontal: boolean): number =>
    getMainSizeFromRect(viewport.getBoundingClientRect(), horizontal);

  const resetAnchors = (): void => {
    currentAnchorIndex = 0;
    anchorHistory = [0];
  };

  const pushAnchor = (index: number): void => {
    const clamped = Math.max(0, Math.round(index));
    if (anchorHistory[anchorHistory.length - 1] === clamped) {
      return;
    }
    anchorHistory.push(clamped);
  };

  const applyAnchorOffset = (items: ButtonGridItem[]): void => {
    const horizontal = useHorizontalFlow();
    if (!shouldPaginate() || items.length === 0) {
      currentAnchorIndex = 0;
      setTrackOffset(0, horizontal);
      return;
    }

    const containers = getItemContainers();
    if (containers.length === 0) {
      setTrackOffset(0, horizontal);
      return;
    }

    currentAnchorIndex = Math.max(
      0,
      Math.min(currentAnchorIndex, containers.length - 1),
    );

    const targetStart = getItemMainStart(
      containers[currentAnchorIndex],
      horizontal,
    );
    setTrackOffset(Math.max(0, targetStart), horizontal);
  };

  const findLastFullyVisibleIndex = (containers: HTMLDivElement[]): number => {
    const horizontal = useHorizontalFlow();
    const viewportRange = getViewportRange(horizontal);
    let lastFullyVisible = -1;

    for (let index = 0; index < containers.length; index += 1) {
      const rect = containers[index].getBoundingClientRect();
      const start = horizontal ? rect.left : rect.top;
      const end = horizontal ? rect.right : rect.bottom;
      if (
        start >= viewportRange.start - EPSILON &&
        end <= viewportRange.end + EPSILON
      ) {
        lastFullyVisible = index;
      }
    }

    return lastFullyVisible;
  };

  const resolveNextAnchorIndex = (
    containers: HTMLDivElement[],
  ): number | null => {
    if (containers.length === 0) {
      return null;
    }
    const lastFullyVisibleIndex = findLastFullyVisibleIndex(containers);
    if (lastFullyVisibleIndex >= containers.length - 1) {
      return null;
    }
    let nextAnchorIndex =
      lastFullyVisibleIndex >= 0
        ? Math.min(lastFullyVisibleIndex + 1, containers.length - 1)
        : Math.min(currentAnchorIndex + 1, containers.length - 1);

    if (
      nextAnchorIndex === currentAnchorIndex &&
      nextAnchorIndex < containers.length - 1
    ) {
      nextAnchorIndex += 1;
    }
    if (nextAnchorIndex <= currentAnchorIndex) {
      return null;
    }

    const horizontal = useHorizontalFlow();
    const targetStart = getItemMainStart(
      containers[nextAnchorIndex],
      horizontal,
    );
    if (targetStart <= currentOffsetPx + EPSILON) {
      return null;
    }
    return nextAnchorIndex;
  };

  const syncPagerControls = (items: ButtonGridItem[]): void => {
    if (!shouldPaginate() || items.length === 0) {
      prevButton.el.hidden = true;
      nextButton.el.hidden = true;
      return;
    }

    const horizontal = useHorizontalFlow();
    const viewportRange = getViewportRange(horizontal);
    const containers = getItemContainers();
    const hasBefore = containers.some((container) => {
      const rect = container.getBoundingClientRect();
      const end = horizontal ? rect.right : rect.bottom;
      return end < viewportRange.start - EPSILON;
    });
    const nextAnchorIndex = resolveNextAnchorIndex(containers);
    const hasAfter = nextAnchorIndex !== null;
    const hasOverflow = hasBefore || hasAfter;

    if (!hasOverflow) {
      prevButton.el.hidden = true;
      nextButton.el.hidden = true;
      return;
    }

    prevButton.el.hidden = false;
    nextButton.el.hidden = false;
    prevButton.setDisabled(!hasBefore && anchorHistory.length <= 1);
    nextButton.setDisabled(!hasAfter);
  };

  const syncPartialVisibility = (): void => {
    if (!shouldPaginate()) {
      for (const container of getItemContainers()) {
        container.style.visibility = "";
      }
      return;
    }

    const horizontal = useHorizontalFlow();
    const viewportRange = getViewportRange(horizontal);
    for (const container of getItemContainers()) {
      const rect = container.getBoundingClientRect();
      const start = horizontal ? rect.left : rect.top;
      const end = horizontal ? rect.right : rect.bottom;
      const intersects =
        end > viewportRange.start + EPSILON &&
        start < viewportRange.end - EPSILON;
      const fullyVisible =
        start >= viewportRange.start - EPSILON &&
        end <= viewportRange.end + EPSILON;
      container.style.visibility = intersects && !fullyVisible ? "hidden" : "";
    }
  };

  const render = (): void => {
    if (destroyed) {
      return;
    }

    const items = getActiveItems();
    const models = items.map((item) => ({
      id: item.id,
      element: item.element,
    }));
    listView.update(models);

    viewport.style.width = "";
    viewport.style.maxWidth = "";
    viewport.style.height = "";
    viewport.style.maxHeight = "";

    elRoot.dataset.mode = mode;
    mount(inlineHost, shell);
    inlineHost.hidden = false;
    mobileTriggerButton.el.hidden = true;
    mobilePopover.hidden = true;

    applyAnchorOffset(items);
    syncPagerControls(items);
    syncPartialVisibility();

    const horizontal = useHorizontalFlow();
    const viewportMainSize = getViewportMainSize(horizontal);
    const trackMainSize = getTrackMainSize(horizontal);
    if (
      mode === "mobile" &&
      items.length > 1 &&
      (viewportMainSize <= 1 || trackMainSize <= 1) &&
      layoutRetryFrame === 0
    ) {
      layoutRetryFrame = window.requestAnimationFrame(() => {
        layoutRetryFrame = 0;
        render();
      });
    }
  };

  const goToNextPage = (): void => {
    if (!shouldPaginate()) {
      return;
    }

    const items = getActiveItems();
    if (items.length <= 1) {
      return;
    }

    const containers = getItemContainers();
    if (containers.length === 0) {
      return;
    }
    const nextAnchorIndex = resolveNextAnchorIndex(containers);
    if (nextAnchorIndex === null) {
      return;
    }

    currentAnchorIndex = nextAnchorIndex;
    pushAnchor(nextAnchorIndex);
    render();
  };

  const goToPreviousPage = (): void => {
    if (!shouldPaginate()) {
      return;
    }

    if (anchorHistory.length > 1) {
      anchorHistory.pop();
      currentAnchorIndex = anchorHistory[anchorHistory.length - 1] ?? 0;
      render();
      return;
    }

    if (currentAnchorIndex > 0) {
      currentAnchorIndex -= 1;
      anchorHistory = [currentAnchorIndex];
      render();
    }
  };

  const onWindowResize = (): void => {
    const nextMode = resolveAutoMode();
    if (nextMode !== mode) {
      mode = nextMode;
    }
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
    mobileTriggerButton,
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
      resetAnchors();
      render();
    },
    setActiveList(listId: string): void {
      if (!listsById.has(listId)) {
        return;
      }
      activeListId = listId;
      resetAnchors();
      render();
    },
    setMode(nextMode: ButtonGridMode): void {
      if (nextMode === mode) {
        return;
      }
      mode = nextMode;
      resetAnchors();
      render();
    },
    ensureItemVisible(itemId: string): void {
      if (!shouldPaginate()) {
        return;
      }
      const items = getActiveItems();
      const index = items.findIndex((item) => item.id === itemId);
      if (index < 0) {
        return;
      }
      currentAnchorIndex = index;
      anchorHistory = [index];
      render();
    },
    syncLayout(): void {
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
