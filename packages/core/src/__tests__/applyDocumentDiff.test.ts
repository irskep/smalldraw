import { describe, expect, test } from "bun:test";
import { change, clone } from "@automerge/automerge/slim";
import { AddShape } from "../actions";
import {
  createDocument,
  type DrawingDocument,
  getDefaultShapeHandlerRegistry,
} from "../index";
import { DrawingStore } from "../store/drawingStore";

const registry = getDefaultShapeHandlerRegistry();

function v(x = 0, y = x): [number, number] {
  return [x, y];
}

function createTestShape(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    type: "boxed" as const,
    geometry: { type: "boxed" as const, kind: "rect", size: v(100, 50) },
    style: { fill: { type: "solid" as const, color: "#ff0000" } },
    zIndex: "a0",
    layerId: "default",
    transform: {
      translation: v(0, 0),
      scale: v(1, 1),
      rotation: 0,
    },
    ...overrides,
  };
}

function updateDocument(
  doc: DrawingDocument,
  update: Parameters<typeof change<DrawingDocument>>[1],
): DrawingDocument {
  return change(clone(doc), update);
}

describe("applyDocument diff integration", () => {
  test("applying the identical document produces an all-empty diff", () => {
    const doc = createDocument([createTestShape("shape-1")], registry);
    const store = new DrawingStore({ tools: [], document: doc });

    store.applyDocument(store.getDocument());

    const diff = store.consumeApplyDocumentDiff();
    expect(diff?.added.size).toBe(0);
    expect(diff?.removed.size).toBe(0);
    expect(diff?.changed.size).toBe(0);
    expect(diff?.zOrderChangedLayers.size).toBe(0);
    expect(diff?.requiresFullInvalidation).toBe(false);
  });

  test("remote move produces a changed-only diff and no shape-ID dirty state", () => {
    const originalShape = createTestShape("shape-1");
    const doc1 = createDocument([originalShape], registry);
    const doc2 = updateDocument(doc1, (draft) => {
      draft.shapes["shape-1"] = createTestShape("shape-1", {
        transform: { translation: v(50, 0), scale: v(1, 1), rotation: 0 },
      });
    });
    const store = new DrawingStore({ tools: [], document: doc1 });

    store.applyDocument(doc2);

    const dirtyState = store.consumeDirtyStateByLayer();
    expect(dirtyState.dirtyByLayer.size).toBe(0);
    expect(dirtyState.deletedByLayer.size).toBe(0);
    const diff = store.consumeApplyDocumentDiff();
    expect(diff?.changed).toEqual(new Set(["shape-1"]));
    expect(diff?.added.size).toBe(0);
    expect(diff?.removed.size).toBe(0);
  });

  test("remote delete produces a removed diff", () => {
    const doc1 = createDocument(
      [createTestShape("shape-1"), createTestShape("shape-2")],
      registry,
    );
    const doc2 = updateDocument(doc1, (draft) => {
      delete draft.shapes["shape-2"];
    });
    const store = new DrawingStore({ tools: [], document: doc1 });

    store.applyDocument(doc2);

    expect(store.consumeApplyDocumentDiff()?.removed).toEqual(
      new Set(["shape-2"]),
    );
  });

  test("remote add produces an added diff", () => {
    const doc1 = createDocument([createTestShape("shape-1")], registry);
    const doc2 = updateDocument(doc1, (draft) => {
      draft.shapes["shape-2"] = createTestShape("shape-2");
    });
    const store = new DrawingStore({ tools: [], document: doc1 });

    store.applyDocument(doc2);

    expect(store.consumeApplyDocumentDiff()?.added).toEqual(
      new Set(["shape-2"]),
    );
  });

  test("consumeApplyDocumentDiff is consume-once", () => {
    const doc1 = createDocument([createTestShape("shape-1")], registry);
    const doc2 = updateDocument(doc1, (draft) => {
      draft.shapes["shape-1"] = createTestShape("shape-1", {
        transform: { translation: v(75, 0), scale: v(1, 1), rotation: 0 },
      });
    });
    const store = new DrawingStore({ tools: [], document: doc1 });

    store.applyDocument(doc2);

    expect(store.consumeApplyDocumentDiff()).not.toBeNull();
    expect(store.consumeApplyDocumentDiff()).toBeNull();
  });

  test("multiple applyDocument calls coalesce", () => {
    const doc1 = createDocument([createTestShape("shape-1")], registry);
    const doc2 = updateDocument(doc1, (draft) => {
      draft.shapes["shape-1"] = createTestShape("shape-1", {
        transform: { translation: v(100, 0), scale: v(1, 1), rotation: 0 },
      });
    });
    const doc3 = updateDocument(doc2, (draft) => {
      draft.shapes["shape-2"] = createTestShape("shape-2");
    });
    const store = new DrawingStore({ tools: [], document: doc1 });

    store.applyDocument(doc2);
    store.applyDocument(doc3);

    const diff = store.consumeApplyDocumentDiff();
    expect(diff?.prevDoc).toBe(doc1);
    expect(diff?.nextDoc).toBe(doc3);
    expect(diff?.changed.has("shape-1")).toBe(true);
    expect(diff?.added.has("shape-2")).toBe(true);
  });

  test("remote cross-layer move preserves both previous and next layer metadata", () => {
    const doc1 = createDocument(
      [createTestShape("shape-1", { layerId: "base" })],
      registry,
    );
    const doc2 = updateDocument(doc1, (draft) => {
      draft.shapes["shape-1"] = createTestShape("shape-1", {
        layerId: "stickers",
      });
    });
    const store = new DrawingStore({ tools: [], document: doc1 });

    store.applyDocument(doc2);

    const diff = store.consumeApplyDocumentDiff();
    expect(diff?.changed).toEqual(new Set(["shape-1"]));
    expect(diff?.prevDoc.shapes["shape-1"]?.layerId).toBe("base");
    expect(diff?.nextDoc.shapes["shape-1"]?.layerId).toBe("stickers");
  });

  test("remote z-order change records the affected layer", () => {
    const doc1 = createDocument([createTestShape("shape-1")], registry);
    const doc2 = updateDocument(doc1, (draft) => {
      draft.shapes["shape-1"] = createTestShape("shape-1", { zIndex: "b0" });
    });
    const store = new DrawingStore({ tools: [], document: doc1 });

    store.applyDocument(doc2);

    expect(store.consumeApplyDocumentDiff()?.zOrderChangedLayers).toEqual(
      new Set(["default"]),
    );
  });

  test("resetToDocument always requires full invalidation", () => {
    const doc1 = createDocument([createTestShape("shape-1")], registry);
    const doc2 = createDocument([], registry);
    const store = new DrawingStore({ tools: [], document: doc1 });

    store.resetToDocument(doc2);

    expect(store.consumeApplyDocumentDiff()?.requiresFullInvalidation).toBe(
      true,
    );
  });

  test("resetToDocument followed by applyDocument preserves full invalidation", () => {
    const doc1 = createDocument([createTestShape("shape-1")], registry);
    const doc2 = createDocument([], registry);
    const doc3 = createDocument([createTestShape("shape-2")], registry);
    const store = new DrawingStore({ tools: [], document: doc1 });

    store.resetToDocument(doc2);
    store.applyDocument(doc3);

    expect(store.consumeApplyDocumentDiff()?.requiresFullInvalidation).toBe(
      true,
    );
  });

  test("local mutateDocument dirty state and applyDocument diff are consumed independently", () => {
    const doc1 = createDocument([createTestShape("shape-1")], registry);
    const store = new DrawingStore({ tools: [], document: doc1 });

    store.mutateDocument(new AddShape(createTestShape("local-shape")));
    const doc2 = updateDocument(store.getDocument(), (draft) => {
      draft.shapes["shape-1"] = createTestShape("shape-1", {
        transform: { translation: v(125, 0), scale: v(1, 1), rotation: 0 },
      });
    });
    store.applyDocument(doc2);

    const dirtyState = store.consumeDirtyStateByLayer();
    expect(dirtyState.dirtyByLayer.get("default")?.has("local-shape")).toBe(
      true,
    );

    const diff = store.consumeApplyDocumentDiff();
    expect(diff?.changed).toEqual(new Set(["shape-1"]));
  });
});
