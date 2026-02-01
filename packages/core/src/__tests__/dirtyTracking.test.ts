import { describe, expect, test } from "bun:test";
import { Vec2 } from "gl-matrix";
import {
  AddShape,
  CompositeAction,
  DeleteShape,
  UpdateShapeTransform,
  UpdateShapeZIndex,
} from "../actions";
import { DrawingStore } from "../store/drawingStore";

const v = (x = 0, y = x): [number, number] => [x, y];

function createTestShape(id: string) {
  return {
    id,
    type: "rect" as const,
    geometry: { type: "rect" as const, size: v(100, 50) },
    fill: { type: "solid" as const, color: "#ff0000" },
    zIndex: "a0",
    transform: {
      translation: v(0, 0),
      scale: v(1, 1),
      rotation: 0,
    },
  };
}

describe("Dirty tracking", () => {
  test("affectedShapeIds returns shape ID for AddShape", () => {
    const action = new AddShape(createTestShape("test-1"));
    expect(action.affectedShapeIds()).toEqual(["test-1"]);
  });

  test("affectedShapeIds returns shape ID for DeleteShape", () => {
    const action = new DeleteShape("test-1");
    expect(action.affectedShapeIds()).toEqual(["test-1"]);
  });

  test("affectedShapeIds returns shape ID for UpdateShapeTransform", () => {
    const action = new UpdateShapeTransform("test-1", {
      translation: v(100),
    });
    expect(action.affectedShapeIds()).toEqual(["test-1"]);
  });

  test("affectedShapeIds returns union for CompositeAction", () => {
    const action = new CompositeAction([
      new UpdateShapeTransform("shape-1", { translation: v(0) }),
      new UpdateShapeTransform("shape-2", { translation: v(0) }),
      new UpdateShapeTransform("shape-1", { translation: v(10) }),
    ]);
    const ids = action.affectedShapeIds();
    expect(ids.length).toBe(2);
    expect(ids).toContain("shape-1");
    expect(ids).toContain("shape-2");
  });

  test("consumeDirtyState returns dirty shape after mutateDocument", () => {
    const store = new DrawingStore({ tools: [] });
    store.mutateDocument(new AddShape(createTestShape("shape-1")));

    const state = store.consumeDirtyState();
    expect(state.dirty.has("shape-1")).toBe(true);
    expect(state.deleted.has("shape-1")).toBe(false);
  });

  test("consumeDirtyState returns deleted shape after DeleteShape", () => {
    const store = new DrawingStore({ tools: [] });
    store.mutateDocument(new AddShape(createTestShape("shape-1")));
    store.consumeDirtyState(); // Clear the add

    store.mutateDocument(new DeleteShape("shape-1"));
    const state = store.consumeDirtyState();
    expect(state.deleted.has("shape-1")).toBe(true);
    expect(state.dirty.has("shape-1")).toBe(false);
  });

  test("consumeDirtyState clears state after called", () => {
    const store = new DrawingStore({ tools: [] });
    store.mutateDocument(new AddShape(createTestShape("shape-1")));

    const state1 = store.consumeDirtyState();
    expect(state1.dirty.size).toBe(1);

    const state2 = store.consumeDirtyState();
    expect(state2.dirty.size).toBe(0);
    expect(state2.deleted.size).toBe(0);
  });

  test("undo tracks dirty state correctly", () => {
    const store = new DrawingStore({ tools: [] });
    store.mutateDocument(new AddShape(createTestShape("shape-1")));
    store.consumeDirtyState();

    store.undo();
    const state = store.consumeDirtyState();
    // After undoing AddShape, the shape is deleted
    expect(state.deleted.has("shape-1")).toBe(true);
  });

  test("redo tracks dirty state correctly", () => {
    const store = new DrawingStore({ tools: [] });
    store.mutateDocument(new AddShape(createTestShape("shape-1")));
    store.consumeDirtyState();

    store.undo();
    store.consumeDirtyState();

    store.redo();
    const state = store.consumeDirtyState();
    // After redoing AddShape, the shape is dirty (exists)
    expect(state.dirty.has("shape-1")).toBe(true);
  });

  test("multiple mutations accumulate in dirty state", () => {
    const store = new DrawingStore({ tools: [] });
    store.mutateDocument(new AddShape(createTestShape("shape-1")));
    store.mutateDocument(new AddShape(createTestShape("shape-2")));
    store.mutateDocument(
      new UpdateShapeTransform("shape-1", {
        translation: v(50),
      }),
    );

    const state = store.consumeDirtyState();
    expect(state.dirty.has("shape-1")).toBe(true);
    expect(state.dirty.has("shape-2")).toBe(true);
  });
});

describe("Ordered shapes caching", () => {
  test("getOrderedShapes returns shapes in zIndex order", () => {
    const store = new DrawingStore({ tools: [] });
    store.mutateDocument(
      new AddShape({ ...createTestShape("shape-1"), zIndex: "b0" }),
    );
    store.mutateDocument(
      new AddShape({ ...createTestShape("shape-2"), zIndex: "a0" }),
    );

    const ordered = store.getOrderedShapes();
    expect(ordered.length).toBe(2);
    expect(ordered[0].id).toBe("shape-2"); // 'a0' comes before 'b0'
    expect(ordered[1].id).toBe("shape-1");
  });

  test("getOrderedShapes returns cached result on second call", () => {
    const store = new DrawingStore({ tools: [] });
    store.mutateDocument(new AddShape(createTestShape("shape-1")));

    const ordered1 = store.getOrderedShapes();
    const ordered2 = store.getOrderedShapes();
    // Same array instance means cache was used
    expect(ordered1).toBe(ordered2);
  });

  test("cache is invalidated after AddShape", () => {
    const store = new DrawingStore({ tools: [] });
    store.mutateDocument(new AddShape(createTestShape("shape-1")));

    const ordered1 = store.getOrderedShapes();
    store.mutateDocument(new AddShape(createTestShape("shape-2")));
    const ordered2 = store.getOrderedShapes();

    expect(ordered1).not.toBe(ordered2);
    expect(ordered2.length).toBe(2);
  });

  test("cache is invalidated after DeleteShape", () => {
    const store = new DrawingStore({ tools: [] });
    store.mutateDocument(new AddShape(createTestShape("shape-1")));
    store.mutateDocument(new AddShape(createTestShape("shape-2")));

    const ordered1 = store.getOrderedShapes();
    store.mutateDocument(new DeleteShape("shape-1"));
    const ordered2 = store.getOrderedShapes();

    expect(ordered1).not.toBe(ordered2);
    expect(ordered2.length).toBe(1);
  });

  test("cache is invalidated after UpdateShapeZIndex", () => {
    const store = new DrawingStore({ tools: [] });
    store.mutateDocument(
      new AddShape({ ...createTestShape("shape-1"), zIndex: "a0" }),
    );
    store.mutateDocument(
      new AddShape({ ...createTestShape("shape-2"), zIndex: "b0" }),
    );

    const ordered1 = store.getOrderedShapes();
    expect(ordered1[0].id).toBe("shape-1");

    store.mutateDocument(new UpdateShapeZIndex("shape-1", "c0"));
    const ordered2 = store.getOrderedShapes();

    expect(ordered1).not.toBe(ordered2);
    expect(ordered2[0].id).toBe("shape-2"); // Now shape-2 comes first
    expect(ordered2[1].id).toBe("shape-1");
  });

  test("cache is NOT invalidated after UpdateShapeTransform", () => {
    const store = new DrawingStore({ tools: [] });
    store.mutateDocument(new AddShape(createTestShape("shape-1")));

    const ordered1 = store.getOrderedShapes();
    store.mutateDocument(
      new UpdateShapeTransform("shape-1", {
        translation: v(100),
      }),
    );
    const ordered2 = store.getOrderedShapes();

    // Same array instance means cache was reused
    expect(ordered1).toBe(ordered2);
  });
});
