import "./KidsDrawStage.css";

import { el, mount } from "redom";
import type { StartupPhase } from "../controller/stores/createStartupReadinessStore";
import type { UiIntentStore } from "../controller/stores/createUiIntentStore";
import type { ReDomLike } from "./ReDomLike";

const DEBUG_SHOW_DIRTY_RECT_LAYER = false;

export interface KidsDrawStage extends ReDomLike<HTMLDivElement> {
  readonly element: HTMLDivElement;
  readonly viewportHost: HTMLDivElement;
  readonly canvasFrame: HTMLDivElement;
  readonly sceneRoot: HTMLDivElement;
  readonly tileLayer: HTMLDivElement;
  readonly hotCanvas: HTMLCanvasElement;
  readonly hotOverlayCanvas: HTMLCanvasElement;
  readonly overlay: HTMLDivElement;
  readonly startupOverlay: HTMLDivElement;
  readonly startupOverlayCard: HTMLDivElement;
  readonly startupOverlayTitle: HTMLParagraphElement;
  readonly startupOverlayDetail: HTMLParagraphElement;
  readonly cursorIndicator: HTMLDivElement;
  readonly dirtyRectOverlay: SVGSVGElement | null;
  readonly dirtyRectShape: SVGRectElement | null;
  setSceneDimensions(width: number, height: number): void;
  setInteractionEnabled(enabled: boolean): void;
  setStartupStatus(status: {
    visible: boolean;
    phase: StartupPhase;
    assetsLoaded: number;
    assetsTotal: number;
    assetsFailed: number;
    blockingReason?: string;
  }): void;
  destroy(): void;
}

export class KidsDrawStageView implements KidsDrawStage {
  readonly el: HTMLDivElement;
  readonly element: HTMLDivElement;
  readonly viewportHost: HTMLDivElement;
  readonly canvasFrame: HTMLDivElement;
  readonly sceneRoot: HTMLDivElement;
  readonly tileLayer: HTMLDivElement;
  readonly hotCanvas: HTMLCanvasElement;
  readonly hotOverlayCanvas: HTMLCanvasElement;
  readonly overlay: HTMLDivElement;
  readonly startupOverlay: HTMLDivElement;
  readonly startupOverlayCard: HTMLDivElement;
  readonly startupOverlayTitle: HTMLParagraphElement;
  readonly startupOverlayDetail: HTMLParagraphElement;
  readonly cursorIndicator: HTMLDivElement;
  readonly dirtyRectOverlay: SVGSVGElement | null;
  readonly dirtyRectShape: SVGRectElement | null;

  private pointerDisposers: Array<() => void> = [];

  constructor(options: {
    width: number;
    height: number;
    backgroundColor: string;
    uiIntentStore: Pick<UiIntentStore, "publish">;
  }) {
    const { width, height, backgroundColor, uiIntentStore } = options;

    this.element = el("div.kids-draw-viewport") as HTMLDivElement;
    this.el = this.element;
    this.viewportHost = this.element;

    this.canvasFrame = el("div.kids-draw-frame") as HTMLDivElement;
    this.canvasFrame.style.backgroundColor = backgroundColor;

    this.sceneRoot = el("div.kids-draw-scene") as HTMLDivElement;
    this.tileLayer = el(
      "div.kids-draw-layer.kids-draw-tiles",
    ) as HTMLDivElement;
    this.hotCanvas = el(
      "canvas.kids-draw-layer.kids-draw-hot",
    ) as HTMLCanvasElement;
    this.hotOverlayCanvas = el(
      "canvas.kids-draw-layer.kids-draw-hot-overlay",
    ) as HTMLCanvasElement;

    this.dirtyRectOverlay = DEBUG_SHOW_DIRTY_RECT_LAYER
      ? document.createElementNS("http://www.w3.org/2000/svg", "svg")
      : null;
    if (this.dirtyRectOverlay) {
      this.dirtyRectOverlay.setAttribute(
        "class",
        "kids-draw-layer kids-draw-dirty-rect",
      );
      this.dirtyRectOverlay.style.visibility = "hidden";
    }

    this.dirtyRectShape =
      this.dirtyRectOverlay && DEBUG_SHOW_DIRTY_RECT_LAYER
        ? document.createElementNS("http://www.w3.org/2000/svg", "rect")
        : null;
    if (this.dirtyRectOverlay && this.dirtyRectShape) {
      this.dirtyRectShape.setAttribute("fill", "none");
      this.dirtyRectShape.setAttribute("stroke", "#ef4444");
      this.dirtyRectShape.setAttribute("stroke-width", "1");
      this.dirtyRectShape.setAttribute("stroke-dasharray", "6 4");
      this.dirtyRectOverlay.appendChild(this.dirtyRectShape);
    }

    this.overlay = el(
      "div.kids-draw-layer.kids-draw-overlay",
    ) as HTMLDivElement;
    this.startupOverlay = el(
      "div.kids-draw-layer.kids-draw-startup-overlay",
    ) as HTMLDivElement;
    this.startupOverlayCard = el(
      "div.kids-draw-startup-card",
    ) as HTMLDivElement;
    this.startupOverlayTitle = el(
      "p.kids-draw-startup-title",
      "Loading drawing…",
    ) as HTMLParagraphElement;
    this.startupOverlayDetail = el(
      "p.kids-draw-startup-detail",
      "Preparing the drawing surface.",
    ) as HTMLParagraphElement;
    mount(this.startupOverlayCard, this.startupOverlayTitle);
    mount(this.startupOverlayCard, this.startupOverlayDetail);
    mount(this.startupOverlay, this.startupOverlayCard);
    this.cursorIndicator = el(
      "div.kids-draw-cursor-indicator",
    ) as HTMLDivElement;
    this.cursorIndicator.style.visibility = "hidden";

    this.setSceneDimensions(width, height);
    mount(this.sceneRoot, this.tileLayer);
    mount(this.sceneRoot, this.hotCanvas);
    mount(this.sceneRoot, this.hotOverlayCanvas);
    if (this.dirtyRectOverlay) {
      mount(this.sceneRoot, this.dirtyRectOverlay);
    }
    mount(this.sceneRoot, this.overlay);
    mount(this.sceneRoot, this.startupOverlay);
    mount(this.sceneRoot, this.cursorIndicator);
    mount(this.canvasFrame, this.sceneRoot);
    mount(this.element, this.canvasFrame);

    this.bindPointerIntents(uiIntentStore);
  }

  setSceneDimensions(nextWidth: number, nextHeight: number): void {
    this.canvasFrame.style.width = `${nextWidth}px`;
    this.canvasFrame.style.height = `${nextHeight}px`;
    this.sceneRoot.style.width = `${nextWidth}px`;
    this.sceneRoot.style.height = `${nextHeight}px`;
    this.hotCanvas.style.width = `${nextWidth}px`;
    this.hotCanvas.style.height = `${nextHeight}px`;
    this.hotOverlayCanvas.style.width = `${nextWidth}px`;
    this.hotOverlayCanvas.style.height = `${nextHeight}px`;
    if (this.dirtyRectOverlay) {
      this.dirtyRectOverlay.style.width = `${nextWidth}px`;
      this.dirtyRectOverlay.style.height = `${nextHeight}px`;
      this.dirtyRectOverlay.setAttribute("width", `${nextWidth}`);
      this.dirtyRectOverlay.setAttribute("height", `${nextHeight}`);
      this.dirtyRectOverlay.setAttribute(
        "viewBox",
        `0 0 ${nextWidth} ${nextHeight}`,
      );
    }
  }

  setInteractionEnabled(enabled: boolean): void {
    this.overlay.style.pointerEvents = enabled ? "" : "none";
  }

  setStartupStatus(status: {
    visible: boolean;
    phase: StartupPhase;
    assetsLoaded: number;
    assetsTotal: number;
    assetsFailed: number;
    blockingReason?: string;
  }): void {
    this.startupOverlay.dataset.visible = status.visible ? "true" : "false";
    if (!status.visible) {
      this.startupOverlayTitle.textContent = "";
      this.startupOverlayDetail.textContent = "";
      return;
    }
    const progressText =
      status.assetsTotal > 0
        ? ` (${status.assetsLoaded}/${status.assetsTotal}${
            status.assetsFailed > 0 ? `, ${status.assetsFailed} failed` : ""
          })`
        : "";
    const content = describeStartupStatus(status);
    this.startupOverlayTitle.textContent = `${content.title}${progressText}`;
    this.startupOverlayDetail.textContent = content.detail;
  }

  destroy(): void {
    for (const dispose of this.pointerDisposers) {
      dispose();
    }
    this.pointerDisposers = [];
  }

  private bindPointerIntents(
    uiIntentStore: Pick<UiIntentStore, "publish">,
  ): void {
    const listen = (type: string, handler: (event: Event) => void): void => {
      const listener: EventListener = (event) => handler(event);
      this.overlay.addEventListener(type, listener);
      this.pointerDisposers.push(() =>
        this.overlay.removeEventListener(type, listener),
      );
    };

    listen("pointerdown", (event) => {
      uiIntentStore.publish({
        type: "pointer_down",
        event: event as PointerEvent,
      });
    });
    listen("pointermove", (event) => {
      uiIntentStore.publish({
        type: "pointer_move",
        event: event as PointerEvent,
      });
    });
    listen("pointerrawupdate", (event) => {
      uiIntentStore.publish({
        type: "pointer_rawupdate",
        event: event as PointerEvent,
      });
    });
    listen("pointerenter", (event) => {
      uiIntentStore.publish({
        type: "pointer_enter",
        event: event as PointerEvent,
      });
    });
    listen("pointerup", (event) => {
      uiIntentStore.publish({
        type: "pointer_up",
        event: event as PointerEvent,
      });
    });
    listen("pointercancel", (event) => {
      uiIntentStore.publish({
        type: "pointer_cancel",
        event: event as PointerEvent,
      });
    });
    listen("lostpointercapture", () => {
      uiIntentStore.publish({ type: "lost_pointer_capture" });
    });
    listen("pointerleave", () => {
      uiIntentStore.publish({ type: "pointer_leave" });
    });
  }
}

function describeStartupStatus(status: {
  phase: StartupPhase;
  blockingReason?: string;
}): {
  title: string;
  detail: string;
} {
  if (status.phase === "assets_loading") {
    return {
      title: "Loading drawing assets…",
      detail: "Image layers and references are being prepared.",
    };
  }
  if (status.phase === "first_bake") {
    return {
      title: "Preparing drawing…",
      detail: "Building the first rendered frame.",
    };
  }
  if (status.phase === "degraded") {
    return {
      title: "Drawing could not be opened",
      detail:
        "The previous drawing is still available. You can dismiss this message and try another one.",
    };
  }
  if (status.blockingReason === "switch_document") {
    return {
      title: "Opening drawing…",
      detail:
        "Shared drawings can take a moment to respond. The current drawing will stay in place until the switch finishes.",
    };
  }
  if (status.blockingReason === "create_document") {
    return {
      title: "Creating drawing…",
      detail: "Setting up a fresh canvas.",
    };
  }
  return {
    title: "Loading drawing…",
    detail: "Preparing the drawing surface.",
  };
}
