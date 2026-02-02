import type { SmalldrawCore } from "@smalldraw/core";
import { DrawingApp, type DrawingAppOptions } from "./components/DrawingApp";

export interface SmalldrawVanillaUIOptions {
  core: SmalldrawCore;
  container: HTMLElement;
  width: number;
  height: number;
  backgroundColor?: string;
  autoScale?: boolean;
  maxScale?: number;
}

export interface SmalldrawVanillaUI {
  readonly app: DrawingApp;
  readonly core: SmalldrawCore;
  destroy(): void;
  reset(): Promise<void>;
}

function computeScale(
  containerWidth: number,
  containerHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  maxScale = 1,
): number {
  const scaleX = containerWidth / viewportWidth;
  const scaleY = containerHeight / viewportHeight;
  return Math.min(scaleX, scaleY, maxScale);
}

export function createSmalldrawVanillaUI(
  options: SmalldrawVanillaUIOptions,
): SmalldrawVanillaUI {
  const {
    core,
    container,
    width: viewportWidth,
    height: viewportHeight,
    backgroundColor,
    autoScale = true,
    maxScale = 1,
  } = options;

  if (!container) {
    throw new Error("container is required");
  }

  container.innerHTML = "";

  const containerRect = container.getBoundingClientRect();
  const initialScale =
    autoScale && containerRect.width > 0 && containerRect.height > 0
      ? computeScale(
          containerRect.width,
          containerRect.height,
          viewportWidth,
          viewportHeight,
          maxScale,
        )
      : 1;
  const initialWidth = viewportWidth * initialScale;
  const initialHeight = viewportHeight * initialScale;

  const appOptions: DrawingAppOptions = {
    container,
    width: viewportWidth,
    height: viewportHeight,
    backgroundColor,
    storeAdapter: core.storeAdapter,
    scale: initialScale,
    initialCanvasWidth: initialWidth,
    initialCanvasHeight: initialHeight,
  };

  const app = new DrawingApp(appOptions);

  let resizeRafId: number | null = null;
  let lastScale = initialScale;
  const resizeObserver = autoScale
    ? new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;

        const { width: containerWidth, height: containerHeight } =
          entry.contentRect;
        if (containerWidth === 0 || containerHeight === 0) return;

        const scale = computeScale(
          containerWidth,
          containerHeight,
          viewportWidth,
          viewportHeight,
          maxScale,
        );

        if (scale === lastScale) return;

        if (resizeRafId !== null) {
          cancelAnimationFrame(resizeRafId);
        }

        resizeRafId = requestAnimationFrame(() => {
          resizeRafId = null;
          const scaledWidth = viewportWidth * scale;
          const scaledHeight = viewportHeight * scale;

          app.resize(scaledWidth, scaledHeight);
          app.setScale(scale);
          lastScale = scale;
        });
      })
    : null;

  resizeObserver?.observe(container);

  return {
    get app() {
      return app;
    },
    get core() {
      return core;
    },
    destroy() {
      if (resizeRafId !== null) {
        cancelAnimationFrame(resizeRafId);
        resizeRafId = null;
      }
      resizeObserver?.disconnect();
      app.destroy();
    },
    async reset() {
      const newAdapter = await core.reset();
      app.resetWithAdapter(newAdapter);
    },
  };
}
