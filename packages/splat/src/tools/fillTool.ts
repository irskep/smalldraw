import {
  AddShape,
  type AnyShape,
  attachPointerHandlers,
  createDisposerBucket,
  getOrderedLayers,
  type ToolDefinition,
  type ToolRuntime,
} from "@smalldraw/core";
import { getX, getY } from "@smalldraw/geometry";
import {
  renderLayerStack,
  type ShapeRendererRegistry,
} from "@smalldraw/renderer-canvas";
import { registerRasterImage } from "../shapes/rasterImageCache";
import { createFillComputation } from "./fillComputation";
import type { FillPixelsRequest, FillPixelsResult } from "./fillPixels";

const PRIMARY_BUTTON_MASK = 1;
const DEFAULT_TOLERANCE = 30;
const DEFAULT_FEATHER_RADIUS = 2;
const DEFAULT_BACKGROUND_COLOR = "#ffffff";

export interface FillToolOptions {
  shapeRendererRegistry: ShapeRendererRegistry;
  workerUrl?: URL;
  tolerance?: number;
  featherRadius?: number;
  backgroundColor?: string;
  resolveImage?: (src: string) => CanvasImageSource | null;
}

function parseHexColor(color: string): { r: number; g: number; b: number } {
  const normalized = color.trim().toLowerCase();
  const shortMatch = /^#([0-9a-f]{3})$/.exec(normalized);
  if (shortMatch) {
    const value = shortMatch[1];
    return {
      r: Number.parseInt(`${value[0]}${value[0]}`, 16),
      g: Number.parseInt(`${value[1]}${value[1]}`, 16),
      b: Number.parseInt(`${value[2]}${value[2]}`, 16),
    };
  }
  const fullMatch = /^#([0-9a-f]{6})$/.exec(normalized);
  if (fullMatch) {
    const value = fullMatch[1];
    return {
      r: Number.parseInt(value.slice(0, 2), 16),
      g: Number.parseInt(value.slice(2, 4), 16),
      b: Number.parseInt(value.slice(4, 6), 16),
    };
  }
  return { r: 0, g: 0, b: 0 };
}

function renderCurrentCanvas(
  runtime: ToolRuntime,
  width: number,
  height: number,
  backgroundColor: string,
  shapeRendererRegistry: ShapeRendererRegistry,
  resolveImage: (src: string) => CanvasImageSource | null,
): HTMLCanvasElement | null {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  const doc = runtime.getDocument();
  renderLayerStack(ctx, getOrderedLayers(doc), runtime.getOrderedShapes(), {
    registry: shapeRendererRegistry,
    geometryHandlerRegistry: runtime.getShapeHandlers(),
    resolveImage,
    documentWidth: width,
    documentHeight: height,
  });
  ctx.save();
  ctx.globalCompositeOperation = "destination-over";
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
  return canvas;
}

interface FillImageResult {
  dataUrl: string;
  canvas: HTMLCanvasElement;
  x: number;
  y: number;
}

async function createFillImage(params: {
  sourceCanvas: HTMLCanvasElement;
  compute: (request: FillPixelsRequest) => Promise<FillPixelsResult | null>;
  x: number;
  y: number;
  fillColor: string;
  tolerance: number;
  featherRadius: number;
}): Promise<FillImageResult | null> {
  const sourceCtx = params.sourceCanvas.getContext("2d", {
    willReadFrequently: true,
  });
  if (
    !sourceCtx ||
    typeof sourceCtx.getImageData !== "function" ||
    typeof sourceCtx.createImageData !== "function" ||
    typeof sourceCtx.putImageData !== "function"
  ) {
    return null;
  }
  const width = params.sourceCanvas.width;
  const height = params.sourceCanvas.height;
  const sourceImage = sourceCtx.getImageData(0, 0, width, height);
  const pixels = await params.compute({
    imageData: sourceImage.data,
    width,
    height,
    x: params.x,
    y: params.y,
    color: parseHexColor(params.fillColor),
    tolerance: params.tolerance,
    featherRadius: params.featherRadius,
  });
  if (!pixels) return null;
  const fillImage = sourceCtx.createImageData(pixels.width, pixels.height);
  fillImage.data.set(pixels.pixels);

  const fillCanvas = document.createElement("canvas");
  fillCanvas.width = pixels.width;
  fillCanvas.height = pixels.height;
  const fillCtx = fillCanvas.getContext("2d");
  if (!fillCtx || typeof fillCanvas.toDataURL !== "function") {
    return null;
  }
  fillCtx.putImageData(fillImage, 0, 0);
  const dataUrl = fillCanvas.toDataURL("image/png");
  return { dataUrl, canvas: fillCanvas, x: pixels.x, y: pixels.y };
}

export function createFillTool(options: FillToolOptions): ToolDefinition {
  return {
    id: "fill.basic",
    label: "Fill",
    styleSupport: {
      strokeColor: true,
      strokeWidth: false,
      fillColor: false,
      transparentStrokeColor: false,
      transparentFillColor: false,
    },
    activate(runtime) {
      const disposers = createDisposerBucket();
      const computation = createFillComputation(options.workerUrl);
      let active = true;
      let pending = false;
      disposers.add(() => {
        active = false;
        computation.dispose();
      });
      const fillOptions = runtime.getOptions<FillToolOptions>() ?? options;
      const tolerance = fillOptions.tolerance ?? DEFAULT_TOLERANCE;
      const featherRadius = fillOptions.featherRadius ?? DEFAULT_FEATHER_RADIUS;
      const backgroundColor =
        fillOptions.backgroundColor ?? DEFAULT_BACKGROUND_COLOR;
      const { shapeRendererRegistry } = fillOptions;

      disposers.add(
        attachPointerHandlers(runtime, {
          async onPointerDown(event) {
            if (pending) return;
            if (
              ((event.buttons ?? PRIMARY_BUTTON_MASK) & PRIMARY_BUTTON_MASK) ===
              0
            ) {
              return;
            }
            const sampledDocument = runtime.getDocument();
            const layerId = runtime.getActiveLayerId();
            const documentSize = sampledDocument.size;
            const sourceCanvas = renderCurrentCanvas(
              runtime,
              documentSize.width,
              documentSize.height,
              backgroundColor,
              shapeRendererRegistry,
              fillOptions.resolveImage ?? (() => null),
            );
            if (!sourceCanvas) {
              return;
            }
            const shared = runtime.getSharedSettings();
            const fillColor = shared.strokeColor ?? "#000000";
            pending = true;
            let fillResult: FillImageResult | null;
            try {
              fillResult = await createFillImage({
                compute: async (request) => {
                  const pixels = await computation.compute(request);
                  return active &&
                    runtime.getDocument() === sampledDocument &&
                    runtime.getActiveLayerId() === layerId
                    ? pixels
                    : null;
                },
                sourceCanvas,
                x: getX(event.point),
                y: getY(event.point),
                fillColor,
                tolerance,
                featherRadius,
              });
            } catch (error) {
              console.error("Fill computation failed", error);
              return;
            } finally {
              pending = false;
            }
            // A result belongs to exactly the sampled scene and layer. This also
            // rejects undo, remote edits, layer deletion, and document switches.
            if (
              !active ||
              runtime.getDocument() !== sampledDocument ||
              runtime.getActiveLayerId() !== layerId ||
              !fillResult
            ) {
              return;
            }
            registerRasterImage(fillResult.dataUrl, fillResult.canvas);
            const fillShape = {
              id: runtime.generateShapeId("fill"),
              type: "raster-fill",
              zIndex: runtime.getNextZIndexInLayer(),
              layerId,
              geometry: {
                type: "raster-fill",
                src: fillResult.dataUrl,
                width: fillResult.canvas.width,
                height: fillResult.canvas.height,
              },
              style: {},
              transform: {
                translation: [
                  fillResult.x + fillResult.canvas.width / 2,
                  fillResult.y + fillResult.canvas.height / 2,
                ],
              },
            } as AnyShape;
            runtime.commit(new AddShape(fillShape));
          },
          onPointerMove() {},
          onPointerUp() {},
          onPointerCancel() {
            computation.dispose();
          },
        }),
      );

      return () => {
        disposers.dispose();
      };
    },
  };
}
