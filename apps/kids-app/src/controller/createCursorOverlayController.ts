import type { DrawingStore } from "@smalldraw/core";
import { Vec2 } from "@smalldraw/geometry";
import type { KidsDrawStage } from "../view/KidsDrawStage";

export interface CursorOverlayController {
  refreshMetrics(): void;
  setDrawingActive(active: boolean): void;
  sync(): void;
  toPoint(event: PointerEvent): Vec2;
  handlePointerDown(event: PointerEvent): void;
  handlePointerMove(event: PointerEvent): void;
  handlePointerRawUpdate(event: PointerEvent): void;
  handlePointerEnter(event: PointerEvent): void;
  handlePointerLeave(): void;
}

export function createCursorOverlayController(options: {
  store: DrawingStore;
  stage: KidsDrawStage;
  getSize: () => { width: number; height: number };
}): CursorOverlayController {
  const { store, stage, getSize } = options;

  let drawingActive = false;
  let mouseHoverPoint: [number, number] | null = null;
  let overlayLeft = 0;
  let overlayTop = 0;
  let overlayWidthScale = 1;
  let overlayHeightScale = 1;

  const refreshMetrics = (): void => {
    const size = getSize();
    const rect = stage.overlay.getBoundingClientRect();
    overlayLeft = rect.left;
    overlayTop = rect.top;
    overlayWidthScale = rect.width > 0 ? size.width / rect.width : 1;
    overlayHeightScale = rect.height > 0 ? size.height / rect.height : 1;
  };

  const sync = (): void => {
    const indicator = stage.cursorIndicator;
    const activeToolId = store.getActiveToolId();
    const isPenTool = activeToolId === "pen" || activeToolId === "marker";
    const isEraserTool = activeToolId === "eraser";
    if ((!isPenTool && !isEraserTool) || !mouseHoverPoint) {
      indicator.style.visibility = "hidden";
      return;
    }
    if (isPenTool && drawingActive) {
      indicator.style.visibility = "hidden";
      return;
    }
    const { strokeColor, strokeWidth } = store.getSharedSettings();
    indicator.style.transform = `translate3d(${mouseHoverPoint[0]}px, ${mouseHoverPoint[1]}px, 0) translate(-50%, -50%)`;
    indicator.style.width = `${Math.max(2, strokeWidth)}px`;
    indicator.style.height = `${Math.max(2, strokeWidth)}px`;
    indicator.style.setProperty("--kids-cursor-color", strokeColor);
    indicator.style.visibility = "";
  };

  const toPoint = (event: PointerEvent): Vec2 =>
    new Vec2(event.clientX, event.clientY)
      .sub([overlayLeft, overlayTop])
      .mul([overlayWidthScale, overlayHeightScale]);

  const updateMouseHoverPointFromEvent = (event: PointerEvent): void => {
    const hoverPoint = toPoint(event);
    mouseHoverPoint = [hoverPoint[0], hoverPoint[1]];
    sync();
  };

  return {
    refreshMetrics,
    setDrawingActive(active) {
      drawingActive = active;
      sync();
    },
    sync,
    toPoint,
    handlePointerDown(event) {
      refreshMetrics();
      if (event.pointerType !== "mouse") {
        mouseHoverPoint = null;
        sync();
      }
    },
    handlePointerMove(event) {
      if (event.pointerType === "mouse") {
        updateMouseHoverPointFromEvent(event);
        return;
      }
      if (mouseHoverPoint) {
        mouseHoverPoint = null;
        sync();
      }
    },
    handlePointerRawUpdate(event) {
      if (event.pointerType !== "mouse") {
        return;
      }
      updateMouseHoverPointFromEvent(event);
    },
    handlePointerEnter(event) {
      refreshMetrics();
      if (event.pointerType !== "mouse") {
        return;
      }
      updateMouseHoverPointFromEvent(event);
    },
    handlePointerLeave() {
      mouseHoverPoint = null;
      sync();
    },
  };
}
