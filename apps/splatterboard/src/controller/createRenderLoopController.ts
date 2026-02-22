import type { RasterPipeline } from "../render/createRasterPipeline";

type RafRenderState = "idle" | "modelRequested" | "anticipatory";

export const DEFAULT_RESIZE_BAKE_DEBOUNCE_MS = 120;

export class RenderLoopController {
  private rafRenderState: RafRenderState = "idle";
  private rafHandle: number | null = null;
  private resizeBakeHandle: ReturnType<typeof setTimeout> | null = null;
  private tilePixelRatio: number;
  private currentRenderIdentity = "";
  private readonly resizeBakeDebounceMs: number;

  constructor(
    private readonly options: {
      pipeline: RasterPipeline;
      backgroundColor: string;
      resizeBakeDebounceMs?: number;
      getSize: () => { width: number; height: number };
      getPresentationIdentity: () => string;
      onRenderPass: () => void;
      perfSession: {
        onRafFrameExecuted: () => void;
      };
    },
    initialTilePixelRatio: number,
  ) {
    this.tilePixelRatio = initialTilePixelRatio;
    this.resizeBakeDebounceMs =
      options.resizeBakeDebounceMs ?? DEFAULT_RESIZE_BAKE_DEBOUNCE_MS;
  }

  getTilePixelRatio(): number {
    return this.tilePixelRatio;
  }

  setTilePixelRatio(nextPixelRatio: number): void {
    if (nextPixelRatio === this.tilePixelRatio) {
      return;
    }
    this.tilePixelRatio = nextPixelRatio;
    this.options.pipeline.setTilePixelRatio(this.tilePixelRatio);
    this.updateRenderIdentity();
    this.scheduleResizeBake();
  }

  updateRenderIdentity(): void {
    const nextIdentity = this.getRenderIdentity();
    if (nextIdentity !== this.currentRenderIdentity) {
      this.currentRenderIdentity = nextIdentity;
      this.options.pipeline.setRenderIdentity(this.currentRenderIdentity);
    }
  }

  requestRenderFromModel(): void {
    if (this.rafRenderState === "idle") {
      this.rafRenderState = "modelRequested";
      this.ensureRafScheduled();
      return;
    }
    if (this.rafRenderState === "anticipatory") {
      this.rafRenderState = "modelRequested";
    }
  }

  scheduleResizeBake(): void {
    if (this.resizeBakeHandle !== null) {
      clearTimeout(this.resizeBakeHandle);
    }
    this.resizeBakeHandle = setTimeout(() => {
      this.resizeBakeHandle = null;
      this.options.pipeline.scheduleBakeForClear();
      this.options.pipeline.bakePendingTiles();
      this.requestRenderFromModel();
    }, this.resizeBakeDebounceMs);
  }

  dispose(): void {
    if (this.resizeBakeHandle !== null) {
      clearTimeout(this.resizeBakeHandle);
      this.resizeBakeHandle = null;
    }
    if (this.rafHandle !== null) {
      this.cancelAnimationFrameHandle(this.rafHandle);
      this.rafHandle = null;
    }
  }

  private getRenderIdentity(): string {
    const size = this.options.getSize();
    return [
      "kids-draw",
      `w:${size.width}`,
      `h:${size.height}`,
      "tile:256",
      `dpr:${this.tilePixelRatio.toFixed(3)}`,
      `bg:${this.options.backgroundColor}`,
      `presentation:${this.options.getPresentationIdentity()}`,
    ].join("|");
  }

  private ensureRafScheduled(): void {
    if (this.rafHandle !== null) {
      return;
    }
    this.rafHandle = this.scheduleAnimationFrame(() => {
      this.rafHandle = null;
      this.options.perfSession.onRafFrameExecuted();
      if (this.rafRenderState === "idle") {
        return;
      }
      if (this.rafRenderState === "modelRequested") {
        this.options.onRenderPass();
        this.rafRenderState = "anticipatory";
        this.ensureRafScheduled();
        return;
      }
      this.rafRenderState = "idle";
    });
  }

  private scheduleAnimationFrame(callback: FrameRequestCallback): number {
    if (typeof requestAnimationFrame === "function") {
      return requestAnimationFrame(callback);
    }
    return setTimeout(() => callback(Date.now()), 16) as unknown as number;
  }

  private cancelAnimationFrameHandle(handle: number): void {
    if (typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(handle);
      return;
    }
    clearTimeout(handle);
  }
}
