import { expect, test } from "bun:test";
import {
  change,
  clone,
  ImmutableString,
  merge,
} from "@automerge/automerge/slim";
import {
  type ActionContext,
  createDocument,
  DrawingStore,
  type PenShape,
} from "@smalldraw/core";
import { Vec2 } from "@smalldraw/geometry";
import { createKidsShapeHandlerRegistry } from "../shapes/kidsShapeHandlers";
import { createEraserTool, createMarkerTool } from "../tools/drawingTools";

const seed = (id: string): PenShape => ({
  id,
  type: "pen",
  layerId: "default",
  zIndex: "a0",
  temporalOrder: 0,
  geometry: {
    type: "pen-json",
    pointsJson: new ImmutableString("[[10,10],[40,10]]"),
    pointCount: 2,
  },
  style: {
    stroke: { type: "brush", brushId: "marker", size: 8, color: "#0000ff" },
  },
});

test.each(
  ["add", "delete", "clear", "undo-clear"].flatMap((mutation) =>
    ["commit", "cancel"].map((finish) => ({ mutation, finish })),
  ),
)("remote actor changes survive local stroke: %j", ({ mutation, finish }) => {
  const registry = createKidsShapeHandlerRegistry();
  let base = createDocument([seed("seed")], registry);
  if (mutation === "undo-clear")
    base = change(base, (doc) => {
      doc.shapes.remoteClear = {
        id: "remoteClear",
        type: "clear",
        layerId: "default",
        zIndex: "a2",
        temporalOrder: doc.temporalOrderCounter,
        geometry: { type: "clear" },
        style: {},
      };
      doc.temporalOrderCounter++;
    });
  let local = clone(base);
  let remote = clone(base);
  const ctx: ActionContext = {
    registry,
    change: (doc, update) => change(doc, update),
  };
  const tool = createMarkerTool();
  const store = new DrawingStore({
    document: local,
    tools: [tool, createEraserTool()],
    shapeHandlers: registry,
    actionDispatcher: (event) => {
      local =
        event.type === "undo"
          ? event.action.undo(local, ctx)
          : event.action.redo(local, ctx);
      store.applyDocument(local);
    },
  });
  store.activateTool(tool.id);
  store.dispatch("pointerDown", { point: new Vec2(20, 50), buttons: 1 });
  store.dispatch("pointerMove", { point: new Vec2(80, 50), buttons: 1 });
  const draft = store.getDrafts()[0];
  remote = change(remote, (doc) => {
    if (mutation === "undo-clear") delete doc.shapes.remoteClear;
    else if (mutation === "delete") delete doc.shapes.seed;
    else if (mutation === "add") doc.shapes.remote = seed("remote");
    else {
      doc.shapes.remoteClear = {
        id: "remoteClear",
        type: "clear",
        layerId: "default",
        zIndex: "a2",
        temporalOrder: doc.temporalOrderCounter,
        geometry: { type: "clear" },
        style: {},
      };
      doc.temporalOrderCounter++;
    }
  });
  local = merge(local, remote);
  store.applyDocument(local);
  expect(store.getDrafts()[0]).toBe(draft);
  if (finish === "commit")
    store.dispatch("pointerUp", { point: new Vec2(80, 50), buttons: 0 });
  else store.activateTool("eraser.basic");
  remote = merge(remote, local);
  expect(remote.shapes).toEqual(local.shapes);
  expect(store.getDrafts()).toHaveLength(0);
  const localShapes = Object.values(local.shapes).filter(
    (shape) => !["seed", "remote", "remoteClear"].includes(shape.id),
  );
  expect(localShapes).toHaveLength(finish === "commit" ? 1 : 0);
  if (mutation === "add") expect(remote.shapes.remote).toBeDefined();
  if (mutation === "delete") expect(remote.shapes.seed).toBeUndefined();
  if (mutation === "undo-clear") {
    expect(remote.shapes.remoteClear).toBeUndefined();
    if (finish === "commit")
      expect(store.getOrderedShapes().at(-1)?.id).toBe(localShapes[0].id);
  }
  if (mutation === "clear") {
    expect(remote.shapes.remoteClear).toBeDefined();
    expect(store.getOrderedShapes()).toHaveLength(finish === "commit" ? 1 : 0);
    if (finish === "commit")
      expect(localShapes[0].temporalOrder!).toBeGreaterThan(
        remote.shapes.remoteClear.temporalOrder!,
      );
  }
});
