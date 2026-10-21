import { expect, test } from "bun:test";

import { Repo } from "@automerge/automerge-repo/slim";
import { ImmutableString } from "@automerge/automerge/slim";
import {
  createAutomergeStoreAdapter,
  createDocument,
  type DrawingDocumentData,
  DrawingStore,
  getOrderedLayers,
  type PenShape,
} from "@smalldraw/core";
import { Vec2 } from "@smalldraw/geometry";

import { createRasterPipeline } from "../../render/createRasterPipeline";
import { createKidsShapeRendererRegistry } from "../../render/kidsShapeRendererRegistry";
import { createKidsShapeHandlerRegistry } from "../../shapes/kidsShapeHandlers";
import { createEraserTool, createMarkerTool } from "../../tools/drawingTools";
import { KidsDrawStageView } from "../../view/KidsDrawStage";
import {
  ControlledNetwork,
  documentMatches,
} from "../helpers/controlledNetwork";
import { useNativeCanvases } from "./nativeCanvasFixture";

const stroke = (
  id: string,
  layerId: string,
  color: string,
  y: number,
): PenShape => ({
  id,
  type: "pen",
  layerId,
  zIndex: "a0",
  temporalOrder: 0,
  geometry: {
    type: "pen-json",
    pointsJson: new ImmutableString(
      JSON.stringify([
        [20, y],
        [180, y],
      ]),
    ),
    pointCount: 2,
  },
  style: { stroke: { type: "brush", brushId: "marker", size: 20, color } },
});

// Mirror createKidsDrawApp + createDocumentSessionController: the store dispatches
// through the real adapter, whose handle subscription applies synced documents.
// Repo owns CRDT sync; only the transport is controlled. Native canvas pixels
// verify the production pipeline's frozen scene and post-stroke handoff.
async function fixture() {
  const native = useNativeCanvases();
  const registry = createKidsShapeHandlerRegistry();
  const a = new ControlledNetwork();
  const b = new ControlledNetwork();
  const localRepo = new Repo({ network: [a] });
  const remoteRepo = new Repo({ network: [b] });
  const initial = JSON.parse(
    JSON.stringify(
      createDocument(
        [
          stroke("blue", "default", "#0000ff", 40),
          stroke("underDraft", "default", "#0000ff", 100),
          stroke("red", "upper", "#ff0000", 40),
        ],
        registry,
        { width: 200, height: 140 },
      ),
    ),
  ) as DrawingDocumentData;
  initial.layers.upper = { id: "upper", kind: "drawing", zIndex: "a1" };
  const local = localRepo.create(initial);
  await Promise.all([a.connected, b.connected]);
  a.goOnline(b);
  const remote = await remoteRepo.find<DrawingDocumentData>(local.url);
  await remote.whenReady();
  const adapter = createAutomergeStoreAdapter({ handle: local, registry });
  const store = new DrawingStore({
    document: adapter.getDoc(),
    tools: [createMarkerTool(), createEraserTool()],
    shapeHandlers: registry,
    actionDispatcher: (event) => adapter.applyAction(event),
  });
  const unsubscribe = adapter.subscribe((doc) => store.applyDocument(doc));
  const stage = new KidsDrawStageView({
    width: 200,
    height: 140,
    backgroundColor: "white",
    uiIntentStore: { publish() {} },
  });
  const pipeline = createRasterPipeline({
    store,
    stage,
    shapeRendererRegistry: createKidsShapeRendererRegistry(),
    width: 200,
    height: 140,
    backgroundColor: "white",
    tilePixelRatio: 1,
    renderIdentity: "multiplayer-test",
  });
  pipeline.setLayers(getOrderedLayers(store.getDocument()));
  pipeline.updateViewport(200, 140);
  pipeline.scheduleBakeForClear();
  await pipeline.flushBakes();
  store.activateTool("brush.marker");
  store.updateSharedSettings({ strokeColor: "#00aa00", strokeWidth: 12 });
  const settle = async () => {
    pipeline.render();
    await pipeline.flushBakes();
    // Capture and commit handoff continue via promises after the bake finishes.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    pipeline.render();
  };
  const pointer = (
    event: "pointerDown" | "pointerMove" | "pointerUp",
    x: number,
  ) => {
    store.dispatch(event, {
      point: new Vec2(x, 100),
      buttons: event === "pointerUp" ? 0 : 1,
    });
  };
  const pixel = (x: number, y: number) => {
    const output = document.createElement("canvas");
    output.width = output.height = 1;
    const ctx = output.getContext("2d")!;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 1, 1);
    for (const container of stage.tileLayer.children) {
      const element = container as HTMLElement;
      if (
        element.style.display === "none" ||
        element.style.visibility === "hidden"
      )
        continue;
      const canvases =
        element.tagName === "CANVAS"
          ? [element as HTMLCanvasElement]
          : [...element.querySelectorAll("canvas")];
      for (const canvas of canvases) {
        if (canvas.style.visibility === "hidden") continue;
        ctx.drawImage(canvas, x, y, 1, 1, 0, 0, 1, 1);
      }
    }
    return [...ctx.getImageData(0, 0, 1, 1).data];
  };
  return {
    a,
    b,
    local,
    remote,
    store,
    stage,
    pipeline,
    settle,
    pointer,
    pixel,
    async dispose() {
      unsubscribe();
      pipeline.dispose();
      store.activateTool("eraser.basic");
      store.activateTool("brush.marker");
      stage.destroy();
      await Promise.all([localRepo.shutdown(), remoteRepo.shutdown()]);
      native.mockRestore();
    },
  };
}

const mutations = ["reorder", "delete-other", "hide", "add"] as const;
for (const tool of ["brush.marker", "eraser.basic"])
  for (const mutation of mutations)
    for (const finish of ["commit", "cancel"] as const) {
      test(`remote layer ${mutation} during ${tool} draft (${finish})`, async () => {
        const f = await fixture();
        try {
          f.store.activateTool(tool);
          expect(f.pixel(100, 40)).toEqual([255, 0, 0, 255]);
          f.pointer("pointerDown", 40);
          f.pointer("pointerMove", 120);
          await f.settle();
          expect(f.stage.hotCanvas.style.visibility).toBe("");
          const frozen = [
            ...f.stage.hotCanvas.getContext("2d")!.getImageData(0, 0, 200, 70)
              .data,
          ];
          f.remote.change((doc) => {
            if (mutation === "reorder") doc.layers.upper.zIndex = "Zz";
            if (mutation === "delete-other") {
              delete doc.layers.upper;
              delete doc.shapes.red;
            }
            if (mutation === "hide") doc.layers.upper.visible = false;
            if (mutation === "add") {
              doc.layers.new = { id: "new", kind: "drawing", zIndex: "a2" };
              doc.shapes.green = stroke("green", "new", "#00aa00", 40);
            }
          });
          await documentMatches(f.local, (doc) =>
            mutation === "reorder"
              ? doc.layers.upper.zIndex === "Zz"
              : mutation === "delete-other"
                ? !doc.layers.upper
                : mutation === "hide"
                  ? doc.layers.upper.visible === false
                  : !!doc.layers.new,
          );
          await f.settle();
          expect([
            ...f.stage.hotCanvas.getContext("2d")!.getImageData(0, 0, 200, 70)
              .data,
          ]).toEqual(frozen);
          f.pointer("pointerMove", 160);
          await f.settle();
          expect([
            ...f.stage.hotCanvas.getContext("2d")!.getImageData(0, 0, 200, 70)
              .data,
          ]).toEqual(frozen);
          if (finish === "cancel")
            f.store.activateTool(
              tool === "brush.marker" ? "eraser.basic" : "brush.marker",
            );
          f.pointer("pointerUp", 160);
          f.pipeline.render();
          // Inspect the synchronous handoff before its bake promise resolves.
          for (const layer of f.stage.tileLayer.querySelectorAll<HTMLElement>(
            "[data-layer-id]",
          ))
            expect(layer.style.display).toBe("none");
          await f.settle();
          expect(f.stage.hotCanvas.style.visibility).toBe("hidden");
          if (mutation === "delete-other")
            expect(
              f.stage.tileLayer.querySelector('[data-layer-id="upper"]'),
            ).toBeNull();
          expect(f.pixel(100, 40)).toEqual(
            mutation === "add" ? [0, 170, 0, 255] : [0, 0, 255, 255],
          );
          expect(f.pixel(100, 100)).toEqual(
            finish === "commit"
              ? tool === "eraser.basic"
                ? [255, 255, 255, 255]
                : [0, 170, 0, 255]
              : [0, 0, 255, 255],
          );
          await documentMatches(
            f.remote,
            (doc) =>
              Object.keys(doc.shapes).length ===
              Object.keys(f.local.doc().shapes).length,
          );
          expect(f.remote.doc().shapes).toEqual(f.local.doc().shapes);
        } finally {
          await f.dispose();
        }
      });
    }

for (const tool of ["brush.marker", "eraser.basic"])
  test(`deleting the active layer cancels ${tool} and cannot commit an orphan stroke`, async () => {
    const f = await fixture();
    try {
      f.store.activateTool(tool);
      f.pointer("pointerDown", 40);
      f.pointer("pointerMove", 120);
      await f.settle();
      expect(f.store.getDrafts()).toHaveLength(1);
      f.remote.change((doc) => {
        delete doc.layers.default;
        delete doc.shapes.blue;
        delete doc.shapes.underDraft;
      });
      await documentMatches(f.local, (doc) => !doc.layers.default);
      expect(f.store.getDrafts()).toHaveLength(0);
      await f.settle();
      expect(f.stage.hotCanvas.style.visibility).toBe("hidden");
      f.pointer("pointerMove", 160);
      f.pointer("pointerUp", 160);
      await f.settle();
      expect(Object.keys(f.local.doc().shapes)).toEqual(["red"]);
      expect(
        f.stage.tileLayer.querySelector('[data-layer-id="default"]'),
      ).toBeNull();
      // The selected tool remains usable on the surviving layer.
      f.pointer("pointerDown", 40);
      f.pointer("pointerMove", 120);
      f.pointer("pointerUp", 120);
      await f.settle();
      await documentMatches(
        f.remote,
        (doc) => Object.keys(doc.shapes).length === 2,
      );
      expect(
        Object.values(f.remote.doc().shapes).every(
          (shape) => shape.layerId === "upper",
        ),
      ).toBe(true);
    } finally {
      await f.dispose();
    }
  });

for (const reconnect of ["during-draft", "after-commit"] as const)
  for (const tool of ["brush.marker", "eraser.basic"]) {
    test(`repeated disconnects preserve offline edits and ${tool} (${reconnect})`, async () => {
      const f = await fixture();
      try {
        f.store.activateTool(tool);
        for (let cycle = 0; cycle < 3; cycle++) {
          const remoteId = `offline-${cycle}`;
          const sent = f.a.sent + f.b.sent;
          f.a.goOffline();
          f.pointer("pointerDown", 40);
          f.pointer("pointerMove", 120);
          await f.settle();
          const frozen = [
            ...f.stage.hotCanvas.getContext("2d")!.getImageData(0, 0, 200, 70)
              .data,
          ];
          f.remote.change((doc) => {
            doc.shapes[remoteId] = stroke(remoteId, "default", "#aa00aa", 20);
            doc.layers.upper.visible = cycle % 2 === 1;
          });
          expect(f.local.doc().shapes[remoteId]).toBeUndefined();
          if (reconnect === "during-draft") {
            f.a.goOnline(f.b);
            await documentMatches(f.local, (doc) => !!doc.shapes[remoteId]);
            await f.settle();
            expect([
              ...f.stage.hotCanvas.getContext("2d")!.getImageData(0, 0, 200, 70)
                .data,
            ]).toEqual(frozen);
          }
          f.pointer("pointerMove", 160);
          f.pointer("pointerUp", 160);
          await f.settle();
          const ids = Object.keys(f.local.doc().shapes);
          if (reconnect === "after-commit") {
            expect(Object.keys(f.remote.doc().shapes).length).toBe(ids.length);
            expect(f.local.doc().shapes[remoteId]).toBeUndefined();
            f.a.goOnline(f.b);
            await documentMatches(f.local, (doc) => !!doc.shapes[remoteId]);
          }
          await documentMatches(
            f.remote,
            (doc) => Object.keys(doc.shapes).length === 3 + (cycle + 1) * 2,
          );
          await f.settle();
          expect(f.remote.doc().shapes).toEqual(f.local.doc().shapes);
          expect(f.remote.doc().layers).toEqual(f.local.doc().layers);
          // History remains local across reconnects: undo only our stroke, then
          // redo it, without losing the collaborator's independently added shape.
          const syncedCount = 3 + (cycle + 1) * 2;
          f.store.undo();
          await documentMatches(
            f.remote,
            (doc) => Object.keys(doc.shapes).length === syncedCount - 1,
          );
          expect(f.remote.doc().shapes[remoteId]).toBeDefined();
          f.store.redo();
          await documentMatches(
            f.remote,
            (doc) => Object.keys(doc.shapes).length === syncedCount,
          );
          expect(f.remote.doc().shapes).toEqual(f.local.doc().shapes);
          await f.settle();
          expect(f.a.sent + f.b.sent).toBeGreaterThan(sent);
          expect(f.pixel(100, 40)).toEqual(
            cycle % 2 === 1 ? [255, 0, 0, 255] : [0, 0, 255, 255],
          );
          expect(f.pixel(100, 100)).toEqual(
            tool === "eraser.basic" ? [255, 255, 255, 255] : [0, 170, 0, 255],
          );
        }
      } finally {
        await f.dispose();
      }
    });
  }
