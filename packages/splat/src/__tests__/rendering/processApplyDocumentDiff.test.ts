import { describe, expect, test } from "bun:test";
import {
  type ApplyDocumentDiff,
  type DrawingDocument,
  getDefaultShapeHandlerRegistry,
} from "@smalldraw/core";
import type { Box } from "@smalldraw/geometry";
import type { LayerStack, ShapeRegionChange } from "@smalldraw/renderer-raster";
import { processApplyDocumentDiff } from "../../render/processApplyDocumentDiff";

const shapeHandlers = getDefaultShapeHandlerRegistry();

function v(x = 0, y = x): [number, number] {
  return [x, y];
}

function createShape(
  id: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id,
    type: "boxed",
    zIndex: "a0",
    layerId: "default",
    geometry: { type: "boxed", kind: "rect", size: v(100, 50) },
    style: { fill: { type: "solid", color: "#ff0000" } },
    transform: { translation: v(200, 100), scale: v(1, 1), rotation: 0 },
    ...overrides,
  };
}

function createDoc(
  shapes: Record<string, Record<string, unknown>>,
): DrawingDocument {
  return { shapes } as unknown as DrawingDocument;
}

function createDiff(overrides: Partial<ApplyDocumentDiff>): ApplyDocumentDiff {
  return {
    prevDoc: createDoc({}),
    nextDoc: createDoc({}),
    added: new Set(),
    removed: new Set(),
    changed: new Set(),
    zOrderChangedLayers: new Set(),
    layerTopologyChanged: false,
    requiresFullInvalidation: false,
    ...overrides,
  };
}

interface MockLayerStack {
  layerStack: LayerStack;
  calls: {
    scheduleFullInvalidation: number;
    scheduleFullLayerInvalidation: string[];
    routeDirtyShapeRegions: Map<string, ShapeRegionChange[]>[];
    routeDirtyRegions: Map<string, Box[]>[];
  };
}

function createMockLayerStack(): MockLayerStack {
  const calls = {
    scheduleFullInvalidation: 0,
    scheduleFullLayerInvalidation: [] as string[],
    routeDirtyShapeRegions: [] as Map<string, ShapeRegionChange[]>[],
    routeDirtyRegions: [] as Map<string, Box[]>[],
  };
  const layerStack: LayerStack = {
    setLayers() {},
    setActiveLayer() {},
    updateViewport() {},
    setRenderIdentity() {},
    routeDirtyShapes() {},
    routeDirtyRegions(regionsByLayer) {
      calls.routeDirtyRegions.push(new Map(regionsByLayer));
    },
    routeDirtyShapeRegions(changesByLayer) {
      calls.routeDirtyShapeRegions.push(new Map(changesByLayer));
    },
    scheduleFullInvalidation() {
      calls.scheduleFullInvalidation++;
    },
    scheduleFullLayerInvalidation(layerId) {
      calls.scheduleFullLayerInvalidation.push(layerId);
    },
    flushBakes: () => Promise.resolve(),
    beginActiveLayerDraftSession: () => Promise.resolve(),
    endActiveLayerDraftSession() {},
    getActiveLayerBackdropSnapshot: () => null,
    dispose() {},
  };
  return { layerStack, calls };
}

describe("processApplyDocumentDiff", () => {
  test("requiresFullInvalidation triggers scheduleFullInvalidation and returns early", () => {
    const { layerStack, calls } = createMockLayerStack();
    const diff = createDiff({ requiresFullInvalidation: true });

    processApplyDocumentDiff(diff, layerStack, shapeHandlers);

    expect(calls.scheduleFullInvalidation).toBe(1);
    expect(calls.routeDirtyShapeRegions).toEqual([]);
    expect(calls.routeDirtyRegions).toEqual([]);
  });

  test("added shape routes shape change with null prevBounds", () => {
    const shape = createShape("s1");
    const { layerStack, calls } = createMockLayerStack();
    const diff = createDiff({
      nextDoc: createDoc({ s1: shape }),
      added: new Set(["s1"]),
    });

    processApplyDocumentDiff(diff, layerStack, shapeHandlers);

    expect(calls.routeDirtyShapeRegions.length).toBe(1);
    const changes = calls.routeDirtyShapeRegions[0].get("default");
    expect(changes?.length).toBe(1);
    expect(changes?.[0].shapeId).toBe("s1");
    expect(changes?.[0].prevBounds).toBeNull();
    expect(changes?.[0].nextBounds).not.toBeNull();
  });

  test("removed shape routes shape change with null nextBounds", () => {
    const shape = createShape("s1");
    const { layerStack, calls } = createMockLayerStack();
    const diff = createDiff({
      prevDoc: createDoc({ s1: shape }),
      removed: new Set(["s1"]),
    });

    processApplyDocumentDiff(diff, layerStack, shapeHandlers);

    expect(calls.routeDirtyShapeRegions.length).toBe(1);
    const changes = calls.routeDirtyShapeRegions[0].get("default");
    expect(changes?.length).toBe(1);
    expect(changes?.[0].shapeId).toBe("s1");
    expect(changes?.[0].prevBounds).not.toBeNull();
    expect(changes?.[0].nextBounds).toBeNull();
  });

  test("changed shape on same layer routes single shape change", () => {
    const prev = createShape("s1", {
      transform: { translation: v(0, 0), scale: v(1, 1), rotation: 0 },
    });
    const next = createShape("s1", {
      transform: { translation: v(200, 0), scale: v(1, 1), rotation: 0 },
    });
    const { layerStack, calls } = createMockLayerStack();
    const diff = createDiff({
      prevDoc: createDoc({ s1: prev }),
      nextDoc: createDoc({ s1: next }),
      changed: new Set(["s1"]),
    });

    processApplyDocumentDiff(diff, layerStack, shapeHandlers);

    expect(calls.routeDirtyShapeRegions.length).toBe(1);
    const changes = calls.routeDirtyShapeRegions[0].get("default");
    expect(changes?.length).toBe(1);
    expect(changes?.[0].prevBounds).not.toBeNull();
    expect(changes?.[0].nextBounds).not.toBeNull();
  });

  test("cross-layer change routes to both layers", () => {
    const prev = createShape("s1", { layerId: "base" });
    const next = createShape("s1", { layerId: "stickers" });
    const { layerStack, calls } = createMockLayerStack();
    const diff = createDiff({
      prevDoc: createDoc({ s1: prev }),
      nextDoc: createDoc({ s1: next }),
      changed: new Set(["s1"]),
    });

    processApplyDocumentDiff(diff, layerStack, shapeHandlers);

    expect(calls.routeDirtyShapeRegions.length).toBe(1);
    const routed = calls.routeDirtyShapeRegions[0];
    const baseChanges = routed.get("base");
    const stickerChanges = routed.get("stickers");
    expect(baseChanges?.length).toBe(1);
    expect(baseChanges?.[0].nextBounds).toBeNull();
    expect(stickerChanges?.length).toBe(1);
    expect(stickerChanges?.[0].prevBounds).toBeNull();
  });

  test("z-order changed layer triggers full layer invalidation", () => {
    const prev = createShape("s1", { zIndex: "a0" });
    const next = createShape("s1", { zIndex: "b0" });
    const { layerStack, calls } = createMockLayerStack();
    const diff = createDiff({
      prevDoc: createDoc({ s1: prev }),
      nextDoc: createDoc({ s1: next }),
      changed: new Set(["s1"]),
      zOrderChangedLayers: new Set(["default"]),
    });

    processApplyDocumentDiff(diff, layerStack, shapeHandlers);

    expect(calls.scheduleFullLayerInvalidation).toEqual(["default"]);
    // The changed shape on the z-order-invalidated layer should NOT also
    // appear in routeDirtyShapeRegions (it's already fully invalidated)
    if (calls.routeDirtyShapeRegions.length > 0) {
      expect(calls.routeDirtyShapeRegions[0].has("default")).toBe(false);
    }
  });

  test("unknown shape type escalates to full layer invalidation", () => {
    const shape = createShape("s1", { type: "unknown-shape-type" });
    const { layerStack, calls } = createMockLayerStack();
    const diff = createDiff({
      nextDoc: createDoc({ s1: shape }),
      added: new Set(["s1"]),
    });

    processApplyDocumentDiff(diff, layerStack, shapeHandlers);

    expect(calls.scheduleFullLayerInvalidation).toEqual(["default"]);
  });

  test("empty diff produces no calls", () => {
    const { layerStack, calls } = createMockLayerStack();
    const diff = createDiff({});

    processApplyDocumentDiff(diff, layerStack, shapeHandlers);

    expect(calls.scheduleFullInvalidation).toBe(0);
    expect(calls.scheduleFullLayerInvalidation).toEqual([]);
    expect(calls.routeDirtyShapeRegions).toEqual([]);
    expect(calls.routeDirtyRegions).toEqual([]);
  });

  test("multiple shapes on different layers route to correct buckets", () => {
    const s1 = createShape("s1", { layerId: "base" });
    const s2 = createShape("s2", { layerId: "stickers" });
    const { layerStack, calls } = createMockLayerStack();
    const diff = createDiff({
      nextDoc: createDoc({ s1, s2 }),
      added: new Set(["s1", "s2"]),
    });

    processApplyDocumentDiff(diff, layerStack, shapeHandlers);

    expect(calls.routeDirtyShapeRegions.length).toBe(1);
    const routed = calls.routeDirtyShapeRegions[0];
    expect(routed.get("base")?.length).toBe(1);
    expect(routed.get("stickers")?.length).toBe(1);
  });

  test("changed shape where only prev has unknown type: prev layer fully invalidated, next gets region", () => {
    const prevShape = createShape("s1", {
      layerId: "base",
      type: "unknown-type",
    });
    const nextShape = createShape("s1", { layerId: "stickers" });
    const { layerStack, calls } = createMockLayerStack();
    const diff = createDiff({
      prevDoc: createDoc({ s1: prevShape }),
      nextDoc: createDoc({ s1: nextShape }),
      changed: new Set(["s1"]),
    });

    processApplyDocumentDiff(diff, layerStack, shapeHandlers);

    // prev layer escalated to full invalidation
    expect(calls.scheduleFullLayerInvalidation).toContain("base");
    // next layer gets region fallback
    expect(calls.routeDirtyRegions.length).toBe(1);
    expect(calls.routeDirtyRegions[0].has("stickers")).toBe(true);
  });
});
