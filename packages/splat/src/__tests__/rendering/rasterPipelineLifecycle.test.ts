import { describe, expect, spyOn, test } from "bun:test";
import { DrawingStore, getOrderedLayers } from "@smalldraw/core";
import { Vec2 } from "@smalldraw/geometry";
import { HotLayer } from "@smalldraw/renderer-raster";
import { createRasterPipeline } from "../../render/createRasterPipeline";
import { createKidsShapeHandlerRegistry } from "../../shapes/kidsShapeHandlers";
import { createPenTool } from "../../tools/drawingTools";
import { KidsDrawStageView } from "../../view/KidsDrawStage";

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
  test.each([
    "cancel",
    "dispose",
  ])("capture cannot resurrect a draft after %s", async (action) => {
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
  });

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
