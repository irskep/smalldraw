import { describe, expect, test } from "bun:test";
import type { DrawingDocument } from "../model/document";
import { diffDocumentShapes } from "../store/diffDocumentShapes";

function createShape(
  id: string,
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    id,
    type: "boxed",
    zIndex: "a0",
    layerId: "default",
    geometry: { type: "boxed", kind: "rect", size: [100, 50] },
    style: { fill: { type: "solid", color: "#ff0000" } },
    transform: { translation: [0, 0], scale: [1, 1], rotation: 0 },
    ...overrides,
  };
}

function createDoc(
  shapes: Record<string, Record<string, unknown>>,
): DrawingDocument {
  return {
    shapes,
  } as unknown as DrawingDocument;
}

describe("diffDocumentShapes", () => {
  test("returns no changes for identical documents", () => {
    const shape = createShape("shape-1");
    const doc = createDoc({ "shape-1": shape });

    const diff = diffDocumentShapes(doc, doc);

    expect(diff.added.size).toBe(0);
    expect(diff.removed.size).toBe(0);
    expect(diff.changed.size).toBe(0);
    expect(diff.zOrderChangedLayers.size).toBe(0);
    expect(diff.layerTopologyChanged).toBe(false);
    expect(diff.requiresFullInvalidation).toBe(false);
  });

  test("detects added shapes", () => {
    const prevDoc = createDoc({});
    const nextDoc = createDoc({ "shape-1": createShape("shape-1") });

    const diff = diffDocumentShapes(prevDoc, nextDoc);

    expect(diff.added).toEqual(new Set(["shape-1"]));
  });

  test("detects removed shapes", () => {
    const prevDoc = createDoc({ "shape-1": createShape("shape-1") });
    const nextDoc = createDoc({});

    const diff = diffDocumentShapes(prevDoc, nextDoc);

    expect(diff.removed).toEqual(new Set(["shape-1"]));
  });

  test("detects changed shapes by reference inequality", () => {
    const prevDoc = createDoc({ "shape-1": createShape("shape-1") });
    const nextDoc = createDoc({ "shape-1": createShape("shape-1") });

    const diff = diffDocumentShapes(prevDoc, nextDoc);

    expect(diff.changed).toEqual(new Set(["shape-1"]));
  });

  test("does not mark shapes changed when references are equal", () => {
    const sharedShape = createShape("shape-1");
    const prevDoc = createDoc({ "shape-1": sharedShape });
    const nextDoc = createDoc({ "shape-1": sharedShape });

    const diff = diffDocumentShapes(prevDoc, nextDoc);

    expect(diff.added.size).toBe(0);
    expect(diff.removed.size).toBe(0);
    expect(diff.changed.size).toBe(0);
  });

  test("detects z-order changes", () => {
    const prevDoc = createDoc({
      "shape-1": createShape("shape-1", { zIndex: "a0" }),
    });
    const nextDoc = createDoc({
      "shape-1": createShape("shape-1", { zIndex: "b0" }),
    });

    const diff = diffDocumentShapes(prevDoc, nextDoc);

    expect(diff.zOrderChangedLayers).toEqual(new Set(["default"]));
  });

  test("does not flag z-order when changed shape keeps the same z-index", () => {
    const prevDoc = createDoc({
      "shape-1": createShape("shape-1", { transform: { translation: [0, 0] } }),
    });
    const nextDoc = createDoc({
      "shape-1": createShape("shape-1", {
        transform: { translation: [100, 0] },
      }),
    });

    const diff = diffDocumentShapes(prevDoc, nextDoc);

    expect(diff.changed).toEqual(new Set(["shape-1"]));
    expect(diff.zOrderChangedLayers.size).toBe(0);
  });

  test("flags layer topology when a new layer is introduced", () => {
    const prevDoc = createDoc({
      "shape-1": createShape("shape-1", { layerId: "base" }),
    });
    const nextDoc = createDoc({
      "shape-1": createShape("shape-1", { layerId: "base" }),
      "shape-2": createShape("shape-2", { layerId: "stickers" }),
    });

    const diff = diffDocumentShapes(prevDoc, nextDoc);

    expect(diff.layerTopologyChanged).toBe(true);
    expect(diff.requiresFullInvalidation).toBe(true);
  });

  test("flags layer topology when the last shape leaves a layer", () => {
    const prevDoc = createDoc({
      "shape-1": createShape("shape-1", { layerId: "base" }),
      "shape-2": createShape("shape-2", { layerId: "stickers" }),
    });
    const nextDoc = createDoc({
      "shape-1": createShape("shape-1", { layerId: "base" }),
    });

    const diff = diffDocumentShapes(prevDoc, nextDoc);

    expect(diff.layerTopologyChanged).toBe(true);
  });

  test("does not flag layer topology when referenced layers are unchanged", () => {
    const prevDoc = createDoc({
      "shape-1": createShape("shape-1", { layerId: "base", zIndex: "a0" }),
      "shape-2": createShape("shape-2", { layerId: "stickers", zIndex: "a1" }),
    });
    const nextDoc = createDoc({
      "shape-1": createShape("shape-1", { layerId: "base", zIndex: "b0" }),
      "shape-2": createShape("shape-2", { layerId: "stickers", zIndex: "a1" }),
    });

    const diff = diffDocumentShapes(prevDoc, nextDoc);

    expect(diff.layerTopologyChanged).toBe(false);
    expect(diff.requiresFullInvalidation).toBe(false);
  });

  test("includes both layers for cross-layer z-order changes", () => {
    const prevDoc = createDoc({
      "shape-1": createShape("shape-1", { layerId: "base", zIndex: "a0" }),
    });
    const nextDoc = createDoc({
      "shape-1": createShape("shape-1", { layerId: "stickers", zIndex: "b0" }),
    });

    const diff = diffDocumentShapes(prevDoc, nextDoc);

    expect(diff.zOrderChangedLayers).toEqual(new Set(["base", "stickers"]));
  });

  test("treats undefined layerId as DEFAULT_LAYER_ID for topology comparison", () => {
    const shapeWithDefault = createShape("shape-1");
    const shapeWithoutLayerId = createShape("shape-2");
    delete shapeWithoutLayerId.layerId;

    const prevDoc = createDoc({ "shape-1": shapeWithDefault });
    const nextDoc = createDoc({ "shape-2": shapeWithoutLayerId });

    const diff = diffDocumentShapes(prevDoc, nextDoc);

    // shape-1 removed, shape-2 added, but both resolve to DEFAULT_LAYER_ID ("default")
    // so the set of referenced layer IDs is unchanged -> no topology change
    expect(diff.layerTopologyChanged).toBe(false);
    expect(diff.requiresFullInvalidation).toBe(false);
  });
});
