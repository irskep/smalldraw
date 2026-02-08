import { describe, expect, test } from "bun:test";
import {
  applyActionToDoc,
  createDocument,
  getDefaultShapeHandlerRegistry,
  type ActionContext,
  type DrawingDocument,
  type DrawingDocumentData,
  type DrawingStoreActionEvent,
  type PenShape,
  type SmalldrawCore,
} from "@smalldraw/core";
import { getWorldPointsFromShape } from "@smalldraw/testing";
import { createKidsDrawApp } from "../createKidsDrawApp";

function dispatchPointer(
  overlay: HTMLElement,
  type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
  x: number,
  y: number,
  buttons = 1,
): void {
  const event = new PointerEvent(type, {
    bubbles: true,
    clientX: x,
    clientY: y,
    buttons,
    pointerId: 1,
  });
  overlay.dispatchEvent(event);
}

function dispatchInput(element: HTMLElement): void {
  const EventCtor = (window as unknown as { Event: typeof Event }).Event;
  element.dispatchEvent(new EventCtor("input", { bubbles: true }));
}

function dispatchPointerMoveWithCoalesced(
  overlay: HTMLElement,
  x: number,
  y: number,
  coalescedPoints: Array<{ x: number; y: number }> = [],
  buttons = 1,
): void {
  const event = new PointerEvent("pointermove", {
    bubbles: true,
    clientX: x,
    clientY: y,
    buttons,
    pointerId: 1,
  }) as PointerEvent & {
    getCoalescedEvents?: () => PointerEvent[];
  };
  if (coalescedPoints.length > 0) {
    Object.defineProperty(event, "getCoalescedEvents", {
      configurable: true,
      value: () =>
        coalescedPoints.map(
          (point) =>
            new PointerEvent("pointermove", {
              bubbles: true,
              clientX: point.x,
              clientY: point.y,
              buttons,
              pointerId: 1,
            }),
        ),
    });
  }
  overlay.dispatchEvent(event);
}

async function waitForTurn(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

async function waitUntil(
  predicate: () => boolean,
  maxAttempts = 50,
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i += 1) {
    if (predicate()) {
      return true;
    }
    await waitForTurn();
  }
  return predicate();
}

function createMockCore(
  initialSize = { width: 960, height: 600 },
): SmalldrawCore {
  const registry = getDefaultShapeHandlerRegistry();
  let doc = createDocument(undefined, registry, initialSize);
  const listeners = new Set<(doc: DrawingDocument) => void>();

  const change: ActionContext["change"] = (nextDoc, update) => {
    update(nextDoc as DrawingDocumentData);
    return nextDoc;
  };
  const actionContext: ActionContext = { registry, change };

  const storeAdapter = {
    getDoc: () => doc,
    applyAction: (event: DrawingStoreActionEvent) => {
      if (event.type === "undo") {
        doc = event.action.undo(doc, actionContext);
      } else {
        doc = applyActionToDoc(doc, event.action, registry, change);
      }
      for (const listener of listeners) {
        listener(doc);
      }
    },
    subscribe: (listener: (nextDoc: DrawingDocument) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };

  return {
    storeAdapter,
    async reset(options) {
      const nextSize = options?.documentSize ?? doc.size;
      doc = createDocument(undefined, registry, nextSize);
      for (const listener of listeners) {
        listener(doc);
      }
      return storeAdapter;
    },
    destroy() {},
  };
}

function createDelayedResetCore(
  delayMs: number,
  initialSize = { width: 960, height: 600 },
): SmalldrawCore {
  const base = createMockCore(initialSize);
  return {
    ...base,
    async reset(options) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return base.reset(options);
    },
  };
}

describe("kids-app shell", () => {
  test("mounts and unmounts cleanly with tile and hot layers", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const app = await createKidsDrawApp({
      container,
      width: 640,
      height: 480,
      core: createMockCore({ width: 640, height: 480 }),
    });

    const root = container.querySelector(
      ".kids-draw-app",
    ) as HTMLElement | null;
    expect(root).not.toBeNull();
    const frame = container.querySelector(
      ".kids-draw-frame",
    ) as HTMLElement | null;
    expect(frame).not.toBeNull();
    expect(frame?.style.height).toBe("480px");

    const hotCanvas = container.querySelector(
      "canvas.kids-draw-hot",
    ) as HTMLCanvasElement | null;
    expect(hotCanvas).not.toBeNull();
    expect(hotCanvas?.width).toBe(640);
    expect(hotCanvas?.height).toBe(480);

    const tileCanvas = container.querySelector(
      ".kids-draw-tiles canvas",
    ) as HTMLCanvasElement | null;
    expect(tileCanvas).not.toBeNull();
    expect(tileCanvas?.width).toBeGreaterThan(0);
    expect(tileCanvas?.height).toBeGreaterThan(0);

    app.destroy();
    expect(container.querySelector(".kids-draw-app")).toBeNull();
  });

  test("smoke flow: pointer input creates pen/eraser strokes and settings update", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const app = await createKidsDrawApp({
      container,
      width: 640,
      height: 480,
      core: createMockCore({ width: 640, height: 480 }),
    });
    const overlay = app.overlay as HTMLElement;
    overlay.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        width: 640,
        height: 480,
        left: 0,
        top: 0,
        right: 640,
        bottom: 480,
        toJSON() {
          return {};
        },
      }) as DOMRect;

    const colorInput = container.querySelector(
      'input[data-setting="color"]',
    ) as HTMLInputElement | null;
    const sizeInput = container.querySelector(
      'input[data-setting="size"]',
    ) as HTMLInputElement | null;
    const undoButton = container.querySelector(
      'button[data-action="undo"]',
    ) as HTMLButtonElement | null;
    const redoButton = container.querySelector(
      'button[data-action="redo"]',
    ) as HTMLButtonElement | null;
    const clearButton = container.querySelector(
      'button[data-action="clear"]',
    ) as HTMLButtonElement | null;
    const newDrawingButton = container.querySelector(
      'button[data-action="new-drawing"]',
    ) as HTMLButtonElement | null;
    const tileLayer = container.querySelector(
      ".kids-draw-tiles",
    ) as HTMLDivElement | null;
    expect(colorInput).not.toBeNull();
    expect(sizeInput).not.toBeNull();
    expect(undoButton).not.toBeNull();
    expect(redoButton).not.toBeNull();
    expect(clearButton).not.toBeNull();
    expect(newDrawingButton).not.toBeNull();
    expect(tileLayer).not.toBeNull();
    expect(undoButton!.disabled).toBeTrue();

    colorInput!.value = "#ff0000";
    dispatchInput(colorInput!);
    sizeInput!.value = "14";
    dispatchInput(sizeInput!);

    dispatchPointer(overlay, "pointerdown", 60, 60, 1);
    dispatchPointer(overlay, "pointermove", 180, 180, 1);
    dispatchPointer(overlay, "pointerup", 180, 180, 0);
    expect(undoButton!.disabled).toBeFalse();
    clearButton!.click();

    const eraserButton = container.querySelector(
      'button[data-tool="eraser"]',
    ) as HTMLButtonElement | null;
    expect(eraserButton).not.toBeNull();
    eraserButton!.click();
    dispatchPointer(overlay, "pointerdown", 100, 100, 1);
    dispatchPointer(overlay, "pointermove", 220, 220, 1);
    await waitForTurn();
    expect(["", "hidden"]).toContain(tileLayer!.style.visibility);
    dispatchPointer(overlay, "pointerup", 220, 220, 0);
    await waitForTurn();
    expect(tileLayer!.style.visibility).toBe("");

    const shapes = Object.values(app.store.getDocument().shapes);
    expect(shapes).toHaveLength(3);

    const penShape = shapes.find((shape) => shape.id.startsWith("pen-"));
    const eraserShape = shapes.find((shape) => shape.id.startsWith("eraser-"));
    const clearShape = shapes.find((shape) => shape.type === "clear");
    expect(penShape).toBeDefined();
    expect(eraserShape).toBeDefined();
    expect(clearShape).toBeDefined();

    const penStroke = penShape?.style.stroke;
    expect(penStroke?.color?.toLowerCase()).toBe("#ff0000");
    expect(penStroke?.size).toBe(14);

    const eraserStroke = eraserShape?.style.stroke;
    expect(eraserStroke?.compositeOp).toBe("destination-out");
    expect(eraserStroke?.size).toBe(14);

    newDrawingButton!.click();
    const resetSettled = await waitUntil(() => {
      return (
        Object.values(app.store.getDocument().shapes).length === 0 &&
        undoButton!.disabled === true &&
        redoButton!.disabled === true
      );
    }, 100);
    expect(resetSettled).toBeTrue();

    app.destroy();
  });

  test("new drawing re-resolves logical size from page size when size is implicit", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const originalInnerWidth = window.innerWidth;
    const originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 900,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 700,
    });

    let app: Awaited<ReturnType<typeof createKidsDrawApp>> | null = null;
    try {
      app = await createKidsDrawApp({
        container,
        core: createMockCore({ width: 900, height: 620 }),
      });

      const hotCanvas = container.querySelector(
        "canvas.kids-draw-hot",
      ) as HTMLCanvasElement | null;
      const newDrawingButton = container.querySelector(
        'button[data-action="new-drawing"]',
      ) as HTMLButtonElement | null;
      expect(hotCanvas).not.toBeNull();
      expect(newDrawingButton).not.toBeNull();
      expect(hotCanvas!.style.width).toBe("900px");
      expect(hotCanvas!.style.height).toBe("620px");

      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        writable: true,
        value: 500,
      });
      Object.defineProperty(window, "innerHeight", {
        configurable: true,
        writable: true,
        value: 800,
      });

      newDrawingButton!.click();
      const resized = await waitUntil(() => {
        return (
          hotCanvas!.style.width === "500px" &&
          hotCanvas!.style.height === "720px"
        );
      }, 100);
      expect(resized).toBeTrue();
    } finally {
      app?.destroy();
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        writable: true,
        value: originalInnerWidth,
      });
      Object.defineProperty(window, "innerHeight", {
        configurable: true,
        writable: true,
        value: originalInnerHeight,
      });
    }
  });

  test("uses persisted document size on load", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const app = await createKidsDrawApp({
      container,
      core: createMockCore({ width: 777, height: 333 }),
    });

    const hotCanvas = container.querySelector(
      "canvas.kids-draw-hot",
    ) as HTMLCanvasElement | null;
    expect(hotCanvas).not.toBeNull();
    expect(hotCanvas!.style.width).toBe("777px");
    expect(hotCanvas!.style.height).toBe("333px");

    app.destroy();
  });

  test("destroy during async new drawing reset does not leak effects", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const app = await createKidsDrawApp({
      container,
      core: createDelayedResetCore(30),
    });
    const newDrawingButton = container.querySelector(
      'button[data-action="new-drawing"]',
    ) as HTMLButtonElement | null;
    expect(newDrawingButton).not.toBeNull();

    newDrawingButton!.click();
    app.destroy();
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(container.querySelector(".kids-draw-app")).toBeNull();
  });

  test("pointer move uses coalesced samples when available and falls back otherwise", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const app = await createKidsDrawApp({
      container,
      width: 640,
      height: 480,
      core: createMockCore({ width: 640, height: 480 }),
    });
    const overlay = app.overlay as HTMLElement;
    overlay.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        width: 640,
        height: 480,
        left: 0,
        top: 0,
        right: 640,
        bottom: 480,
        toJSON() {
          return {};
        },
      }) as DOMRect;

    dispatchPointer(overlay, "pointerdown", 50, 50, 1);
    dispatchPointerMoveWithCoalesced(
      overlay,
      130,
      130,
      [
        { x: 70, y: 70 },
        { x: 90, y: 90 },
        { x: 90, y: 90 },
        { x: 120, y: 120 },
      ],
      1,
    );
    dispatchPointer(overlay, "pointerup", 120, 120, 0);

    const shapesAfterCoalesced = Object.values(app.store.getDocument().shapes);
    expect(shapesAfterCoalesced).toHaveLength(1);
    const firstStrokePoints = getWorldPointsFromShape(
      shapesAfterCoalesced[0] as PenShape,
    );
    expect(firstStrokePoints).toEqual([
      [50, 50],
      [70, 70],
      [90, 90],
      [120, 120],
    ]);

    const firstSummary = (globalThis as Record<string, unknown>)
      .__kidsDrawPerf as
      | {
          lastStrokeSummary?: {
            pointerMoveEvents: number;
            pointerSamples: number;
            coalescedEvents: number;
          };
        }
      | undefined;
    expect(firstSummary?.lastStrokeSummary?.pointerMoveEvents).toBe(1);
    expect(firstSummary?.lastStrokeSummary?.pointerSamples).toBe(3);
    expect(firstSummary?.lastStrokeSummary?.coalescedEvents).toBe(1);

    dispatchPointer(overlay, "pointerdown", 10, 10, 1);
    dispatchPointer(overlay, "pointermove", 30, 20, 1);
    dispatchPointer(overlay, "pointerup", 30, 20, 0);

    const secondSummary = (globalThis as Record<string, unknown>)
      .__kidsDrawPerf as
      | {
          lastStrokeSummary?: {
            pointerMoveEvents: number;
            pointerSamples: number;
            coalescedEvents: number;
          };
        }
      | undefined;
    expect(secondSummary?.lastStrokeSummary?.pointerMoveEvents).toBe(1);
    expect(secondSummary?.lastStrokeSummary?.pointerSamples).toBe(1);
    expect(secondSummary?.lastStrokeSummary?.coalescedEvents).toBe(0);

    app.destroy();
  });
});
