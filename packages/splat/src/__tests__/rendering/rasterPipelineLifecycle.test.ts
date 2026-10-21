import { describe, expect, spyOn, test } from "bun:test";

import { DrawingStore, getOrderedLayers } from "@smalldraw/core";
import { Vec2 } from "@smalldraw/geometry";
import { HotLayer } from "@smalldraw/renderer-raster";

import { createRasterPipeline } from "../../render/createRasterPipeline";
import { createKidsShapeHandlerRegistry } from "../../shapes/kidsShapeHandlers";
import {
  getLoadedRasterImage,
  registerRasterImage,
  resetRasterImageCache,
} from "../../shapes/rasterImageCache";
import { createPenTool } from "../../tools/drawingTools";
import { KidsDrawStageView } from "../../view/KidsDrawStage";
import { useNativeCanvases } from "./nativeCanvasFixture";

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function fixture() {
  const store = new DrawingStore({
    tools: [createPenTool()],
    shapeHandlers: createKidsShapeHandlerRegistry(),
  });
  store.activateTool("brush.freehand");
  const stage = new KidsDrawStageView({
    width: 100,
    height: 100,
    backgroundColor: "white",
    uiIntentStore: { publish() {} },
  });
  const pipeline = createRasterPipeline({
    store,
    stage,
    shapeRendererRegistry: new Map(),
    width: 100,
    height: 100,
    backgroundColor: "white",
    tilePixelRatio: 1,
    renderIdentity: "test",
  });
  pipeline.setLayers(getOrderedLayers(store.getDocument()));
  const down = () =>
    store.dispatch("pointerDown", { point: new Vec2(10, 10), buttons: 1 });
  const up = () =>
    store.dispatch("pointerUp", { point: new Vec2(20, 20), buttons: 0 });
  const layersVisible = () =>
    [...stage.tileLayer.children]
      .filter((child) => child !== stage.hotCanvas)
      .every((child) => (child as HTMLElement).style.display !== "none");
  return { store, stage, pipeline, down, up, layersVisible };
}

describe("raster pipeline lifecycle", () => {
  test.each(["cancel", "dispose"])(
    "capture cannot resurrect a draft after %s",
    async (action) => {
      const f = fixture();
      try {
        f.down();
        f.pipeline.render();
        if (action === "dispose") f.pipeline.dispose();
        else {
          f.up();
          f.pipeline.render();
        }
        await settle();
        expect(f.stage.hotCanvas.style.visibility).toBe("hidden");
        expect(f.layersVisible()).toBe(true);
      } finally {
        f.pipeline.dispose();
        f.stage.destroy();
      }
    },
  );

  test("keeps the hot canvas until committed bakes settle, then permits another stroke", async () => {
    const f = fixture();
    try {
      f.down();
      f.pipeline.render();
      await settle();
      expect(f.layersVisible()).toBe(false);
      expect(f.stage.hotCanvas.style.visibility).toBe("");
      f.up();
      f.pipeline.render();
      expect(f.stage.hotCanvas.style.visibility).toBe("");
      await settle();
      expect(f.layersVisible()).toBe(true);
      expect(f.stage.hotCanvas.style.visibility).toBe("hidden");
      f.down();
      f.pipeline.render();
      await settle();
      expect(f.layersVisible()).toBe(false);
      expect(f.stage.hotCanvas.style.visibility).toBe("");
    } finally {
      f.pipeline.dispose();
      f.stage.destroy();
    }
  });

  test.each(["before-render", "ending"])(
    "preserves completed pixels through repeated handoff resizes (%s)",
    async (phase) => {
      const contexts = useNativeCanvases();
      const f = fixture();
      try {
        f.down();
        f.pipeline.render();
        await settle();
        // Paint a translucent patch beyond the temporary shrunken viewport.
        const ctx = f.stage.hotCanvas.getContext("2d")!;
        ctx.fillStyle = "rgba(0, 0, 255, 0.5)";
        ctx.fillRect(60, 60, 20, 20);
        const pixel = (x: number, y: number) =>
          Array.from(ctx.getImageData(x, y, 1, 1).data);
        const before = pixel(70, 70);
        expect(before[3]).toBeGreaterThan(0);
        f.up();
        if (phase === "ending") f.pipeline.render();
        // No yielding: the completion promise cannot settle between these resizes.
        f.pipeline.updateViewport(50, 50);
        f.pipeline.updateViewport(100, 100);
        f.pipeline.setTilePixelRatio(2);
        f.pipeline.render();
        expect(pixel(140, 140)).toEqual(before);
        expect(f.layersVisible()).toBe(false);
        expect(f.stage.hotCanvas.style.visibility).toBe("");
        // An identical update must not composite the translucent frame twice.
        f.pipeline.setTilePixelRatio(2);
        expect(pixel(140, 140)).toEqual(before);
        await settle();
        expect(f.layersVisible()).toBe(true);
        expect(f.stage.hotCanvas.style.visibility).toBe("hidden");
        // A later stroke must not reuse the previous completed frame.
        f.down();
        f.pipeline.render();
        await settle();
        f.up();
        f.pipeline.render();
        f.pipeline.setTilePixelRatio(1);
        expect(pixel(70, 70)[3]).toBe(0);
      } finally {
        f.pipeline.dispose();
        f.stage.destroy();
        contexts.mockRestore();
      }
    },
  );

  test("resizing an active draft requests a full repaint", async () => {
    const f = fixture();
    const render = spyOn(HotLayer.prototype, "renderDrafts");
    try {
      f.down();
      f.pipeline.render();
      await settle();
      f.store.dispatch("pointerMove", { point: new Vec2(30, 30), buttons: 1 });
      f.pipeline.setTilePixelRatio(2);
      f.pipeline.render();
      expect(render.mock.calls.at(-1)?.[1]?.dirtyBounds).toBeNull();
      expect(f.stage.hotCanvas.width).toBe(200);
      expect(f.layersVisible()).toBe(false);
    } finally {
      render.mockRestore();
      f.pipeline.dispose();
      f.stage.destroy();
    }
  });
});

test("pipeline releases old document images on switch and disposal", () => {
  const originalImage = globalThis.Image;
  globalThis.Image = undefined as unknown as typeof Image;
  const f = fixture();
  try {
    const empty = f.store.getDocument();
    const withImage = {
      ...empty,
      layers: {
        ...empty.layers,
        reference: {
          id: "reference",
          kind: "image" as const,
          zIndex: "a1",
          image: { src: "pipeline-owned" },
        },
      },
    };
    f.store.applyDocument(withImage);
    f.pipeline.render();
    const image = document.createElement("canvas");
    image.width = image.height = 1024;
    registerRasterImage("pipeline-owned", image);
    for (let i = 0; i < 40; i++)
      registerRasterImage(`pressure-${i}`, {
        width: 1024,
        height: 1024,
      } as HTMLCanvasElement);
    expect(getLoadedRasterImage("pipeline-owned")).toBe(image);
    f.store.applyDocument(empty);
    f.pipeline.render();
    expect(getLoadedRasterImage("pipeline-owned")).toBeNull();
    f.store.applyDocument(withImage);
    f.pipeline.render();
    registerRasterImage("pipeline-owned", image);
    expect(getLoadedRasterImage("pipeline-owned")).toBe(image);
    f.pipeline.dispose();
    expect(getLoadedRasterImage("pipeline-owned")).toBeNull();
  } finally {
    f.pipeline.dispose();
    f.stage.destroy();
    resetRasterImageCache();
    globalThis.Image = originalImage;
  }
});
