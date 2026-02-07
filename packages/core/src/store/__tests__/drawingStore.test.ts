import { describe, expect, test } from "bun:test";
import { change } from "@automerge/automerge/slim";
import { toVec2Like } from "@smalldraw/geometry";
import { Vec2 } from "gl-matrix";
import type { ActionContext } from "../../actions";
import { AddShape } from "../../actions";
import { createDocument } from "../../model/document";
import { getDefaultShapeHandlerRegistry } from "../../model/shapeHandlers";
import type { PenShape } from "../../model/shapes/penShape";
import type { RectGeometry, RectShape } from "../../model/shapes/rectShape";
import { createPenTool } from "../../tools/pen";
import { createRectangleTool } from "../../tools/rectangle";
import { createSelectionTool as createSelectionDefinition } from "../../tools/selection";
import type { ToolDefinition } from "../../tools/types";
import { getZIndexBetween } from "../../zindex";
import { DrawingStore } from "../drawingStore";

const v = (x = 0, y = x): [number, number] => [x, y];

function createDraftTool(): ToolDefinition {
  return {
    id: "draft-tool",
    label: "Draft Tool",
    activate(runtime) {
      runtime.on("pointerDown", (event) => {
        const geometry: RectGeometry = {
          type: "rect",
          size: v(10, 10),
        };
        runtime.setDraft({
          toolId: runtime.toolId,
          temporary: true,
          id: "draft-1",
          type: "rect",
          geometry,
          zIndex: runtime.getNextZIndex(),
          style: { fill: { type: "solid", color: "#ff0000" } },
          transform: {
            translation: toVec2Like(event.point),
            scale: v(1, 1),
            rotation: 0,
          },
        });
      });
      return () => runtime.clearDraft();
    },
  };
}

function createSharedSettingsUpdater(): ToolDefinition {
  return {
    id: "settings-updater",
    label: "Settings Updater",
    activate(runtime) {
      runtime.on("pointerDown", () => {
        runtime.updateSharedSettings({ strokeWidth: 9 });
      });
    },
  };
}

function createSharedSettingsReader(record: { width: number }): ToolDefinition {
  return {
    id: "settings-reader",
    label: "Settings Reader",
    activate(runtime) {
      runtime.on("pointerDown", () => {
        record.width = runtime.getSharedSettings().strokeWidth;
      });
    },
  };
}

function createSelectionSetterTool(record: {
  selectionSize: number;
}): ToolDefinition {
  return {
    id: "selection-tool",
    label: "Selection Tool",
    activate(runtime) {
      runtime.on("pointerDown", () => {
        runtime.setSelection(["a", "b"]);
        record.selectionSize = runtime.getSelection().ids.size;
      });
    },
  };
}

function createRuntimeSelectionTool(selectionIds: string[]): ToolDefinition {
  const selectionDef = createSelectionDefinition();
  return {
    id: "selection",
    label: "Selection",
    activate(runtime) {
      runtime.setSelection(selectionIds);
      return selectionDef.activate(runtime);
    },
  };
}

describe("DrawingStore", () => {
  test("activating pen tool and dispatching pointer events commits shapes", () => {
    const store = new DrawingStore({ tools: [createPenTool()] });
    store.activateTool("pen");
    store.dispatch("pointerDown", { point: new Vec2(0, 0), buttons: 1 });
    store.dispatch("pointerMove", { point: new Vec2(5, 5), buttons: 1 });
    store.dispatch("pointerUp", { point: new Vec2(5, 5), buttons: 0 });

    const shapes = Object.values(store.getDocument().shapes) as PenShape[];
    expect(shapes).toHaveLength(1);
    expect(shapes[0].geometry).toEqual({
      type: "pen",
      points: [v(-2.5, -2.5), v(2.5, 2.5)],
    });
    expect(shapes[0].transform?.translation).toEqual(v(2.5, 2.5));
  });

  test("store aggregates drafts from multiple tools", () => {
    const store = new DrawingStore({
      tools: [createDraftTool(), createPenTool()],
    });
    store.activateTool("draft-tool");
    store.dispatch("pointerDown", { point: new Vec2(10, 10), buttons: 1 });

    expect(store.getDrafts()).toHaveLength(1);
    expect(store.getDrafts()[0].geometry as RectGeometry).toEqual({
      type: "rect",
      size: v(10, 10),
    });

    store.activateTool("pen");
    expect(store.getDrafts()).toEqual([]);
  });

  test("shared settings updates persist across tools", () => {
    const record = { width: 0 };
    const store = new DrawingStore({
      tools: [
        createSharedSettingsUpdater(),
        createSharedSettingsReader(record),
      ],
    });
    store.activateTool("settings-updater");
    store.dispatch("pointerDown", { point: new Vec2(0, 0), buttons: 1 });

    store.activateTool("settings-reader");
    store.dispatch("pointerDown", { point: new Vec2(1, 1), buttons: 1 });
    expect(record.width).toBe(9);
  });

  test("selection state is shared across runtimes", () => {
    const record = { selectionSize: 0 };
    const store = new DrawingStore({
      tools: [createSelectionSetterTool(record)],
    });
    store.activateTool("selection-tool");
    store.dispatch("pointerDown", { point: new Vec2(0, 0), buttons: 1 });
    expect(record.selectionSize).toBe(2);
  });

  test("rectangle and pen shapes record resizable interactions", () => {
    const store = new DrawingStore({
      tools: [createPenTool(), createRectangleTool()],
    });
    store.activateTool("pen");
    store.dispatch("pointerDown", { point: new Vec2(0, 0), buttons: 1 });
    store.dispatch("pointerMove", { point: new Vec2(5, 5), buttons: 1 });
    store.dispatch("pointerUp", { point: new Vec2(5, 5), buttons: 0 });

    store.activateTool("rect");
    store.dispatch("pointerDown", { point: new Vec2(10, 10), buttons: 1 });
    store.dispatch("pointerMove", { point: new Vec2(20, 25), buttons: 1 });
    store.dispatch("pointerUp", { point: new Vec2(20, 25), buttons: 0 });

    const shapes = Object.values(store.getDocument().shapes) as (
      | PenShape
      | RectShape
    )[];
    const penShape = shapes.find((shape) => shape.geometry.type === "pen");
    const rectShape = shapes.find((shape) => shape.geometry.type === "rect");
    expect(penShape?.interactions?.resizable).toBe(true);
    expect(rectShape?.interactions?.resizable).toBe(true);
  });

  test("selection frame updates can be read from store", () => {
    const registry = getDefaultShapeHandlerRegistry();
    const doc = createDocument(
      [
        {
          id: "rect-frame",
          type: "rect",
          geometry: { type: "rect", size: v(10, 10) },
          style: {},
          zIndex: "frame",
          interactions: { resizable: true, rotatable: true },
          transform: {
            translation: v(5, 5),
            rotation: 0,
            scale: v(1, 1),
          },
        } as RectShape,
      ],
      registry,
    );
    const store = new DrawingStore({
      document: doc,
      tools: [createRuntimeSelectionTool(["rect-frame"])],
    });
    store.activateTool("selection");
    expect(store.getSelectionFrame()).toBeNull();

    store.dispatch("pointerDown", { point: new Vec2(0, 0), buttons: 1 });
    store.dispatch("pointerMove", { point: new Vec2(5, 5), buttons: 1 });
    expect(store.getSelectionFrame()).toEqual({
      min: new Vec2(5, 5),
      max: new Vec2(15, 15),
    });
  });

  test("store exposes handles and hover events for selection tool", () => {
    const registry = getDefaultShapeHandlerRegistry();
    const doc = createDocument(
      [
        {
          id: "rect",
          type: "rect",
          geometry: { type: "rect", size: v(10, 10) },
          style: {},
          zIndex: "a",
          interactions: { resizable: true, rotatable: true },
          transform: {
            translation: v(0, 0),
            rotation: 0,
            scale: v(1, 1),
          },
        } as RectShape,
      ],
      registry,
    );
    const store = new DrawingStore({
      document: doc,
      tools: [createRuntimeSelectionTool(["rect"]), createPenTool()],
    });
    store.activateTool("selection");
    expect(store.getHandles().length).toBeGreaterThan(0);

    store.dispatch("pointerMove", {
      point: new Vec2(0, 0),
      buttons: 0,
      handleId: "top-left",
      shiftKey: true,
    });
    expect(store.getHandleHover()).toEqual({
      handleId: "top-left",
      behavior: { type: "resize", proportional: true },
    });

    store.dispatch("pointerMove", { point: new Vec2(5, 5), buttons: 0 });
    expect(store.getHandleHover()).toEqual({ handleId: null, behavior: null });

    store.activateTool("pen");
    expect(store.getHandles()).toEqual([]);
    expect(store.getHandleHover()).toEqual({ handleId: null, behavior: null });
  });

  test("shared settings helpers update global state", () => {
    const store = new DrawingStore({ tools: [createPenTool()] });
    expect(store.getSharedSettings().strokeWidth).toBe(2);
    store.updateSharedSettings({ strokeWidth: 10 });
    expect(store.getSharedSettings().strokeWidth).toBe(10);
  });

  test("selection helpers manage ids consistently", () => {
    const store = new DrawingStore({ tools: [createPenTool()] });
    store.setSelection(["a", "b"]);
    expect(store.getSelection().ids.has("a")).toBe(true);
    store.toggleSelection("b");
    expect(store.getSelection().ids.has("b")).toBe(false);
    store.clearSelection();
    expect(store.getSelection().ids.size).toBe(0);
  });

  test("undo and redo proxies work through store helpers", () => {
    const store = new DrawingStore({ tools: [createRectangleTool()] });
    store.activateTool("rect");
    store.dispatch("pointerDown", { point: new Vec2(0, 0), buttons: 1 });
    store.dispatch("pointerMove", { point: new Vec2(20, 20), buttons: 1 });
    store.dispatch("pointerUp", { point: new Vec2(20, 20), buttons: 0 });
    expect(Object.values(store.getDocument().shapes)).toHaveLength(1);
    expect(store.canUndo()).toBe(true);
    expect(store.canRedo()).toBe(false);
    store.undo();
    expect(Object.values(store.getDocument().shapes)).toHaveLength(0);
    expect(store.canRedo()).toBe(true);
    store.redo();
    expect(Object.values(store.getDocument().shapes)).toHaveLength(1);
  });

  test("actionDispatcher updates preserve existing shapes", () => {
    const registry = getDefaultShapeHandlerRegistry();
    const ctx: ActionContext = {
      registry,
      change: (next, update) => change(next, update),
    };
    const makeRect = (id: string, zIndex: string): RectShape => ({
      id,
      type: "rect",
      geometry: { type: "rect", size: v(10, 10) },
      style: { fill: { type: "solid", color: "#ffffff" } },
      zIndex,
      transform: { translation: v(0, 0), scale: v(1, 1), rotation: 0 },
    });
    let externalDoc = createDocument(undefined, registry);
    const firstZ = getZIndexBetween(null, null);
    const secondZ = getZIndexBetween(firstZ, null);
    externalDoc = new AddShape(makeRect("rect-1", firstZ)).redo(
      externalDoc,
      ctx,
    );
    externalDoc = new AddShape(makeRect("rect-2", secondZ)).redo(
      externalDoc,
      ctx,
    );

    const store = new DrawingStore({
      tools: [createRectangleTool()],
      document: externalDoc,
      actionDispatcher: (event) => {
        if (event.type === "undo") {
          externalDoc = event.action.undo(externalDoc, ctx);
        } else {
          externalDoc = event.action.redo(externalDoc, ctx);
        }
        store.applyDocument(externalDoc);
      },
    });

    store.activateTool("rect");
    store.dispatch("pointerDown", { point: new Vec2(0, 0), buttons: 1 });
    store.dispatch("pointerMove", { point: new Vec2(10, 10), buttons: 1 });
    store.dispatch("pointerUp", { point: new Vec2(10, 10), buttons: 0 });

    const shapes = store.getDocument().shapes;
    expect(Object.keys(shapes)).toHaveLength(3);
    expect(shapes["rect-1"]).toBeDefined();
    expect(shapes["rect-2"]).toBeDefined();
  });
});
