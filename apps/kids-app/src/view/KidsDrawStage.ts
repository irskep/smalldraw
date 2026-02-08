import { el, mount } from "redom";

const DEBUG_SHOW_DIRTY_RECT_LAYER = false;

export interface KidsDrawStage {
  readonly element: HTMLDivElement;
  readonly viewportHost: HTMLDivElement;
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

  const element = el("div.kids-draw-viewport", {
    style: {
      position: "relative",
      flex: "1 1 auto",
      "min-height": "0",
      display: "flex",
      "align-items": "center",
      "justify-content": "center",
      overflow: "hidden",
      border: "1px dashed #0891b2",
      background: "#e5e7eb",
      "box-sizing": "border-box",
    },
  }) as HTMLDivElement;

  const canvasFrame = el("div.kids-draw-frame", {
    style: {
      position: "relative",
      width: `${width}px`,
      height: `${height}px`,
      overflow: "hidden",
      background: backgroundColor,
      border: "2px solid #0f766e",
      "box-sizing": "border-box",
      "flex-shrink": "0",
    },
  }) as HTMLDivElement;

  const sceneRoot = el("div.kids-draw-scene", {
    style: {
      position: "absolute",
      left: "0",
      top: "0",
      width: `${width}px`,
      height: `${height}px`,
      transform: "scale(1)",
      "transform-origin": "top left",
    },
  }) as HTMLDivElement;

  const tileLayer = el("div.kids-draw-layer.kids-draw-tiles", {
    style: {
      position: "absolute",
      inset: "0",
      overflow: "hidden",
      outline: "1px dashed #f97316",
      "outline-offset": "-1px",
      "box-sizing": "border-box",
    },
  }) as HTMLDivElement;

  const hotCanvas = el("canvas.kids-draw-layer.kids-draw-hot", {
    style: {
      position: "absolute",
      inset: "0",
      width: `${width}px`,
      height: `${height}px`,
      display: "block",
      "pointer-events": "none",
      outline: "1px dashed #ef4444",
      "outline-offset": "-1px",
    },
  }) as HTMLCanvasElement;

  const dirtyRectOverlay = DEBUG_SHOW_DIRTY_RECT_LAYER
    ? document.createElementNS("http://www.w3.org/2000/svg", "svg")
    : null;
  if (dirtyRectOverlay) {
    dirtyRectOverlay.setAttribute("class", "kids-draw-layer kids-draw-dirty-rect");
    dirtyRectOverlay.style.position = "absolute";
    dirtyRectOverlay.style.inset = "0";
    dirtyRectOverlay.style.pointerEvents = "none";
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

  const overlay = el("div.kids-draw-layer.kids-draw-overlay", {
    style: {
      position: "absolute",
      inset: "0",
      "touch-action": "none",
      cursor: "crosshair",
      outline: "1px dashed #7c3aed",
      "outline-offset": "-1px",
      "box-sizing": "border-box",
    },
  }) as HTMLDivElement;

  const setSceneDimensions = (nextWidth: number, nextHeight: number): void => {
    sceneRoot.style.width = `${nextWidth}px`;
    sceneRoot.style.height = `${nextHeight}px`;
    hotCanvas.style.width = `${nextWidth}px`;
    hotCanvas.style.height = `${nextHeight}px`;
    if (dirtyRectOverlay) {
      dirtyRectOverlay.style.width = `${nextWidth}px`;
      dirtyRectOverlay.style.height = `${nextHeight}px`;
      dirtyRectOverlay.setAttribute("width", `${nextWidth}`);
      dirtyRectOverlay.setAttribute("height", `${nextHeight}`);
      dirtyRectOverlay.setAttribute("viewBox", `0 0 ${nextWidth} ${nextHeight}`);
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
  mount(element, canvasFrame);

  return {
    element,
    viewportHost: element,
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
