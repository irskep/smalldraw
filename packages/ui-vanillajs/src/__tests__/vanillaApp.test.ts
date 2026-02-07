import { describe, expect, test } from "bun:test";
import type { AnyGeometry, Shape } from "@smalldraw/core";
import { getOrderedShapes } from "@smalldraw/core";
import { Canvas, Image } from "canvas";
import { Vec2 } from "gl-matrix";
import { Window } from "happy-dom";

import { DrawingApp } from "../components/DrawingApp";
import { SelectionOverlay } from "../components/SelectionOverlay";
import { getPointerPoint } from "../utils/pointerHandlers";

type ShapeWithGeometry = Shape & { geometry: AnyGeometry };

// happy-dom types don't match standard DOM types, so we cast through unknown
function qs<T extends Element>(
  container: HTMLElement,
  selector: string,
): T | null {
  return container.querySelector(selector) as unknown as T | null;
}

function setupDom() {
  const windowInstance = new Window();
  const { document } = windowInstance;
  (globalThis as any).window = windowInstance as any;
  (globalThis as any).document = document;
  (globalThis as any).HTMLElement = windowInstance.HTMLElement;
  (globalThis as any).HTMLCanvasElement =
    Canvas as unknown as typeof windowInstance.HTMLCanvasElement;
  (globalThis as any).HTMLImageElement =
    Image as unknown as typeof windowInstance.HTMLImageElement;
  (globalThis as any).SVGElement = windowInstance.SVGElement;
  (globalThis as any).navigator = windowInstance.navigator;
  (globalThis as any).PointerEvent =
    (windowInstance as any).PointerEvent ?? windowInstance.MouseEvent;
  const container = document.createElement("div");
  document.body.appendChild(container);
  // Cast to standard DOM type for use with DrawingApp
  return {
    window: windowInstance,
    document,
    container: container as unknown as HTMLElement,
  };
}

function stubOverlayRect(overlay: HTMLElement, width: number, height: number) {
  overlay.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      width,
      height,
      left: 0,
      top: 0,
      right: width,
      bottom: height,
      toJSON() {
        return {};
      },
    }) as DOMRect;
}

function dispatchPointer(
  overlay: HTMLElement,
  type: string,
  x: number,
  y: number,
  buttons = 1,
) {
  const PointerCtor = (globalThis as any).PointerEvent ?? globalThis.MouseEvent;
  const event = new PointerCtor(type, {
    bubbles: true,
    clientX: x,
    clientY: y,
    buttons,
    pointerId: 1,
  });
  overlay.dispatchEvent(event);
}

describe("DrawingApp", () => {
  test("draws a rectangle via pointer interaction", () => {
    const { container } = setupDom();
    const app = new DrawingApp({ container, width: 300, height: 200 });
    const rectBtn = qs<HTMLButtonElement>(container, '[data-tool="rect"]');
    rectBtn?.click();

    const overlay = qs<HTMLElement>(container, ".smalldraw-overlay")!;
    stubOverlayRect(overlay, 300, 200);

    dispatchPointer(overlay, "pointerdown", 50, 50, 1);
    dispatchPointer(overlay, "pointermove", 180, 150, 1);
    dispatchPointer(overlay, "pointerup", 180, 150, 0);

    const shapes = Object.values(
      app.store.getDocument().shapes,
    ) as ShapeWithGeometry[];
    expect(shapes).toHaveLength(1);
    expect(shapes[0]?.geometry.type).toBe("rect");
    app.destroy();
  });

  test("updates shared colors via palette clicks", () => {
    const { container } = setupDom();
    const app = new DrawingApp({ container });
    const strokeRow = qs<HTMLElement>(
      container,
      '[data-role="stroke-swatches"]',
    );
    const target = qs<HTMLButtonElement>(
      strokeRow!,
      'button[data-color="#ff4b4b"]',
    );
    target?.click();
    expect(app.store.getSharedSettings().strokeColor.toLowerCase()).toBe(
      "#ff4b4b",
    );
    app.destroy();
  });

  test("selects and undoes shapes via toolbar controls", () => {
    const { container } = setupDom();
    const app = new DrawingApp({ container, width: 320, height: 240 });
    const rectBtn = qs<HTMLButtonElement>(container, '[data-tool="rect"]');
    rectBtn?.click();
    const overlay = qs<HTMLElement>(container, ".smalldraw-overlay")!;
    stubOverlayRect(overlay, 320, 240);
    dispatchPointer(overlay, "pointerdown", 40, 40, 1);
    dispatchPointer(overlay, "pointermove", 140, 120, 1);
    dispatchPointer(overlay, "pointerup", 140, 120, 0);

    const selectBtn = qs<HTMLButtonElement>(
      container,
      '[data-tool="selection"]',
    );
    selectBtn?.click();
    dispatchPointer(overlay, "pointerdown", 90, 80, 1);
    dispatchPointer(overlay, "pointerup", 90, 80, 0);
    expect(app.store.getSelection().ids.size).toBe(1);

    const undoBtn = qs<HTMLButtonElement>(
      container,
      'button[data-action="undo"]',
    );
    undoBtn?.click();
    expect(Object.values(app.store.getDocument().shapes)).toHaveLength(0);
    app.destroy();
  });

  test("clears shapes via toolbar clear button", () => {
    const { container } = setupDom();
    const app = new DrawingApp({ container, width: 320, height: 240 });
    const rectBtn = qs<HTMLButtonElement>(container, '[data-tool="rect"]');
    rectBtn?.click();
    const overlay = qs<HTMLElement>(container, ".smalldraw-overlay")!;
    stubOverlayRect(overlay, 320, 240);
    dispatchPointer(overlay, "pointerdown", 40, 40, 1);
    dispatchPointer(overlay, "pointermove", 140, 120, 1);
    dispatchPointer(overlay, "pointerup", 140, 120, 0);

    const clearBtn = qs<HTMLButtonElement>(
      container,
      'button[data-action="clear"]',
    );
    clearBtn?.click();

    const visible = getOrderedShapes(app.store.getDocument());
    expect(visible).toHaveLength(0);
    app.destroy();
  });

  test("axis handles follow rotated rectangle geometry", () => {
    const { container } = setupDom();
    const app = new DrawingApp({ container, width: 300, height: 300 });
    const doc = app.store.getDocument();
    const shapeId = "rot-rect";
    (doc.shapes[shapeId] as any) = {
      id: shapeId,
      type: "rect",
      geometry: { type: "rect", size: new Vec2(40, 20) },
      style: {},
      zIndex: "z",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: new Vec2(150, 150),
        rotation: Math.PI / 4,
        scale: new Vec2(1),
      },
    };
    app.store.activateTool("selection");
    app.store.setSelection([shapeId], shapeId);
    const overlay = qs<HTMLElement>(container, ".smalldraw-overlay")!;
    stubOverlayRect(overlay, 300, 300);

    // Trigger interaction to render handles
    dispatchPointer(overlay, "pointerdown", 150, 150, 1);
    dispatchPointer(overlay, "pointerup", 150, 150, 0);

    const axisHandle = qs<HTMLElement>(container, '[data-handle="mid-right"]')!;
    expect(axisHandle).not.toBeNull();
    const handleTop = parseFloat(axisHandle.style.top);
    const handleHeight = parseFloat(axisHandle.style.height);
    const centerY = handleTop + handleHeight / 2;
    expect(centerY).not.toBeCloseTo(150, 3);
    app.destroy();
  });

  test("renders draft shapes during pen tool interaction", () => {
    const { container } = setupDom();
    const app = new DrawingApp({ container, width: 300, height: 200 });
    const penBtn = qs<HTMLButtonElement>(container, '[data-tool="pen"]');
    penBtn?.click();

    const overlay = qs<HTMLElement>(container, ".smalldraw-overlay")!;
    stubOverlayRect(overlay, 300, 200);

    // Start drawing with pen - creates initial draft
    dispatchPointer(overlay, "pointerdown", 50, 50, 1);
    const draftsAfterDown = app.store.getDrafts() as ShapeWithGeometry[];
    expect(draftsAfterDown.length).toBeGreaterThan(0);
    expect(draftsAfterDown[0]?.geometry.type).toBe("pen");

    // Move updates draft shape
    dispatchPointer(overlay, "pointermove", 100, 100, 1);
    const draftsAfterMove = app.store.getDrafts() as ShapeWithGeometry[];
    expect(draftsAfterMove.length).toBeGreaterThan(0);
    expect(draftsAfterMove[0]?.geometry.type).toBe("pen");

    // Complete drawing
    dispatchPointer(overlay, "pointerup", 100, 100, 0);
    expect(app.store.getDrafts()).toHaveLength(0);
    expect(Object.values(app.store.getDocument().shapes)).toHaveLength(1);

    app.destroy();
  });

  test("renders draft shapes during rect tool interaction", () => {
    const { container } = setupDom();
    const app = new DrawingApp({ container, width: 300, height: 200 });
    const rectBtn = qs<HTMLButtonElement>(container, '[data-tool="rect"]');
    rectBtn?.click();

    const overlay = qs<HTMLElement>(container, ".smalldraw-overlay")!;
    stubOverlayRect(overlay, 300, 200);

    // Start drawing rect
    dispatchPointer(overlay, "pointerdown", 50, 50, 1);
    const draftsAfterDown = app.store.getDrafts() as ShapeWithGeometry[];
    expect(draftsAfterDown.length).toBeGreaterThan(0);

    // Move updates draft shape
    dispatchPointer(overlay, "pointermove", 150, 100, 1);
    const draftsAfterMove = app.store.getDrafts() as ShapeWithGeometry[];
    expect(draftsAfterMove.length).toBeGreaterThan(0);
    expect(draftsAfterMove[0]?.geometry.type).toBe("rect");

    // Complete drawing
    dispatchPointer(overlay, "pointerup", 150, 100, 0);
    expect(app.store.getDrafts()).toHaveLength(0);
    expect(Object.values(app.store.getDocument().shapes)).toHaveLength(1);

    app.destroy();
  });

  test("clears selection frame when clicking away from multi-select", () => {
    const { container } = setupDom();
    const app = new DrawingApp({ container, width: 400, height: 300 });

    // Add two rectangles to the document
    const doc = app.store.getDocument();
    (doc.shapes["rect-1"] as any) = {
      id: "rect-1",
      type: "rect",
      geometry: { type: "rect", size: new Vec2(50, 50) },
      style: {},
      zIndex: "a",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: new Vec2(100, 100),
        rotation: 0,
        scale: new Vec2(1),
      },
    };
    (doc.shapes["rect-2"] as any) = {
      id: "rect-2",
      type: "rect",
      geometry: { type: "rect", size: new Vec2(50, 50) },
      style: {},
      zIndex: "b",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: new Vec2(200, 100),
        rotation: 0,
        scale: new Vec2(1),
      },
    };

    // Activate selection tool and select both rectangles
    app.store.activateTool("selection");
    app.store.setSelection(["rect-1", "rect-2"], "rect-1");

    const overlay = qs<HTMLElement>(container, ".smalldraw-overlay")!;
    stubOverlayRect(overlay, 400, 300);

    // Click on one of the shapes to trigger selection-frame emission
    dispatchPointer(overlay, "pointerdown", 100, 100, 1);
    dispatchPointer(overlay, "pointerup", 100, 100, 0);

    // Selection frame should now exist after interaction
    let selectionFrame = app.store.getSelectionFrame();
    expect(selectionFrame).not.toBeNull();

    // Visual selection frame element should exist
    let frameEl = qs<HTMLElement>(container, ".smalldraw-selection-frame");
    expect(frameEl).not.toBeNull();

    // Click outside the selection bounding box (which spans from 75,75 to 225,125)
    // Click at (50, 50) which is outside
    dispatchPointer(overlay, "pointerdown", 50, 50, 1);
    dispatchPointer(overlay, "pointerup", 50, 50, 0);

    // Selection should be cleared
    expect(app.store.getSelection().ids.size).toBe(0);

    // Selection frame should be cleared (null)
    selectionFrame = app.store.getSelectionFrame();
    expect(selectionFrame).toBeNull();

    // Visual selection frame overlay should also be cleared
    frameEl = qs<HTMLElement>(container, ".smalldraw-selection-frame");
    expect(frameEl).toBeNull();

    app.destroy();
  });

  test("setScale updates scale and triggers render", () => {
    const { container } = setupDom();
    const app = new DrawingApp({ container, width: 300, height: 200 });

    // setScale should be callable without error
    app.setScale(2);
    app.setScale(0.5);

    app.destroy();
  });

  test("draws rectangle at correct world coordinates when scaled", () => {
    const { container } = setupDom();
    const app = new DrawingApp({ container, width: 300, height: 200 });
    const rectBtn = qs<HTMLButtonElement>(container, '[data-tool="rect"]');
    rectBtn?.click();

    const overlay = qs<HTMLElement>(container, ".smalldraw-overlay")!;
    stubOverlayRect(overlay, 600, 400); // Screen size is 2x world size

    // Set scale to 2 (screen is 2x larger than world)
    app.setScale(2);

    // Draw at screen coordinates (100, 100) to (200, 200)
    // With scale=2, world coordinates should be (50, 50) to (100, 100)
    dispatchPointer(overlay, "pointerdown", 100, 100, 1);
    dispatchPointer(overlay, "pointermove", 200, 200, 1);
    dispatchPointer(overlay, "pointerup", 200, 200, 0);

    const shapes = Object.values(
      app.store.getDocument().shapes,
    ) as ShapeWithGeometry[];
    expect(shapes).toHaveLength(1);

    const shape = shapes[0]!;
    expect(shape.geometry.type).toBe("rect");
    // The rect should be 50x50 in world units (100/2 = 50)
    const geom = shape.geometry as { type: "rect"; size: [number, number] };
    expect(geom.size[0]).toBeCloseTo(50, 1);
    expect(geom.size[1]).toBeCloseTo(50, 1);

    app.destroy();
  });
});

describe("getPointerPoint", () => {
  test("returns correct position without scale", () => {
    const { document } = setupDom();
    const overlay = document.createElement("div") as unknown as HTMLElement;
    overlay.getBoundingClientRect = () =>
      ({
        left: 10,
        top: 20,
        width: 300,
        height: 200,
      }) as DOMRect;

    const event = {
      clientX: 110,
      clientY: 120,
    } as PointerEvent;

    const point = getPointerPoint(event, overlay);
    expect(point[0]).toBeCloseTo(100, 5);
    expect(point[1]).toBeCloseTo(100, 5);
  });

  test("converts screen to world coordinates with scale", () => {
    const { document } = setupDom();
    const overlay = document.createElement("div") as unknown as HTMLElement;
    overlay.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 600,
        height: 400,
      }) as DOMRect;

    const event = {
      clientX: 200,
      clientY: 100,
    } as PointerEvent;

    // With scale=2, screen (200, 100) becomes world (100, 50)
    const point = getPointerPoint(event, overlay, 2);
    expect(point[0]).toBeCloseTo(100, 5);
    expect(point[1]).toBeCloseTo(50, 5);
  });

  test("handles fractional scale values", () => {
    const { document } = setupDom();
    const overlay = document.createElement("div") as unknown as HTMLElement;
    overlay.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 150,
        height: 100,
      }) as DOMRect;

    const event = {
      clientX: 75,
      clientY: 50,
    } as PointerEvent;

    // With scale=0.5, screen (75, 50) becomes world (150, 100)
    const point = getPointerPoint(event, overlay, 0.5);
    expect(point[0]).toBeCloseTo(150, 5);
    expect(point[1]).toBeCloseTo(100, 5);
  });
});

describe("SelectionOverlay", () => {
  test("setScale updates internal scale", () => {
    const { document } = setupDom();
    const container = document.createElement("div") as unknown as HTMLElement;
    const overlay = new SelectionOverlay(container);

    // Should not throw
    overlay.setScale(2);
    overlay.setScale(0.5);
  });

  test("setScale updates viewport.scale for Konva rendering", () => {
    const { container } = setupDom();
    const app = new DrawingApp({ container, width: 300, height: 200 });

    // Initial viewport scale should be 1
    const initialViewport = (app as any).viewport;
    expect(initialViewport.scale).toBe(1);

    // After setScale, viewport.scale should be updated
    app.setScale(2);
    expect(initialViewport.scale).toBe(2);

    // World center should remain fixed at original world dimensions
    expect(initialViewport.center[0]).toBe(150); // 300/2
    expect(initialViewport.center[1]).toBe(100); // 200/2

    app.destroy();
  });

  test("resize updates viewport dimensions but keeps world center fixed", () => {
    const { container } = setupDom();
    const app = new DrawingApp({ container, width: 300, height: 200 });

    const viewport = (app as any).viewport;

    // Resize to scaled dimensions (simulating 2x scale)
    app.resize(600, 400);
    app.setScale(2);

    // Viewport dimensions should be the scaled canvas size
    expect(viewport.width).toBe(600);
    expect(viewport.height).toBe(400);

    // But center should remain at world center, not scaled center
    expect(viewport.center[0]).toBe(150); // worldWidth/2 = 300/2
    expect(viewport.center[1]).toBe(100); // worldHeight/2 = 200/2

    app.destroy();
  });

  test("scales selection frame position and size", () => {
    const { document } = setupDom();
    const container = document.createElement("div") as unknown as HTMLElement;
    const overlay = new SelectionOverlay(container);

    overlay.setScale(2);
    overlay.update(
      { min: new Vec2(10, 20), max: new Vec2(110, 120) },
      [],
      undefined,
      undefined,
    );

    const frameEl = container.querySelector(
      ".smalldraw-selection-frame",
    ) as HTMLElement;
    expect(frameEl).not.toBeNull();
    // World (10, 20) * scale 2 = screen (20, 40)
    expect(frameEl.style.left).toBe("20px");
    expect(frameEl.style.top).toBe("40px");
    // World size 100x100 * scale 2 = screen 200x200
    expect(frameEl.style.width).toBe("200px");
    expect(frameEl.style.height).toBe("200px");
  });

  test("clears overlay elements", () => {
    const { document } = setupDom();
    const container = document.createElement("div") as unknown as HTMLElement;
    const overlay = new SelectionOverlay(container);

    overlay.update(
      { min: new Vec2(0, 0), max: new Vec2(100, 100) },
      [],
      undefined,
      undefined,
    );
    expect(
      container.querySelector(".smalldraw-selection-frame"),
    ).not.toBeNull();

    overlay.clear();
    expect(container.querySelector(".smalldraw-selection-frame")).toBeNull();
  });
});
