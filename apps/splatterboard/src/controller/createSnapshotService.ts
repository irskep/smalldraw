import type { DrawingStore } from "@smalldraw/core";
import {
  renderOrderedShapes,
  type ShapeRendererRegistry,
} from "@smalldraw/renderer-canvas";
import { getLoadedRasterImage } from "../shapes/rasterImageCache";

type ReferenceComposite = "under-drawing" | "over-drawing";

export class SnapshotService {
  constructor(
    private readonly options: {
      store: DrawingStore;
      shapeRendererRegistry: ShapeRendererRegistry;
      backgroundColor: string;
      getReferenceImageSrc: (composite: ReferenceComposite) => string | null;
    },
  ) {}

  private drawReferenceImage(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    composite: ReferenceComposite,
  ): void {
    const src = this.options.getReferenceImageSrc(composite);
    if (!src) {
      return;
    }
    const image = getLoadedRasterImage(src);
    if (!image) {
      return;
    }
    ctx.drawImage(image, 0, 0, width, height);
  }

  async createThumbnailBlob(): Promise<Blob | null> {
    const { store, shapeRendererRegistry, backgroundColor } = this.options;
    const doc = store.getDocument();
    const width = Math.max(1, Math.round(doc.size.width));
    const height = Math.max(1, Math.round(doc.size.height));
    const maxDimension = 640;
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx || typeof canvas.toBlob !== "function") {
      return null;
    }

    ctx.save();
    ctx.scale(scale, scale);
    this.drawReferenceImage(ctx, width, height, "under-drawing");
    renderOrderedShapes(ctx, store.getOrderedShapes(), {
      registry: shapeRendererRegistry,
      geometryHandlerRegistry: store.getShapeHandlers(),
    });
    this.drawReferenceImage(ctx, width, height, "over-drawing");
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.restore();

    return await new Promise((resolve) => {
      canvas.toBlob((result) => resolve(result), "image/webp", 0.82);
    });
  }

  async createPngExport(input: {
    width: number;
    height: number;
  }): Promise<{ blob: Blob | null; dataUrl: string | null }> {
    const { store, shapeRendererRegistry, backgroundColor } = this.options;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(input.width));
    canvas.height = Math.max(1, Math.round(input.height));
    const ctx = canvas.getContext("2d");
    if (!ctx || typeof canvas.toDataURL !== "function") {
      return { blob: null, dataUrl: null };
    }

    this.drawReferenceImage(ctx, canvas.width, canvas.height, "under-drawing");
    renderOrderedShapes(ctx, store.getOrderedShapes(), {
      registry: shapeRendererRegistry,
      geometryHandlerRegistry: store.getShapeHandlers(),
    });
    this.drawReferenceImage(ctx, canvas.width, canvas.height, "over-drawing");
    ctx.save();
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    const blob: Blob | null =
      typeof canvas.toBlob === "function"
        ? await new Promise((resolve) => {
            canvas.toBlob((result) => resolve(result), "image/png");
          })
        : null;
    return {
      blob,
      dataUrl: canvas.toDataURL("image/png"),
    };
  }
}
