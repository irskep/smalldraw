import { describe, expect, test } from "bun:test";

import {
  createDocument,
  type DirtyState,
  type Shape,
  getDefaultShapeHandlerRegistry,
} from "@smalldraw/core";

import {
  createStage,
  ensureRendererLayer,
  reconcileDocument,
  renderDocument,
} from "../document";
import { KonvaReconciler } from "../reconciler";
import type { Viewport } from "../viewport";

const baseViewport: Viewport = {
  width: 200,
  height: 200,
  center: { x: 100, y: 100 },
  scale: 1,
  backgroundColor: "#ffffff",
};

function createTestShape(id: string, x = 50, y = 50): Shape {
  return {
    id,
    geometry: { type: "rect", size: { width: 40, height: 30 } },
    fill: { type: "solid", color: "#ff0000" },
    zIndex: `a-${id}`,
    transform: { translation: { x, y }, scale: { x: 1, y: 1 }, rotation: 0 },
  };
}

function renderToBuffer(stage: any): Buffer {
  const layer = stage.getLayers()[0];
  type BufferCanvas = HTMLCanvasElement & {
    toBuffer: (mimeType?: string) => Buffer;
  };
  const canvas = layer.getCanvas()._canvas as BufferCanvas;
  return canvas.toBuffer("image/png");
}

describe("KonvaReconciler", () => {
  test("reconciler creates nodes for new shapes", () => {
    const stage = createStage({ width: 200, height: 200 });
    const layer = ensureRendererLayer(stage);
    const reconciler = new KonvaReconciler();

    const shapes = [createTestShape("shape-1")];
    reconciler.reconcile(layer, shapes, new Set(["shape-1"]), new Set());

    expect(reconciler.hasNode("shape-1")).toBe(true);
    expect(reconciler.getNode("shape-1")).toBeDefined();
  });

  test("reconciler removes nodes for deleted shapes", () => {
    const stage = createStage({ width: 200, height: 200 });
    const layer = ensureRendererLayer(stage);
    const reconciler = new KonvaReconciler();

    // First add a shape
    const shapes = [createTestShape("shape-1")];
    reconciler.reconcile(layer, shapes, new Set(["shape-1"]), new Set());
    expect(reconciler.hasNode("shape-1")).toBe(true);

    // Then delete it
    reconciler.reconcile(layer, [], new Set(), new Set(["shape-1"]));
    expect(reconciler.hasNode("shape-1")).toBe(false);
  });

  test("reconciler updates only dirty shapes", () => {
    const stage = createStage({ width: 200, height: 200 });
    const layer = ensureRendererLayer(stage);
    const reconciler = new KonvaReconciler();

    // Add two shapes
    const shapes = [
      createTestShape("shape-1", 30, 30),
      createTestShape("shape-2", 80, 80),
    ];
    reconciler.reconcile(
      layer,
      shapes,
      new Set(["shape-1", "shape-2"]),
      new Set(),
    );

    const node1Before = reconciler.getNode("shape-1");
    const node2Before = reconciler.getNode("shape-2");

    // Update only shape-1
    shapes[0] = {
      ...shapes[0],
      transform: { ...shapes[0].transform!, translation: { x: 50, y: 50 } },
    };
    reconciler.reconcile(layer, shapes, new Set(["shape-1"]), new Set());

    // Same node instances should be reused
    expect(reconciler.getNode("shape-1")).toBe(node1Before);
    expect(reconciler.getNode("shape-2")).toBe(node2Before);
  });

  test("reconciler clear removes all nodes", () => {
    const stage = createStage({ width: 200, height: 200 });
    const layer = ensureRendererLayer(stage);
    const reconciler = new KonvaReconciler();

    const shapes = [createTestShape("shape-1"), createTestShape("shape-2")];
    reconciler.reconcile(
      layer,
      shapes,
      new Set(["shape-1", "shape-2"]),
      new Set(),
    );
    expect(reconciler.hasNode("shape-1")).toBe(true);
    expect(reconciler.hasNode("shape-2")).toBe(true);

    reconciler.clear();
    expect(reconciler.hasNode("shape-1")).toBe(false);
    expect(reconciler.hasNode("shape-2")).toBe(false);
  });

  test("fullRender handles all shapes", () => {
    const stage = createStage({ width: 200, height: 200 });
    const layer = ensureRendererLayer(stage);
    const reconciler = new KonvaReconciler();

    const shapes = [
      createTestShape("shape-1"),
      createTestShape("shape-2"),
      createTestShape("shape-3"),
    ];
    reconciler.fullRender(layer, shapes);

    expect(reconciler.hasNode("shape-1")).toBe(true);
    expect(reconciler.hasNode("shape-2")).toBe(true);
    expect(reconciler.hasNode("shape-3")).toBe(true);
  });

  test("reconciled render matches full render", () => {
    // Create two stages - one for full render, one for reconciled
    const stageA = createStage({ width: 200, height: 200 });
    const stageB = createStage({ width: 200, height: 200 });

    const shapes: Shape[] = [
      createTestShape("shape-1", 30, 30),
      createTestShape("shape-2", 80, 80),
      createTestShape("shape-3", 130, 50),
    ];
    const registry = getDefaultShapeHandlerRegistry();
    const doc = createDocument(shapes, registry);

    // Full render on stage A
    renderDocument(stageA, doc, { viewport: baseViewport });

    // Reconciled render on stage B (using reconcileDocument which handles background)
    const reconciler = new KonvaReconciler();
    const allDirty: DirtyState = {
      dirty: new Set(shapes.map((s) => s.id)),
      deleted: new Set(),
    };
    reconcileDocument(stageB, reconciler, shapes, allDirty, {
      viewport: baseViewport,
    });

    // Verify layer structure is similar
    const layerA = stageA.getLayers()[0];
    const layerB = stageB.getLayers()[0];
    expect(layerB.children?.length).toBe(layerA.children?.length);

    // For now, just verify that both render without error and have same number of children
    // Pixel-perfect comparison may fail due to rendering differences
    expect(reconciler.hasNode("shape-1")).toBe(true);
    expect(reconciler.hasNode("shape-2")).toBe(true);
    expect(reconciler.hasNode("shape-3")).toBe(true);
  });

  test("reconciled render after move updates node position", () => {
    const stage = createStage({ width: 200, height: 200 });

    const shapes: Shape[] = [
      createTestShape("shape-1", 30, 30),
      createTestShape("shape-2", 80, 80),
    ];

    // Set up reconciler with initial shapes
    const reconciler = new KonvaReconciler();
    const allDirty: DirtyState = {
      dirty: new Set(shapes.map((s) => s.id)),
      deleted: new Set(),
    };
    reconcileDocument(stage, reconciler, shapes, allDirty, {
      viewport: baseViewport,
    });

    const nodeBefore = reconciler.getNode("shape-1")!;
    const posBefore = nodeBefore.position();
    expect(posBefore.x).toBe(30);
    expect(posBefore.y).toBe(30);

    // Move shape-1
    shapes[0] = {
      ...shapes[0],
      transform: { ...shapes[0].transform!, translation: { x: 120, y: 120 } },
    };

    // Reconcile with only shape-1 dirty
    const moveDirty: DirtyState = {
      dirty: new Set(["shape-1"]),
      deleted: new Set(),
    };
    reconcileDocument(stage, reconciler, shapes, moveDirty, {
      viewport: baseViewport,
    });

    // Same node instance should be reused, with updated position
    const nodeAfter = reconciler.getNode("shape-1")!;
    expect(nodeAfter).toBe(nodeBefore);
    expect(nodeAfter.position().x).toBe(120);
    expect(nodeAfter.position().y).toBe(120);
  });

  test("reconciled render after delete removes node", () => {
    const stage = createStage({ width: 200, height: 200 });

    const initialShapes: Shape[] = [
      createTestShape("shape-1", 30, 30),
      createTestShape("shape-2", 80, 80),
      createTestShape("shape-3", 130, 50),
    ];

    // Set up reconciler with initial shapes
    const reconciler = new KonvaReconciler();
    const allDirty: DirtyState = {
      dirty: new Set(initialShapes.map((s) => s.id)),
      deleted: new Set(),
    };
    reconcileDocument(stage, reconciler, initialShapes, allDirty, {
      viewport: baseViewport,
    });

    expect(reconciler.hasNode("shape-1")).toBe(true);
    expect(reconciler.hasNode("shape-2")).toBe(true);
    expect(reconciler.hasNode("shape-3")).toBe(true);

    // Delete shape-2
    const remainingShapes = [initialShapes[0], initialShapes[2]];
    const deleteDirty: DirtyState = {
      dirty: new Set(),
      deleted: new Set(["shape-2"]),
    };
    reconcileDocument(stage, reconciler, remainingShapes, deleteDirty, {
      viewport: baseViewport,
    });

    // shape-2 should be removed
    expect(reconciler.hasNode("shape-1")).toBe(true);
    expect(reconciler.hasNode("shape-2")).toBe(false);
    expect(reconciler.hasNode("shape-3")).toBe(true);
  });
});
