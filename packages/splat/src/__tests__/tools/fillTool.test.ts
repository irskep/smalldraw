import { expect, spyOn, test } from "bun:test";
import { change } from "@automerge/automerge/slim";
import { createDocument, ToolRuntimeImpl, UndoManager } from "@smalldraw/core";
import { Vec2 } from "@smalldraw/geometry";
import { createKidsShapeRendererRegistry } from "../../render/kidsShapeRendererRegistry";
import { createKidsShapeHandlerRegistry } from "../../shapes/kidsShapeHandlers";
import { createFillTool } from "../../tools/fillTool";
import { useNativeCanvases } from "../rendering/nativeCanvasFixture";

for (const scenario of [
  "commit",
  "document-change",
  "layer-change",
  "deactivate",
] as const) {
  test(`pending fill: ${scenario}`, async () => {
    const native = useNativeCanvases();
    // PNG encoding is already covered by browser pixel probes; keep native backing pixels.
    const png = spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
      (() => "data:image/png;base64,test") as never,
    );
    const registry = createKidsShapeHandlerRegistry();
    let doc = createDocument(undefined, registry, { width: 64, height: 64 });
    let layer = "default";
    const undo = new UndoManager();
    const runtime = new ToolRuntimeImpl({
      toolId: "fill.basic",
      getDocument: () => doc,
      getActiveLayerId: () => layer,
      shapeHandlers: registry,
      commitAction(action) {
        doc = undo.apply(action, doc, {
          registry,
          change: (next, update) => change(next, update),
        });
      },
    });
    const subscriptions = spyOn(runtime, "on");
    const dispose = createFillTool({
      shapeRendererRegistry: createKidsShapeRendererRegistry(),
      workerUrl: new URL("../../tools/fillWorker.ts", import.meta.url),
    }).activate(runtime);
    try {
      // Await the real registered handler, including worker delivery, without timed polling.
      const down = subscriptions.mock.calls.find(
        ([event]) => event === "pointerDown",
      )![1];
      const result = down({ point: new Vec2(20, 20), buttons: 1 });
      if (scenario === "document-change")
        doc = change(doc, (draft) => {
          draft.temporalOrderCounter++;
        });
      if (scenario === "layer-change") layer = "another-layer";
      if (scenario === "deactivate") dispose?.();
      await result;
      expect(Object.values(doc.shapes)).toHaveLength(
        scenario === "commit" ? 1 : 0,
      );
      if (scenario === "commit")
        expect(Object.values(doc.shapes)[0].layerId).toBe("default");
    } finally {
      dispose?.();
      subscriptions.mockRestore();
      png.mockRestore();
      native.mockRestore();
    }
  });
}
