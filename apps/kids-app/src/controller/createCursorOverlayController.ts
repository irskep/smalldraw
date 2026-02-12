import type { DrawingStore } from "@smalldraw/core";
import { Vec2 } from "@smalldraw/geometry";
import type { IconNode } from "lucide";
import type { KidsToolCursorMode } from "../tools/kidsTools";
import { getAlphabetGlyph } from "../tools/stampGlyphs";
import { computeImageStampSize } from "../tools/stamps/imageStamp";
import {
  getLoadedImageStampAsset,
  warmImageStampAsset,
} from "../tools/stamps/imageStampAssets";
import {
  getImageStampAsset,
  getImageStampAssetIdFromToolId,
} from "../tools/stamps/imageStampCatalog";
import {
  computeStampSize,
  sampleStampStrokeLocalPoints,
  toStampStrokeSize,
} from "../tools/stampTool";
import type { KidsDrawStage } from "../view/KidsDrawStage";

export interface CursorOverlayController {
  refreshMetrics(): void;
  setDrawingActive(active: boolean): void;
  sync(): void;
  playStampCommit(point: Vec2): void;
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
  cursorModeByToolId: ReadonlyMap<string, KidsToolCursorMode>;
  cursorPreviewIconByToolId: ReadonlyMap<string, IconNode>;
}): CursorOverlayController {
  const {
    store,
    stage,
    getSize,
    cursorModeByToolId,
    cursorPreviewIconByToolId,
  } = options;

  const SVG_NS = "http://www.w3.org/2000/svg";
  const previewCanvas = document.createElement("canvas");
  previewCanvas.setAttribute("aria-hidden", "true");
  stage.cursorIndicator.appendChild(previewCanvas);

  const previewSvg = document.createElementNS(SVG_NS, "svg");
  previewSvg.setAttribute("viewBox", "0 0 24 24");
  previewSvg.setAttribute("aria-hidden", "true");
  previewSvg.setAttribute("fill", "none");
  previewSvg.setAttribute("stroke", "currentColor");
  previewSvg.setAttribute("stroke-width", "2");
  previewSvg.setAttribute("stroke-linecap", "round");
  previewSvg.setAttribute("stroke-linejoin", "round");
  stage.cursorIndicator.appendChild(previewSvg);

  let drawingActive = false;
  let stampDragActive = false;
  let stampPointerDownPoint: Vec2 | null = null;
  let mouseHoverPoint: [number, number] | null = null;
  let overlayLeft = 0;
  let overlayTop = 0;
  let overlayWidthScale = 1;
  let overlayHeightScale = 1;
  let activePreviewToolId: string | null = null;
  const STAMP_DRAG_HIDE_DISTANCE_PX = 4;

  const renderPreviewIcon = (iconNode: IconNode): void => {
    while (previewSvg.firstChild) {
      previewSvg.removeChild(previewSvg.firstChild);
    }
    for (const [tag, attrs] of iconNode) {
      const node = document.createElementNS(SVG_NS, tag);
      for (const [attr, value] of Object.entries(attrs)) {
        if (value !== undefined) {
          node.setAttribute(attr, `${value}`);
        }
      }
      previewSvg.appendChild(node);
    }
  };

  const renderStampPreview = (
    toolId: string,
    strokeColor: string,
    baseStrokeSize: number,
  ): boolean => {
    const weightedStrokeSize = toStampStrokeSize(baseStrokeSize);
    const stampSize = computeStampSize(weightedStrokeSize);
    const imageAssetId = getImageStampAssetIdFromToolId(toolId);
    const glyphTool = toolId.startsWith("stamp.letter.");

    const padding = glyphTool
      ? Math.max(2, Math.ceil(weightedStrokeSize * 1.5))
      : Math.max(2, Math.ceil(weightedStrokeSize));

    const logicalSize = (() => {
      if (imageAssetId) {
        const asset = getImageStampAsset(imageAssetId);
        const size = computeImageStampSize(asset, stampSize);
        return {
          width: size.width + padding * 2,
          height: size.height + padding * 2,
        };
      }
      if (glyphTool) {
        const suffix = toolId.slice("stamp.letter.".length);
        if (!suffix) {
          return null;
        }
        const letter = suffix[0].toUpperCase();
        const glyph = getAlphabetGlyph(letter);
        return {
          width: glyph.advance * stampSize + padding * 2,
          height: stampSize + padding * 2,
        };
      }
      return null;
    })();

    if (!logicalSize) {
      return false;
    }

    const logicalWidth = logicalSize.width;
    const logicalHeight = logicalSize.height;
    const dpr = Math.max(
      1,
      (globalThis as { devicePixelRatio?: number }).devicePixelRatio ?? 1,
    );

    const pixelWidth = Math.max(1, Math.round(logicalWidth * dpr));
    const pixelHeight = Math.max(1, Math.round(logicalHeight * dpr));
    if (previewCanvas.width !== pixelWidth) {
      previewCanvas.width = pixelWidth;
    }
    if (previewCanvas.height !== pixelHeight) {
      previewCanvas.height = pixelHeight;
    }
    previewCanvas.style.width = `${logicalWidth}px`;
    previewCanvas.style.height = `${logicalHeight}px`;

    const ctx = previewCanvas.getContext("2d");
    if (!ctx) {
      return false;
    }
    if (
      typeof ctx.setTransform !== "function" ||
      typeof ctx.clearRect !== "function" ||
      typeof ctx.save !== "function" ||
      typeof ctx.translate !== "function" ||
      typeof ctx.beginPath !== "function" ||
      typeof ctx.moveTo !== "function" ||
      typeof ctx.lineTo !== "function" ||
      typeof ctx.stroke !== "function" ||
      typeof ctx.restore !== "function" ||
      typeof ctx.drawImage !== "function"
    ) {
      return false;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, logicalWidth, logicalHeight);
    ctx.save();
    ctx.translate(padding, padding);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = weightedStrokeSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (imageAssetId) {
      const asset = getImageStampAsset(imageAssetId);
      const size = computeImageStampSize(asset, stampSize);
      warmImageStampAsset(asset.src);
      const image = getLoadedImageStampAsset(asset.src);
      if (!image) {
        return false;
      }
      ctx.drawImage(image, 0, 0, size.width, size.height);
    } else {
      const suffix = toolId.slice("stamp.letter.".length);
      if (!suffix) {
        return false;
      }
      const letter = suffix[0].toUpperCase();
      const glyph = getAlphabetGlyph(letter);
      for (const glyphStroke of glyph.strokes) {
        if (glyphStroke.commands.length === 0) {
          continue;
        }
        const sampled = sampleStampStrokeLocalPoints(glyphStroke);
        if (sampled.length < 2) {
          continue;
        }
        ctx.beginPath();
        ctx.moveTo(sampled[0][0] * stampSize, sampled[0][1] * stampSize);
        for (const [x, y] of sampled.slice(1)) {
          ctx.lineTo(x * stampSize, y * stampSize);
        }
        ctx.stroke();
      }
    }

    ctx.restore();
    stage.cursorIndicator.style.width = `${logicalWidth}px`;
    stage.cursorIndicator.style.height = `${logicalHeight}px`;
    return true;
  };

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
    const cursorMode = activeToolId
      ? cursorModeByToolId.get(activeToolId)
      : undefined;
    if (!cursorMode || cursorMode === "none" || !mouseHoverPoint) {
      indicator.style.visibility = "hidden";
      return;
    }
    if (cursorMode === "hide-while-drawing" && drawingActive) {
      indicator.style.visibility = "hidden";
      return;
    }
    if (
      drawingActive &&
      stampDragActive &&
      typeof activeToolId === "string" &&
      activeToolId.startsWith("stamp.")
    ) {
      indicator.style.visibility = "hidden";
      return;
    }

    const { strokeColor, strokeWidth } = store.getSharedSettings();
    const previewIcon = activeToolId
      ? cursorPreviewIconByToolId.get(activeToolId)
      : undefined;
    const renderedStampPreview = activeToolId
      ? renderStampPreview(activeToolId, strokeColor, strokeWidth)
      : false;

    indicator.style.transform = `translate3d(${mouseHoverPoint[0]}px, ${mouseHoverPoint[1]}px, 0) translate(-50%, -50%)`;
    indicator.style.setProperty("--kd-cursor-color", strokeColor);

    if (activeToolId && (renderedStampPreview || previewIcon)) {
      if (!renderedStampPreview && previewIcon) {
        if (activePreviewToolId !== activeToolId) {
          previewSvg.setAttribute("viewBox", "0 0 24 24");
          previewSvg.setAttribute("stroke-width", "2");
          renderPreviewIcon(previewIcon);
        }
        indicator.style.width = "24px";
        indicator.style.height = "24px";
      }
      activePreviewToolId = activeToolId;
      indicator.classList.add("is-glyph-preview");
    } else {
      activePreviewToolId = null;
      indicator.classList.remove("is-glyph-preview");
      indicator.style.width = `${Math.max(2, strokeWidth)}px`;
      indicator.style.height = `${Math.max(2, strokeWidth)}px`;
    }

    indicator.style.visibility = "";
  };

  const playStampCommit = (point: Vec2): void => {
    const activeToolId = store.getActiveToolId();
    if (!activeToolId?.startsWith("stamp.")) {
      return;
    }
    const { strokeColor, strokeWidth } = store.getSharedSettings();
    const weightedStrokeSize = toStampStrokeSize(strokeWidth);
    const stampSize = computeStampSize(weightedStrokeSize);
    const imageAssetId = getImageStampAssetIdFromToolId(activeToolId);
    const popSize = (() => {
      if (imageAssetId) {
        const asset = getImageStampAsset(imageAssetId);
        const size = computeImageStampSize(asset, stampSize);
        return {
          width: size.width + weightedStrokeSize * 2,
          height: size.height + weightedStrokeSize * 2,
        };
      }
      if (!activeToolId.startsWith("stamp.letter.")) {
        return null;
      }
      const suffix = activeToolId.slice("stamp.letter.".length);
      if (!suffix) {
        return null;
      }
      const letter = suffix[0].toUpperCase();
      const glyph = getAlphabetGlyph(letter);
      return {
        width: glyph.advance * stampSize + weightedStrokeSize * 2,
        height: stampSize + weightedStrokeSize * 2,
      };
    })();
    if (!popSize) {
      return;
    }

    const pop = document.createElement("div");
    pop.className = "kids-draw-stamp-pop";
    pop.style.setProperty("--kd-stamp-pop-color", strokeColor);
    pop.style.width = `${popSize.width}px`;
    pop.style.height = `${popSize.height}px`;
    pop.style.left = `${point[0]}px`;
    pop.style.top = `${point[1]}px`;
    stage.sceneRoot.appendChild(pop);
    pop.addEventListener(
      "animationend",
      () => {
        pop.remove();
      },
      { once: true },
    );
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
      if (!active) {
        stampDragActive = false;
        stampPointerDownPoint = null;
      }
      sync();
    },
    sync,
    playStampCommit,
    toPoint,
    handlePointerDown(event) {
      refreshMetrics();
      const activeToolId = store.getActiveToolId();
      if (
        event.pointerType === "mouse" &&
        typeof activeToolId === "string" &&
        activeToolId.startsWith("stamp.")
      ) {
        stampPointerDownPoint = toPoint(event);
        stampDragActive = false;
      }
      if (event.pointerType !== "mouse") {
        mouseHoverPoint = null;
        sync();
      }
    },
    handlePointerMove(event) {
      if (
        event.pointerType === "mouse" &&
        drawingActive &&
        stampPointerDownPoint
      ) {
        const activeToolId = store.getActiveToolId();
        if (
          typeof activeToolId === "string" &&
          activeToolId.startsWith("stamp.")
        ) {
          const currentPoint = toPoint(event);
          const distance = Vec2.distance(currentPoint, stampPointerDownPoint);
          if (distance >= STAMP_DRAG_HIDE_DISTANCE_PX) {
            stampDragActive = true;
          }
        }
      }
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
