import { el, mount } from "redom";

const DEBUG_SHOW_DIRTY_RECT_LAYER = false;

export interface KidsDrawStage {
  readonly element: HTMLDivElement;
  readonly viewportHost: HTMLDivElement;
  readonly insetTopSlot: HTMLDivElement;
  readonly insetRightSlot: HTMLDivElement;
  readonly insetBottomSlot: HTMLDivElement;
  readonly insetLeftSlot: HTMLDivElement;
  readonly canvasFrame: HTMLDivElement;
  readonly sceneRoot: HTMLDivElement;
  readonly tileLayer: HTMLDivElement;
  readonly hotCanvas: HTMLCanvasElement;
  readonly overlay: HTMLDivElement;
  readonly dirtyRectOverlay: SVGSVGElement | null;
  readonly dirtyRectShape: SVGRectElement | null;
  setSceneDimensions(width: number, height: number): void;
}

export function createKidsDrawStage(options: {
  width: number;
  height: number;
  backgroundColor: string;
}): KidsDrawStage {
  const { width, height, backgroundColor } = options;

  const element = el("div.kids-draw-viewport") as HTMLDivElement;
  const insetUi = el("div.kids-draw-inset-ui") as HTMLDivElement;
  const insetTopSlot = el(
    "div.kids-draw-inset-slot.kids-draw-inset-slot-top",
  ) as HTMLDivElement;
  const insetRightSlot = el(
    "div.kids-draw-inset-slot.kids-draw-inset-slot-right",
  ) as HTMLDivElement;
  const insetBottomSlot = el(
    "div.kids-draw-inset-slot.kids-draw-inset-slot-bottom",
  ) as HTMLDivElement;
  const insetLeftSlot = el(
    "div.kids-draw-inset-slot.kids-draw-inset-slot-left",
  ) as HTMLDivElement;

  const canvasFrame = el("div.kids-draw-frame") as HTMLDivElement;
  canvasFrame.style.backgroundColor = backgroundColor;

  const sceneRoot = el("div.kids-draw-scene") as HTMLDivElement;

  const tileLayer = el("div.kids-draw-layer.kids-draw-tiles") as HTMLDivElement;

  const hotCanvas = el(
    "canvas.kids-draw-layer.kids-draw-hot",
  ) as HTMLCanvasElement;

  const dirtyRectOverlay = DEBUG_SHOW_DIRTY_RECT_LAYER
    ? document.createElementNS("http://www.w3.org/2000/svg", "svg")
    : null;
  if (dirtyRectOverlay) {
    dirtyRectOverlay.setAttribute(
      "class",
      "kids-draw-layer kids-draw-dirty-rect",
    );
    dirtyRectOverlay.style.visibility = "hidden";
  }

  const dirtyRectShape =
    dirtyRectOverlay && DEBUG_SHOW_DIRTY_RECT_LAYER
      ? document.createElementNS("http://www.w3.org/2000/svg", "rect")
      : null;
  if (dirtyRectOverlay && dirtyRectShape) {
    dirtyRectShape.setAttribute("fill", "none");
    dirtyRectShape.setAttribute("stroke", "#ef4444");
    dirtyRectShape.setAttribute("stroke-width", "1");
    dirtyRectShape.setAttribute("stroke-dasharray", "6 4");
    dirtyRectOverlay.appendChild(dirtyRectShape);
  }

  const overlay = el("div.kids-draw-layer.kids-draw-overlay") as HTMLDivElement;

  const setSceneDimensions = (nextWidth: number, nextHeight: number): void => {
    canvasFrame.style.width = `${nextWidth}px`;
    canvasFrame.style.height = `${nextHeight}px`;
    sceneRoot.style.width = `${nextWidth}px`;
    sceneRoot.style.height = `${nextHeight}px`;
    hotCanvas.style.width = `${nextWidth}px`;
    hotCanvas.style.height = `${nextHeight}px`;
    if (dirtyRectOverlay) {
      dirtyRectOverlay.style.width = `${nextWidth}px`;
      dirtyRectOverlay.style.height = `${nextHeight}px`;
      dirtyRectOverlay.setAttribute("width", `${nextWidth}`);
      dirtyRectOverlay.setAttribute("height", `${nextHeight}`);
      dirtyRectOverlay.setAttribute(
        "viewBox",
        `0 0 ${nextWidth} ${nextHeight}`,
      );
    }
  };

  setSceneDimensions(width, height);
  mount(sceneRoot, tileLayer);
  mount(sceneRoot, hotCanvas);
  if (dirtyRectOverlay) {
    mount(sceneRoot, dirtyRectOverlay);
  }
  mount(sceneRoot, overlay);
  mount(canvasFrame, sceneRoot);
  mount(insetUi, insetTopSlot);
  mount(insetUi, insetRightSlot);
  mount(insetUi, insetBottomSlot);
  mount(insetUi, insetLeftSlot);
  mount(element, canvasFrame);
  mount(element, insetUi);

  return {
    element,
    viewportHost: element,
    insetTopSlot,
    insetRightSlot,
    insetBottomSlot,
    insetLeftSlot,
    canvasFrame,
    sceneRoot,
    tileLayer,
    hotCanvas,
    overlay,
    dirtyRectOverlay,
    dirtyRectShape,
    setSceneDimensions,
  };
}
