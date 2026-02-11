import { describe, expect, test } from "bun:test";
import { change } from "@automerge/automerge/slim";
import { toVec2Like } from "@smalldraw/geometry";
import { getWorldPointsFromShape } from "@smalldraw/testing";
import { Vec2 } from "gl-matrix";
import type { ActionContext } from "../../actions";
import { AddShape } from "../../actions";
import { createDocument } from "../../model/document";
import { getDefaultShapeHandlerRegistry } from "../../model/shapeHandlers";
import type { BoxedGeometry, BoxedShape } from "../../model/shapes/boxedShape";
import {
  createPenJSONGeometry,
  type PenShape,
} from "../../model/shapes/penShape";
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
        const geometry: BoxedGeometry = {
          type: "boxed",
          kind: "rect",
          size: v(10, 10),
        };
        runtime.setDraft({
          toolId: runtime.toolId,
          temporary: true,
          id: "draft-1",
          type: "boxed",
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

function createPreviewTool(preview: {
  min: [number, number];
  max: [number, number];
}): ToolDefinition {
  return {
    id: "preview-tool",
    label: "Preview Tool",
    activate(runtime) {
      runtime.setPreview({
        dirtyBounds: { min: preview.min, max: preview.max },
      });
      return () => {
        runtime.setPreview(null);
      };
    },
  };
}

function createStreamingPreviewTool(): ToolDefinition {
  return {
    id: "stream-preview-tool",
    label: "Stream Preview Tool",
    activate(runtime) {
      runtime.on("pointerDown", () => {
        runtime.setPreview({
          dirtyBounds: { min: v(0, 0), max: v(10, 10) },
        });
      });
      runtime.on("pointerMove", () => {
        runtime.setPreview({
          dirtyBounds: { min: v(90, 90), max: v(100, 100) },
        });
      });
      runtime.on("pointerUp", () => {
        runtime.setPreview(null);
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

function createPenTool(): ToolDefinition {
  return {
    id: "brush.freehand",
    label: "Pen",
    styleSupport: {
      strokeColor: true,
      strokeWidth: true,
      fillColor: false,
      transparentStrokeColor: false,
      transparentFillColor: false,
    },
    activate(runtime) {
      let points: Array<[number, number]> = [];
      let drawing = false;
      let draftId = "";
      runtime.on("pointerDown", (event) => {
        drawing = true;
        draftId = runtime.generateShapeId("pen-draft");
        points = [toVec2Like(event.point)];
        runtime.setDraft({
          toolId: runtime.toolId,
          temporary: true,
          id: draftId,
          type: "pen",
          geometry: createPenJSONGeometry(points),
          style: {
            stroke: {
              type: "brush",
              color: runtime.getSharedSettings().strokeColor,
              size: runtime.getSharedSettings().strokeWidth,
              brushId: "freehand",
              compositeOp: "source-over",
            },
          },
          zIndex: runtime.getNextZIndex(),
          interactions: { resizable: true, rotatable: false },
          transform: { translation: [0, 0], scale: [1, 1], rotation: 0 },
        });
      });
      runtime.on("pointerMove", (event) => {
        if (!drawing) return;
        points.push(toVec2Like(event.point));
        runtime.setDraft({
          toolId: runtime.toolId,
          temporary: true,
          id: draftId,
          type: "pen",
          geometry: createPenJSONGeometry(points),
          style: {
            stroke: {
              type: "brush",
              color: runtime.getSharedSettings().strokeColor,
              size: runtime.getSharedSettings().strokeWidth,
              brushId: "freehand",
              compositeOp: "source-over",
            },
          },
          zIndex: runtime.getNextZIndex(),
          interactions: { resizable: true, rotatable: false },
          transform: { translation: [0, 0], scale: [1, 1], rotation: 0 },
        });
      });
      runtime.on("pointerUp", () => {
        if (!drawing || points.length < 2) {
          drawing = false;
          runtime.clearDraft();
          return;
        }
        drawing = false;
        runtime.commit(
          new AddShape({
            id: runtime.generateShapeId("pen"),
            type: "pen",
            geometry: createPenJSONGeometry(points),
            style: {
              stroke: {
                type: "brush",
                color: runtime.getSharedSettings().strokeColor,
                size: runtime.getSharedSettings().strokeWidth,
                brushId: "freehand",
                compositeOp: "source-over",
              },
            },
            zIndex: runtime.getNextZIndex(),
            interactions: { resizable: true, rotatable: false },
            transform: { translation: [0, 0], scale: [1, 1], rotation: 0 },
          } as PenShape),
        );
        runtime.clearDraft();
      });
      return () => {
        drawing = false;
        points = [];
        runtime.clearDraft();
      };
    },
  };
}

function createRectangleTool(): ToolDefinition {
  return {
    id: "rect",
    label: "Rectangle",
    styleSupport: {
      strokeColor: true,
      strokeWidth: true,
      fillColor: true,
      transparentStrokeColor: true,
      transparentFillColor: true,
    },
    activate(runtime) {
      let start: [number, number] | null = null;
      runtime.on("pointerDown", (event) => {
        start = toVec2Like(event.point);
      });
      runtime.on("pointerMove", (event) => {
        if (!start) return;
        const current = toVec2Like(event.point);
        const minX = Math.min(start[0], current[0]);
        const minY = Math.min(start[1], current[1]);
        const maxX = Math.max(start[0], current[0]);
        const maxY = Math.max(start[1], current[1]);
        const width = maxX - minX;
        const height = maxY - minY;
        runtime.setDraft({
          toolId: runtime.toolId,
          temporary: true,
          id: runtime.generateShapeId("rect-draft"),
          type: "boxed",
          geometry: {
            type: "boxed",
            kind: "rect",
            size: [width, height],
          } as BoxedGeometry,
          style: {
            stroke: {
              type: "brush",
              color: runtime.getSharedSettings().strokeColor,
              size: runtime.getSharedSettings().strokeWidth,
              compositeOp: "source-over",
            },
            fill: {
              type: "solid",
              color: runtime.getSharedSettings().fillColor,
            },
          },
          zIndex: runtime.getNextZIndex(),
          interactions: { resizable: true, rotatable: true },
          transform: {
            translation: [minX + width / 2, minY + height / 2],
            scale: [1, 1],
            rotation: 0,
          },
        });
      });
      runtime.on("pointerUp", (event) => {
        if (!start) return;
        const end = toVec2Like(event.point);
        const minX = Math.min(start[0], end[0]);
        const minY = Math.min(start[1], end[1]);
        const maxX = Math.max(start[0], end[0]);
        const maxY = Math.max(start[1], end[1]);
        const width = maxX - minX;
        const height = maxY - minY;
        start = null;
        if (width === 0 && height === 0) {
          runtime.clearDraft();
          return;
        }
        runtime.commit(
          new AddShape({
            id: runtime.generateShapeId("rect"),
            type: "boxed",
            geometry: { type: "boxed", kind: "rect", size: [width, height] },
            style: {
              stroke: {
                type: "brush",
                color: runtime.getSharedSettings().strokeColor,
                size: runtime.getSharedSettings().strokeWidth,
                compositeOp: "source-over",
              },
              fill: {
                type: "solid",
                color: runtime.getSharedSettings().fillColor,
              },
            },
            zIndex: runtime.getNextZIndex(),
            interactions: { resizable: true, rotatable: true },
            transform: {
              translation: [minX + width / 2, minY + height / 2],
              scale: [1, 1],
              rotation: 0,
            },
          } as BoxedShape),
        );
        runtime.clearDraft();
      });
      return () => {
        start = null;
        runtime.clearDraft();
      };
    },
  };
}

describe("DrawingStore", () => {
  const expectPointListClose = (
    actual: Array<[number, number]>,
    expected: Array<[number, number]>,
  ) => {
    expect(actual).toHaveLength(expected.length);
    for (let index = 0; index < expected.length; index += 1) {
      const actualPoint = actual[index];
      const expectedPoint = expected[index];
      expect(actualPoint?.[0]).toBeCloseTo(expectedPoint[0], 4);
      expect(actualPoint?.[1]).toBeCloseTo(expectedPoint[1], 4);
    }
  };

  test("activating pen tool and dispatching pointer events commits shapes", () => {
    const store = new DrawingStore({ tools: [createPenTool()] });
    store.activateTool("brush.freehand");
    store.dispatch("pointerDown", { point: new Vec2(0, 0), buttons: 1 });
    store.dispatch("pointerMove", { point: new Vec2(5, 5), buttons: 1 });
    store.dispatch("pointerUp", { point: new Vec2(5, 5), buttons: 0 });

    const shapes = Object.values(store.getDocument().shapes) as PenShape[];
    expect(shapes).toHaveLength(1);
    const shape = shapes[0];
    expect(shape.geometry.type).toBe("pen-json");
    const worldPoints = getWorldPointsFromShape(shape);
    expect(worldPoints).toHaveLength(2);
    expect(worldPoints[0]?.[0]).toBeCloseTo(0, 3);
    expect(worldPoints[0]?.[1]).toBeCloseTo(0, 3);
    expect(worldPoints[1]?.[0]).toBeCloseTo(5, 3);
    expect(worldPoints[1]?.[1]).toBeCloseTo(5, 3);
  });

  test("store aggregates drafts from multiple tools", () => {
    const store = new DrawingStore({
      tools: [createDraftTool(), createPenTool()],
    });
    store.activateTool("draft-tool");
    store.dispatch("pointerDown", { point: new Vec2(10, 10), buttons: 1 });

    expect(store.getDrafts()).toHaveLength(1);
    expect(store.getDrafts()[0].geometry as BoxedGeometry).toEqual({
      type: "boxed",
      kind: "rect",
      size: v(10, 10),
    });

    store.activateTool("brush.freehand");
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
    store.activateTool("brush.freehand");
    store.dispatch("pointerDown", { point: new Vec2(0, 0), buttons: 1 });
    store.dispatch("pointerMove", { point: new Vec2(5, 5), buttons: 1 });
    store.dispatch("pointerUp", { point: new Vec2(5, 5), buttons: 0 });

    store.activateTool("rect");
    store.dispatch("pointerDown", { point: new Vec2(10, 10), buttons: 1 });
    store.dispatch("pointerMove", { point: new Vec2(20, 25), buttons: 1 });
    store.dispatch("pointerUp", { point: new Vec2(20, 25), buttons: 0 });

    const shapes = Object.values(store.getDocument().shapes) as (
      | PenShape
      | BoxedShape
    )[];
    const penShape = shapes.find((shape) => shape.geometry.type === "pen-json");
    const boxedShape = shapes.find(
      (shape) =>
        shape.geometry.type === "boxed" && shape.geometry.kind === "rect",
    );
    expect(penShape?.interactions?.resizable).toBe(true);
    expect(boxedShape?.interactions?.resizable).toBe(true);
  });

  test("selection frame updates can be read from store", () => {
    const registry = getDefaultShapeHandlerRegistry();
    const doc = createDocument(
      [
        {
          id: "rect-frame",
          type: "boxed",
          geometry: { type: "boxed", kind: "rect", size: v(10, 10) },
          style: {},
          zIndex: "frame",
          interactions: { resizable: true, rotatable: true },
          transform: {
            translation: v(5, 5),
            rotation: 0,
            scale: v(1, 1),
          },
        } as BoxedShape,
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
          type: "boxed",
          geometry: { type: "boxed", kind: "rect", size: v(10, 10) },
          style: {},
          zIndex: "a",
          interactions: { resizable: true, rotatable: true },
          transform: {
            translation: v(0, 0),
            rotation: 0,
            scale: v(1, 1),
          },
        } as BoxedShape,
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

    store.activateTool("brush.freehand");
    expect(store.getHandles()).toEqual([]);
    expect(store.getHandleHover()).toEqual({ handleId: null, behavior: null });
  });

  test("shared settings helpers update global state", () => {
    const store = new DrawingStore({ tools: [createPenTool()] });
    expect(store.getSharedSettings().strokeWidth).toBe(2);
    store.updateSharedSettings({ strokeWidth: 10 });
    expect(store.getSharedSettings().strokeWidth).toBe(10);
  });

  test("store exposes active tool preview and clears on switch", () => {
    const store = new DrawingStore({
      tools: [
        createPreviewTool({ min: v(1, 2), max: v(3, 4) }),
        createPenTool(),
      ],
    });
    store.activateTool("preview-tool");
    const preview = store.getPreview();
    expect(preview?.dirtyBounds).toBeDefined();
    expect(preview?.dirtyBounds?.min[0]).toBe(1);
    expect(preview?.dirtyBounds?.min[1]).toBe(2);
    expect(preview?.dirtyBounds?.max[0]).toBe(3);
    expect(preview?.dirtyBounds?.max[1]).toBe(4);
    store.activateTool("brush.freehand");
    expect(store.getPreview()).toBeNull();
  });

  test("store accumulates preview dirty bounds until consumed", () => {
    const store = new DrawingStore({
      tools: [createStreamingPreviewTool()],
    });
    store.activateTool("stream-preview-tool");

    store.dispatch("pointerDown", { point: new Vec2(0, 0), buttons: 1 });
    store.dispatch("pointerMove", { point: new Vec2(100, 100), buttons: 1 });

    const preview = store.getPreview();
    expect(preview?.dirtyBounds).toBeDefined();
    expect(preview?.dirtyBounds?.min[0]).toBe(0);
    expect(preview?.dirtyBounds?.min[1]).toBe(0);
    expect(preview?.dirtyBounds?.max[0]).toBe(100);
    expect(preview?.dirtyBounds?.max[1]).toBe(100);
    const consumed = store.consumePreview();
    expect(consumed?.dirtyBounds).toBeDefined();
    expect(consumed?.dirtyBounds?.min[0]).toBe(0);
    expect(consumed?.dirtyBounds?.min[1]).toBe(0);
    expect(consumed?.dirtyBounds?.max[0]).toBe(100);
    expect(consumed?.dirtyBounds?.max[1]).toBe(100);
    expect(store.getPreview()).toBeNull();

    store.dispatch("pointerMove", { point: new Vec2(100, 100), buttons: 1 });
    const moved = store.consumePreview();
    expect(moved?.dirtyBounds).toBeDefined();
    expect(moved?.dirtyBounds?.min[0]).toBe(90);
    expect(moved?.dirtyBounds?.min[1]).toBe(90);
    expect(moved?.dirtyBounds?.max[0]).toBe(100);
    expect(moved?.dirtyBounds?.max[1]).toBe(100);

    store.dispatch("pointerUp", { point: new Vec2(100, 100), buttons: 0 });
    expect(store.consumePreview()).toBeNull();
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
    const makeRect = (id: string, zIndex: string): BoxedShape => ({
      id,
      type: "boxed",
      geometry: { type: "boxed", kind: "rect", size: v(10, 10) },
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
    expect(store.canUndo()).toBe(true);
  });

  test("actionDispatcher mode triggers render updates for history changes", () => {
    const registry = getDefaultShapeHandlerRegistry();
    const ctx: ActionContext = {
      registry,
      change: (next, update) => change(next, update),
    };
    let externalDoc = createDocument(undefined, registry);
    let renderCount = 0;

    const store = new DrawingStore({
      tools: [createRectangleTool()],
      document: externalDoc,
      onRenderNeeded: () => {
        renderCount += 1;
      },
      actionDispatcher: (event) => {
        if (event.type === "undo") {
          externalDoc = event.action.undo(externalDoc, ctx);
        } else {
          externalDoc = event.action.redo(externalDoc, ctx);
        }
        store.applyDocument(externalDoc);
      },
    });

    const zIndex = getZIndexBetween(null, null);
    store.applyAction(
      new AddShape({
        id: "shape-1",
        type: "boxed",
        geometry: { type: "boxed", kind: "rect", size: v(10, 10) },
        style: { fill: { type: "solid", color: "#fff" } },
        zIndex,
        transform: { translation: v(0, 0), scale: v(1, 1), rotation: 0 },
      } as BoxedShape),
    );
    expect(store.canUndo()).toBe(true);

    store.undo();
    expect(store.canRedo()).toBe(true);

    store.redo();
    expect(store.canUndo()).toBe(true);
    expect(renderCount).toBeGreaterThan(0);
  });

  test("resetToDocument replaces document and clears undo/redo history", () => {
    const store = new DrawingStore({ tools: [createRectangleTool()] });
    store.activateTool("rect");
    store.dispatch("pointerDown", { point: new Vec2(0, 0), buttons: 1 });
    store.dispatch("pointerMove", { point: new Vec2(10, 10), buttons: 1 });
    store.dispatch("pointerUp", { point: new Vec2(10, 10), buttons: 0 });

    expect(store.canUndo()).toBe(true);
    expect(Object.keys(store.getDocument().shapes)).toHaveLength(1);

    const freshDoc = createDocument(
      undefined,
      getDefaultShapeHandlerRegistry(),
    );
    store.resetToDocument(freshDoc);

    expect(Object.keys(store.getDocument().shapes)).toHaveLength(0);
    expect(store.canUndo()).toBe(false);
    expect(store.canRedo()).toBe(false);
  });

  test("batched pointer move dispatch matches sequential stroke geometry", () => {
    const sequentialStore = new DrawingStore({ tools: [createPenTool()] });
    sequentialStore.activateTool("brush.freehand");
    sequentialStore.dispatch("pointerDown", {
      point: new Vec2(0, 0),
      buttons: 1,
    });
    sequentialStore.dispatch("pointerMove", {
      point: new Vec2(5, 4),
      buttons: 1,
    });
    sequentialStore.dispatch("pointerMove", {
      point: new Vec2(12, 10),
      buttons: 1,
    });
    sequentialStore.dispatch("pointerMove", {
      point: new Vec2(20, 17),
      buttons: 1,
    });
    sequentialStore.dispatch("pointerUp", {
      point: new Vec2(20, 17),
      buttons: 0,
    });

    const batchedStore = new DrawingStore({ tools: [createPenTool()] });
    batchedStore.activateTool("brush.freehand");
    batchedStore.dispatch("pointerDown", { point: new Vec2(0, 0), buttons: 1 });
    batchedStore.dispatchBatch("pointerMove", [
      { point: new Vec2(5, 4), buttons: 1 },
      { point: new Vec2(12, 10), buttons: 1 },
      { point: new Vec2(20, 17), buttons: 1 },
    ]);
    batchedStore.dispatch("pointerUp", { point: new Vec2(20, 17), buttons: 0 });

    const sequentialShape = Object.values(
      sequentialStore.getDocument().shapes,
    )[0] as PenShape;
    const batchedShape = Object.values(
      batchedStore.getDocument().shapes,
    )[0] as PenShape;
    expectPointListClose(
      getWorldPointsFromShape(batchedShape),
      getWorldPointsFromShape(sequentialShape),
    );
  });

  test("batched pointer move dispatch preserves sample order", () => {
    const store = new DrawingStore({ tools: [createPenTool()] });
    store.activateTool("brush.freehand");
    store.dispatch("pointerDown", { point: new Vec2(0, 0), buttons: 1 });
    store.dispatchBatch("pointerMove", [
      { point: new Vec2(10, 0), buttons: 1 },
      { point: new Vec2(20, 5), buttons: 1 },
      { point: new Vec2(30, 15), buttons: 1 },
    ]);
    store.dispatch("pointerUp", { point: new Vec2(30, 15), buttons: 0 });

    const shape = Object.values(store.getDocument().shapes)[0] as PenShape;
    expectPointListClose(getWorldPointsFromShape(shape), [
      [0, 0],
      [10, 0],
      [20, 5],
      [30, 15],
    ]);
  });
});
