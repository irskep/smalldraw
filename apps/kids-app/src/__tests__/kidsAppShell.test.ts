import { describe, expect, test } from "bun:test";
import {
  type ActionContext,
  applyActionToDoc,
  createDocument,
  type DrawingDocument,
  type DrawingDocumentData,
  type DrawingStoreActionEvent,
  type PenShape,
  type SmalldrawCore,
} from "@smalldraw/core";
import { getWorldPointsFromShape } from "@smalldraw/testing";
import { createKidsDrawApp } from "../createKidsDrawApp";
import { resolvePageSize } from "../layout/responsiveLayout";
import { createKidsShapeHandlerRegistry } from "../shapes/kidsShapeHandlers";

type DisableableElement = HTMLElement & { disabled: boolean };

function dispatchPointer(
  overlay: HTMLElement,
  type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
  x: number,
  y: number,
  buttons = 1,
  pointerType = "mouse",
): void {
  const event = new PointerEvent(type, {
    bubbles: true,
    clientX: x,
    clientY: y,
    buttons,
    pointerType,
    pointerId: 1,
  });
  overlay.dispatchEvent(event);
}

function dispatchPointerLeave(overlay: HTMLElement): void {
  const event = new PointerEvent("pointerleave", {
    bubbles: true,
    pointerId: 1,
    pointerType: "mouse",
  });
  overlay.dispatchEvent(event);
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
  const registry = createKidsShapeHandlerRegistry();
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
      confirmDestructiveAction: async () => true,
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
    const defaultColorSwatch = container.querySelector(
      'button[data-setting="stroke-color"][data-color="#000000"]',
    ) as HTMLButtonElement | null;
    expect(tileCanvas).not.toBeNull();
    expect(tileCanvas?.width).toBeGreaterThan(0);
    expect(tileCanvas?.height).toBeGreaterThan(0);
    expect(defaultColorSwatch).not.toBeNull();
    expect(defaultColorSwatch?.classList.contains("is-selected")).toBeTrue();

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
      confirmDestructiveAction: async () => true,
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

    const colorSwatch = container.querySelector(
      'button[data-setting="stroke-color"][data-color="#ff4d6d"]',
    ) as HTMLButtonElement | null;
    const widthButton = container.querySelector(
      'button[data-setting="stroke-width"][data-size="24"]',
    ) as HTMLButtonElement | null;
    const undoButton = container.querySelector(
      '[data-action="undo"]',
    ) as DisableableElement | null;
    const redoButton = container.querySelector(
      '[data-action="redo"]',
    ) as DisableableElement | null;
    const clearButton = container.querySelector(
      '[data-action="clear"]',
    ) as HTMLElement | null;
    const newDrawingButton = container.querySelector(
      '[data-action="new-drawing"]',
    ) as DisableableElement | null;
    const tileLayer = container.querySelector(
      ".kids-draw-tiles",
    ) as HTMLDivElement | null;
    expect(colorSwatch).not.toBeNull();
    expect(widthButton).not.toBeNull();
    expect(undoButton).not.toBeNull();
    expect(redoButton).not.toBeNull();
    expect(clearButton).not.toBeNull();
    expect(newDrawingButton).not.toBeNull();
    expect(tileLayer).not.toBeNull();
    expect(undoButton!.disabled).toBeTrue();

    colorSwatch!.click();
    widthButton!.click();

    dispatchPointer(overlay, "pointerdown", 60, 60, 1);
    dispatchPointer(overlay, "pointermove", 180, 180, 1);
    dispatchPointer(overlay, "pointerup", 180, 180, 0);
    expect(undoButton!.disabled).toBeFalse();
    clearButton!.click();

    const eraserFamilyButton = container.querySelector(
      '.kids-draw-tool-selector [data-tool-family="eraser"]',
    ) as HTMLElement | null;
    const markerVariantButton = container.querySelector(
      '[data-tool-variant="brush.marker"]',
    ) as HTMLElement | null;
    const penVariantButton = container.querySelector(
      '[data-tool-variant="brush.freehand"]',
    ) as HTMLElement | null;
    expect(eraserFamilyButton).not.toBeNull();
    expect(markerVariantButton).not.toBeNull();
    expect(penVariantButton).not.toBeNull();
    markerVariantButton!.click();
    expect(app.store.getActiveToolId()).toBe("brush.marker");
    penVariantButton!.click();
    expect(app.store.getActiveToolId()).toBe("brush.freehand");
    eraserFamilyButton!.click();
    expect(app.store.getActiveToolId()).toBe("eraser.basic");
    dispatchPointer(overlay, "pointerdown", 100, 100, 1);
    dispatchPointer(overlay, "pointermove", 220, 220, 1);
    await waitForTurn();
    expect(["", "hidden"]).toContain(tileLayer!.style.visibility);
    dispatchPointer(overlay, "pointerup", 220, 220, 0);
    await waitForTurn();
    expect(tileLayer!.style.visibility).toBe("");

    const shapes = Object.values(app.store.getDocument().shapes);
    expect(shapes).toHaveLength(3);

    const penShape = shapes.find((shape) =>
      shape.id.startsWith("brush-freehand-"),
    );
    const eraserShape = shapes.find((shape) =>
      shape.id.startsWith("eraser-basic-"),
    );
    const clearShape = shapes.find((shape) => shape.type === "clear");
    expect(penShape).toBeDefined();
    expect(eraserShape).toBeDefined();
    expect(clearShape).toBeDefined();

    const penStroke = penShape?.style.stroke;
    expect(penStroke?.color?.toLowerCase()).toBe("#ff4d6d");
    expect(penStroke?.size).toBe(24);

    const eraserStroke = eraserShape?.style.stroke;
    expect(eraserStroke?.compositeOp).toBe("destination-out");
    expect(eraserStroke?.size).toBe(24);

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

  test("filled/outline shape families preserve sub-shape and draw boxed kinds", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const app = await createKidsDrawApp({
      container,
      width: 640,
      height: 480,
      core: createMockCore({ width: 640, height: 480 }),
      confirmDestructiveAction: async () => true,
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

    const filledShapeFamilyButton = container.querySelector(
      '.kids-draw-tool-selector [data-tool-family="shape.filled"]',
    ) as HTMLElement | null;
    const outlineShapeFamilyButton = container.querySelector(
      '.kids-draw-tool-selector [data-tool-family="shape.outline"]',
    ) as HTMLElement | null;
    const yellowColorSwatch = container.querySelector(
      'button[data-setting="stroke-color"][data-color="#ffdb4d"]',
    ) as DisableableElement | null;
    const grayColorSwatch = container.querySelector(
      'button[data-setting="stroke-color"][data-color="#9ca3af"]',
    ) as DisableableElement | null;
    const rectVariantButton = container.querySelector(
      '[data-tool-variant="rect"]',
    ) as HTMLElement | null;
    const rectOutlineVariantButton = container.querySelector(
      '[data-tool-variant="rect.outline"]',
    ) as HTMLElement | null;
    const ellipseVariantButton = container.querySelector(
      '[data-tool-variant="ellipse"]',
    ) as HTMLElement | null;
    const ellipseOutlineVariantButton = container.querySelector(
      '[data-tool-variant="ellipse.outline"]',
    ) as HTMLElement | null;
    expect(filledShapeFamilyButton).not.toBeNull();
    expect(outlineShapeFamilyButton).not.toBeNull();
    expect(yellowColorSwatch).not.toBeNull();
    expect(grayColorSwatch).not.toBeNull();
    expect(rectVariantButton).not.toBeNull();
    expect(rectOutlineVariantButton).not.toBeNull();
    expect(ellipseVariantButton).not.toBeNull();
    expect(ellipseOutlineVariantButton).not.toBeNull();

    filledShapeFamilyButton!.click();
    expect(app.store.getActiveToolId()).toBe("rect");
    yellowColorSwatch!.click();
    expect(app.store.getSharedSettings().strokeColor).toBe("#ffdb4d");
    expect(app.store.getSharedSettings().fillColor).toBe("#ffffff");

    ellipseVariantButton!.click();
    expect(app.store.getActiveToolId()).toBe("ellipse");
    outlineShapeFamilyButton!.click();
    expect(app.store.getActiveToolId()).toBe("ellipse.outline");
    dispatchPointer(overlay, "pointerdown", 80, 80, 1);
    dispatchPointer(overlay, "pointermove", 200, 140, 1);
    dispatchPointer(overlay, "pointerup", 200, 140, 0);
    filledShapeFamilyButton!.click();
    expect(app.store.getActiveToolId()).toBe("ellipse");

    grayColorSwatch!.click();
    expect(app.store.getSharedSettings().strokeColor).toBe("#9ca3af");
    outlineShapeFamilyButton!.click();
    rectOutlineVariantButton!.click();
    expect(app.store.getActiveToolId()).toBe("rect.outline");

    dispatchPointer(overlay, "pointerdown", 120, 180, 1);
    dispatchPointer(overlay, "pointermove", 220, 260, 1);
    dispatchPointer(overlay, "pointerup", 220, 260, 0);

    filledShapeFamilyButton!.click();
    rectVariantButton!.click();
    expect(app.store.getActiveToolId()).toBe("rect");
    dispatchPointer(overlay, "pointerdown", 240, 180, 1);
    dispatchPointer(overlay, "pointermove", 340, 260, 1);
    dispatchPointer(overlay, "pointerup", 340, 260, 0);

    const shapes = Object.values(app.store.getDocument().shapes);
    const ellipse = shapes.find(
      (shape) =>
        shape.type === "boxed" &&
        shape.geometry.type === "boxed" &&
        "kind" in shape.geometry &&
        shape.geometry.kind === "ellipse",
    );
    const rectOutline = shapes.find(
      (shape) =>
        shape.type === "boxed" &&
        shape.geometry.type === "boxed" &&
        "kind" in shape.geometry &&
        shape.geometry.kind === "rect" &&
        shape.style.fill?.type === "solid" &&
        shape.style.fill.color.toLowerCase() === "transparent",
    );
    const rectFilled = shapes.find(
      (shape) =>
        shape.type === "boxed" &&
        shape.geometry.type === "boxed" &&
        "kind" in shape.geometry &&
        shape.geometry.kind === "rect" &&
        shape.style.fill?.type === "solid" &&
        shape.style.fill.color.toLowerCase() === "#9ca3af",
    );
    expect(ellipse).toBeDefined();
    expect(rectOutline).toBeDefined();
    expect(rectFilled).toBeDefined();
    if (ellipse?.style.fill?.type === "solid") {
      expect(ellipse.style.fill.color.toLowerCase()).toBe("transparent");
    } else {
      throw new Error("Expected ellipse to use a solid fill.");
    }

    const brushFamilyButton = container.querySelector(
      '.kids-draw-tool-selector [data-tool-family="brush"]',
    ) as HTMLElement | null;
    const penVariantButton = container.querySelector(
      '[data-tool-variant="brush.freehand"]',
    ) as HTMLElement | null;
    expect(brushFamilyButton).not.toBeNull();
    expect(penVariantButton).not.toBeNull();
    brushFamilyButton!.click();
    penVariantButton!.click();
    const sharedAfterPen = app.store.getSharedSettings();
    expect(sharedAfterPen.strokeColor).toBe("#9ca3af");
    expect(sharedAfterPen.fillColor).toBe("#ffffff");

    app.destroy();
  });

  test("letters stamp family shows A cursor preview, row-major flow, and stamps selected letters", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const app = await createKidsDrawApp({
      container,
      width: 640,
      height: 480,
      core: createMockCore({ width: 640, height: 480 }),
      confirmDestructiveAction: async () => true,
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

    const lettersFamilyButton = container.querySelector(
      '.kids-draw-tool-selector [data-tool-family="stamp.alphabet"]',
    ) as HTMLElement | null;
    const lettersToolbar = container.querySelector(
      '[data-tool-family-toolbar="stamp.alphabet"]',
    ) as HTMLElement | null;
    const stampZVariantButton = container.querySelector(
      '[data-tool-variant="stamp.letter.z"]',
    ) as HTMLElement | null;
    const cursorIndicator = container.querySelector(
      ".kids-draw-cursor-indicator",
    ) as HTMLDivElement | null;

    expect(lettersFamilyButton).not.toBeNull();
    expect(lettersToolbar).not.toBeNull();
    expect(stampZVariantButton).not.toBeNull();
    expect(cursorIndicator).not.toBeNull();
    expect(lettersFamilyButton?.getAttribute("title")).toBe("Letters");
    expect(lettersToolbar?.getAttribute("data-variant-layout")).toBe(
      "two-row-single-height",
    );
    const variantButtons = lettersToolbar?.querySelectorAll(
      "[data-tool-variant]",
    );
    expect(variantButtons?.length).toBe(26);
    const firstVariantLabel = lettersToolbar?.querySelector(
      '[data-tool-variant="stamp.letter.a"] .kids-square-icon-button__label',
    ) as HTMLElement | null;
    expect(firstVariantLabel?.hidden).toBeTrue();

    lettersFamilyButton!.click();
    expect(app.store.getActiveToolId()).toBe("stamp.letter.a");
    dispatchPointer(overlay, "pointermove", 140, 110, 0, "mouse");
    expect(cursorIndicator!.classList.contains("is-glyph-preview")).toBeTrue();
    expect(cursorIndicator!.style.visibility).toBe("");

    stampZVariantButton!.click();
    expect(app.store.getActiveToolId()).toBe("stamp.letter.z");
    dispatchPointer(overlay, "pointerdown", 200, 200, 1, "mouse");
    dispatchPointer(overlay, "pointerup", 200, 200, 0, "mouse");
    const stampPop = container.querySelector(
      ".kids-draw-stamp-pop",
    ) as HTMLElement | null;
    expect(stampPop).not.toBeNull();

    const shapes = Object.values(app.store.getDocument().shapes);
    expect(shapes.length).toBeGreaterThanOrEqual(1);
    for (const shape of shapes) {
      expect(shape.id.startsWith("stamp-letter-z-")).toBeTrue();
      expect(shape.type).toBe("stamp");
    }

    app.destroy();
  });

  test("cursor indicator hides for pen while drawing and remains subtle for eraser", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const app = await createKidsDrawApp({
      container,
      width: 640,
      height: 480,
      core: createMockCore({ width: 640, height: 480 }),
      confirmDestructiveAction: async () => true,
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

    const cursorIndicator = container.querySelector(
      ".kids-draw-cursor-indicator",
    ) as HTMLDivElement | null;
    const brushFamilyButton = container.querySelector(
      '.kids-draw-tool-selector [data-tool-family="brush"]',
    ) as HTMLElement | null;
    const penVariantButton = container.querySelector(
      '[data-tool-variant="brush.freehand"]',
    ) as HTMLElement | null;
    const eraserFamilyButton = container.querySelector(
      '.kids-draw-tool-selector [data-tool-family="eraser"]',
    ) as HTMLElement | null;
    expect(cursorIndicator).not.toBeNull();
    expect(brushFamilyButton).not.toBeNull();
    expect(penVariantButton).not.toBeNull();
    expect(eraserFamilyButton).not.toBeNull();
    expect(cursorIndicator!.style.visibility).toBe("hidden");

    dispatchPointer(overlay, "pointermove", 120, 100, 0, "mouse");
    expect(cursorIndicator!.style.visibility).toBe("");
    expect(cursorIndicator!.style.width).toBe("6px");
    expect(cursorIndicator!.style.height).toBe("6px");

    dispatchPointer(overlay, "pointerdown", 120, 100, 1, "mouse");
    expect(cursorIndicator!.style.visibility).toBe("hidden");
    dispatchPointer(overlay, "pointerup", 120, 100, 0, "mouse");

    eraserFamilyButton!.click();
    dispatchPointer(overlay, "pointermove", 140, 110, 0, "mouse");
    expect(cursorIndicator!.style.visibility).toBe("");
    dispatchPointer(overlay, "pointerdown", 140, 110, 1, "mouse");
    expect(cursorIndicator!.style.visibility).toBe("");
    dispatchPointer(overlay, "pointerup", 140, 110, 0, "mouse");

    brushFamilyButton!.click();
    penVariantButton!.click();
    dispatchPointer(overlay, "pointermove", 160, 120, 0, "touch");
    expect(cursorIndicator!.style.visibility).toBe("hidden");

    dispatchPointer(overlay, "pointermove", 180, 130, 0, "mouse");
    expect(cursorIndicator!.style.visibility).toBe("");

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
        confirmDestructiveAction: async () => true,
      });

      const hotCanvas = container.querySelector(
        "canvas.kids-draw-hot",
      ) as HTMLCanvasElement | null;
      const newDrawingButton = container.querySelector(
        '[data-action="new-drawing"]',
      ) as HTMLElement | null;
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
      const expectedSize = resolvePageSize({ width: 0, height: 0 });

      newDrawingButton!.click();
      const resized = await waitUntil(() => {
        return (
          hotCanvas!.style.width === `${expectedSize.width}px` &&
          hotCanvas!.style.height === `${expectedSize.height}px`
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
      confirmDestructiveAction: async () => true,
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
      confirmDestructiveAction: async () => true,
    });
    const newDrawingButton = container.querySelector(
      '[data-action="new-drawing"]',
    ) as HTMLElement | null;
    expect(newDrawingButton).not.toBeNull();

    newDrawingButton!.click();
    app.destroy();
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(container.querySelector(".kids-draw-app")).toBeNull();
  });

  test("pointer move samples honor coalesced-events feature flag", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const app = await createKidsDrawApp({
      container,
      width: 640,
      height: 480,
      core: createMockCore({ width: 640, height: 480 }),
      confirmDestructiveAction: async () => true,
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
    const firstStrokePointsRounded = firstStrokePoints.map(([x, y]) => [
      Math.round(x),
      Math.round(y),
    ]);
    expect(firstStrokePointsRounded).toEqual([
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

  test("pointer leaving paper mid-stroke does not cancel commit", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const app = await createKidsDrawApp({
      container,
      width: 640,
      height: 480,
      core: createMockCore({ width: 640, height: 480 }),
      confirmDestructiveAction: async () => true,
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

    dispatchPointer(overlay, "pointerdown", 80, 80, 1);
    dispatchPointer(overlay, "pointermove", 140, 120, 1);
    dispatchPointerLeave(overlay);
    dispatchPointer(overlay, "pointerup", 140, 120, 0);

    const shapes = Object.values(app.store.getDocument().shapes) as PenShape[];
    expect(shapes).toHaveLength(1);
    const worldPoints = getWorldPointsFromShape(shapes[0]!);
    expect(worldPoints.length).toBeGreaterThan(1);

    app.destroy();
  });

  test("pointer up on window after leaving paper still commits active stroke", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const app = await createKidsDrawApp({
      container,
      width: 640,
      height: 480,
      core: createMockCore({ width: 640, height: 480 }),
      confirmDestructiveAction: async () => true,
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

    dispatchPointer(overlay, "pointerdown", 100, 100, 1);
    dispatchPointer(overlay, "pointermove", 180, 160, 1);
    dispatchPointerLeave(overlay);
    window.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        pointerId: 1,
        pointerType: "mouse",
        clientX: 180,
        clientY: 160,
        buttons: 0,
      }),
    );

    const shapes = Object.values(app.store.getDocument().shapes) as PenShape[];
    expect(shapes).toHaveLength(1);
    const worldPoints = getWorldPointsFromShape(shapes[0]!);
    expect(worldPoints.length).toBeGreaterThan(1);

    app.destroy();
  });
});
