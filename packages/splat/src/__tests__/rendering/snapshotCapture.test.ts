import { expect, test } from "bun:test";
import { change, clone, ImmutableString } from "@automerge/automerge/slim";
import {
  createDocument,
  DrawingStore,
  getOrderedLayers,
  type PenShape,
} from "@smalldraw/core";
import { createLayerStack } from "@smalldraw/renderer-raster";
import { createKidsShapeRendererRegistry } from "../../render/kidsShapeRendererRegistry";
import { createKidsShapeHandlerRegistry } from "../../shapes/kidsShapeHandlers";
import { useNativeCanvases } from "./nativeCanvasFixture";

test("superseded prewarms skip copying while waiting drafts receive the latest pixels", async () => {
  const native = useNativeCanvases();
  const perf = { counters: {} as Record<string, number> };
  const global = globalThis as Record<string, unknown>;
  const previousPerf = global.__kidsDrawPerf;
  global.__kidsDrawPerf = perf;
  const registry = createKidsShapeHandlerRegistry();
  const shape: PenShape = {
    id: "line",
    type: "pen",
    layerId: "default",
    zIndex: "a0",
    temporalOrder: 0,
    geometry: {
      type: "pen-json",
      pointsJson: new ImmutableString("[[10,50],[90,50]]"),
      pointCount: 2,
    },
    style: {
      stroke: { type: "brush", brushId: "marker", size: 20, color: "#0000ff" },
    },
  };
  const documentState = change(
    createDocument([shape], registry, { width: 100, height: 100 }),
    (doc) => {
      doc.layers.below = { id: "below", kind: "drawing", zIndex: "Zz" };
      doc.layers.above = { id: "above", kind: "drawing", zIndex: "a1" };
    },
  );
  const store = new DrawingStore({
    document: documentState,
    tools: [],
    shapeHandlers: registry,
  });
  const stack = createLayerStack({
    store,
    host: document.createElement("div"),
    hotCanvas: document.createElement("canvas"),
    shapeRendererRegistry: createKidsShapeRendererRegistry(),
    resolveImage: () => null,
  });
  const pixels = (source: CanvasImageSource | null) =>
    (source as HTMLCanvasElement).getContext("2d")!.getImageData(0, 0, 100, 100)
      .data;
  const center = (source: CanvasImageSource | null) => [
    ...(source as HTMLCanvasElement)
      .getContext("2d")!
      .getImageData(50, 50, 1, 1).data,
  ];
  const update = (color: string) => {
    store.applyDocument(
      change(clone(store.getDocument()), (doc) => {
        (doc.shapes.line as PenShape).style.stroke!.color = color;
      }),
    );
    stack.scheduleFullInvalidation();
  };
  try {
    stack.setLayers(getOrderedLayers(documentState));
    stack.setActiveLayer("default");
    stack.updateViewport(100, 100, 1);
    // The waiting stroke starts on an obsolete capture, then must retry the
    // current generation. All changes arrive before the bake queue settles.
    const pending = stack.beginActiveLayerDraftSession();
    for (let i = 0; i < 10; i++) update(i === 9 ? "#ff0000" : "#0000ff");
    await pending;
    const frozen = stack.getActiveLayerDraftComposite()!;
    expect(center(frozen.active)).toEqual([255, 0, 0, 255]);
    expect(frozen.below).not.toBeNull();
    expect(frozen.above).not.toBeNull();
    expect(perf.counters["composite.group.canvases"]).toBe(3);
    expect(perf.counters["tileRenderer.snapshot.canvases"]).toBe(3);
    expect(
      perf.counters["composite.capture.cancelledBeforeCopy"],
    ).toBeGreaterThanOrEqual(10);
    const frozenPixels = [...pixels(frozen.active)];

    perf.counters = {};
    for (let i = 0; i < 10; i++) update(i === 9 ? "#00ff00" : "#0000ff");
    await stack.flushBakes();
    expect(stack.getActiveLayerDraftComposite()).toBe(frozen);
    expect([...pixels(frozen.active)]).toEqual(frozenPixels);
    stack.endActiveLayerDraftSession();
    await stack.beginActiveLayerDraftSession();
    const next = stack.getActiveLayerDraftComposite()!;
    expect(center(next.active)).toEqual([0, 255, 0, 255]);
    expect(perf.counters["composite.group.canvases"]).toBe(3);
    expect(perf.counters["tileRenderer.snapshot.canvases"]).toBe(3);
    // Cancelling and starting again with unchanged content reuses the cache.
    stack.endActiveLayerDraftSession();
    await stack.beginActiveLayerDraftSession();
    expect(stack.getActiveLayerDraftComposite()).toBe(next);
    expect(perf.counters["composite.group.canvases"]).toBe(3);
  } finally {
    stack.dispose();
    global.__kidsDrawPerf = previousPerf;
    native.mockRestore();
  }
});
