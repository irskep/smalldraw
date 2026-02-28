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
import { getColoringPageById } from "../coloring/catalog";
import { createKidsDrawApp } from "../createKidsDrawApp";
import type {
  KidsDocumentBackend,
  KidsDocumentCreateInput,
  KidsDocumentSummary,
} from "../documents";
import { resolvePageSize } from "../layout/responsiveLayout";
import { createKidsShapeRendererRegistry } from "../render/kidsShapeRendererRegistry";
import { createKidsShapeHandlerRegistry } from "../shapes/kidsShapeHandlers";
import { createKidsToolCatalog } from "../tools/kidsTools";
import { getToolbarUiStorageKeyForDocument } from "../ui/stores/toolbarUiStore";

type DisableableElement = HTMLElement & { disabled: boolean };

function dispatchPointer(
  overlay: HTMLElement,
  type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
  x: number,
  y: number,
  buttons = 1,
  pointerType = "mouse",
  pointerId = 1,
): void {
  const event = new PointerEvent(type, {
    bubbles: true,
    clientX: x,
    clientY: y,
    buttons,
    pointerType,
    pointerId,
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

async function waitForToolbarUiPersistence(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 220));
  await waitForTurn();
}

function getMockDocUiStateStorageKey(): string {
  return getToolbarUiStorageKeyForDocument("automerge:mock-1");
}

function createMockDocumentBackend(
  initialDocuments: KidsDocumentSummary[],
  currentDocUrl: string | null,
): KidsDocumentBackend {
  const documentsByUrl = new Map(
    initialDocuments.map((document) => [document.docUrl, document] as const),
  );
  const thumbnailsByUrl = new Map<string, Blob>();
  let current = currentDocUrl;

  const now = (): string => new Date().toISOString();

  return {
    mode: "local",
    async listDocuments() {
      return Array.from(documentsByUrl.values()).sort(
        (a, b) => Date.parse(b.lastOpenedAt) - Date.parse(a.lastOpenedAt),
      );
    },
    async getDocument(docUrl) {
      return documentsByUrl.get(docUrl) ?? null;
    },
    async createDocument(input: KidsDocumentCreateInput) {
      const timestamp = now();
      const existing = documentsByUrl.get(input.docUrl);
      const next: KidsDocumentSummary = {
        docUrl: input.docUrl,
        title: input.title ?? existing?.title,
        mode: input.mode ?? existing?.mode ?? "normal",
        coloringPageId:
          input.mode === "normal"
            ? undefined
            : (input.coloringPageId ?? existing?.coloringPageId),
        referenceImageSrc:
          input.mode === "normal"
            ? undefined
            : (input.referenceImageSrc ?? existing?.referenceImageSrc),
        referenceComposite:
          input.mode === "normal"
            ? undefined
            : (input.referenceComposite ?? existing?.referenceComposite),
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
        lastOpenedAt: timestamp,
      };
      documentsByUrl.set(next.docUrl, next);
      return next;
    },
    async touchDocument(docUrl) {
      const timestamp = now();
      const existing = documentsByUrl.get(docUrl);
      const next: KidsDocumentSummary = existing
        ? {
            ...existing,
            updatedAt: timestamp,
            lastOpenedAt: timestamp,
          }
        : {
            docUrl,
            mode: "normal",
            createdAt: timestamp,
            updatedAt: timestamp,
            lastOpenedAt: timestamp,
          };
      documentsByUrl.set(docUrl, next);
      return next;
    },
    async deleteDocument(docUrl) {
      documentsByUrl.delete(docUrl);
      thumbnailsByUrl.delete(docUrl);
      if (current === docUrl) {
        current = null;
      }
    },
    async saveThumbnail(docUrl, blob) {
      thumbnailsByUrl.set(docUrl, blob);
    },
    async getThumbnail(docUrl) {
      return thumbnailsByUrl.get(docUrl) ?? null;
    },
    async setCurrentDocument(docUrl) {
      current = docUrl;
    },
    async getCurrentDocument() {
      return current;
    },
  };
}

function createMockCore(
  initialSize = { width: 960, height: 600 },
): SmalldrawCore {
  const registry = createKidsShapeHandlerRegistry();
  const docByUrl = new Map<string, DrawingDocument>();
  let docCounter = 0;
  const createDocUrl = (): string => `automerge:mock-${++docCounter}`;
  let currentDocUrl = createDocUrl();
  let doc = createDocument(undefined, registry, initialSize);
  docByUrl.set(currentDocUrl, doc);
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
      docByUrl.set(currentDocUrl, doc);
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
    getCurrentDocUrl() {
      return currentDocUrl;
    },
    async open(url) {
      const nextDoc = docByUrl.get(url);
      if (!nextDoc) {
        throw new Error(`Missing mock document for url: ${url}`);
      }
      currentDocUrl = url;
      doc = nextDoc;
      for (const listener of listeners) {
        listener(doc);
      }
      return storeAdapter;
    },
    async createNew(options) {
      const nextSize = options?.documentSize ?? doc.size;
      const nextPresentation =
        options?.documentPresentation ?? doc.presentation;
      currentDocUrl = createDocUrl();
      doc = createDocument(undefined, registry, nextSize, nextPresentation);
      docByUrl.set(currentDocUrl, doc);
      for (const listener of listeners) {
        listener(doc);
      }
      return {
        url: currentDocUrl,
        adapter: storeAdapter,
      };
    },
    async reset(options) {
      const created = await this.createNew(options);
      return created.adapter;
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
    async createNew(options) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return base.createNew(options);
    },
    async reset(options) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return base.reset(options);
    },
  };
}

describe("splatterboard shell", () => {
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
    const activeToolVariant = container.querySelector(
      '[data-tool-variant][aria-checked="true"]',
    ) as HTMLButtonElement | null;
    const selectedStrokeWidth = container.querySelector(
      'button[data-setting="stroke-width"][aria-checked="true"]',
    ) as HTMLButtonElement | null;
    expect(tileCanvas).not.toBeNull();
    expect(tileCanvas?.width).toBeGreaterThan(0);
    expect(tileCanvas?.height).toBeGreaterThan(0);
    expect(defaultColorSwatch).not.toBeNull();
    expect(activeToolVariant).not.toBeNull();
    expect(selectedStrokeWidth).not.toBeNull();
    expect(defaultColorSwatch?.classList.contains("is-selected")).toBeTrue();
    expect(defaultColorSwatch?.getAttribute("role")).toBe("radio");
    expect(defaultColorSwatch?.getAttribute("aria-checked")).toBe("true");
    expect(activeToolVariant?.getAttribute("role")).toBe("radio");
    expect(selectedStrokeWidth?.getAttribute("role")).toBe("radio");
    expect(
      container.querySelector('[role="radiogroup"] [aria-pressed]'),
    ).toBeNull();

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
    const exportButton = container.querySelector(
      '[data-action="export"]',
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
    expect(exportButton).not.toBeNull();
    expect(newDrawingButton).not.toBeNull();
    expect(tileLayer).not.toBeNull();
    expect(undoButton!.disabled).toBeTrue();

    colorSwatch!.click();
    widthButton!.click();

    dispatchPointer(overlay, "pointerdown", 60, 60, 1);
    dispatchPointer(overlay, "pointermove", 180, 180, 1);
    dispatchPointer(overlay, "pointerup", 180, 180, 0);
    expect(undoButton!.disabled).toBeFalse();
    const firstStroke = Object.values(app.store.getDocument().shapes).find(
      (shape) => shape.type === "pen",
    );
    expect(firstStroke).toBeDefined();
    expect(firstStroke?.style.stroke?.color?.toLowerCase()).toBe("#ff4d6d");
    expect(firstStroke?.style.stroke?.size).toBe(24);

    exportButton!.click();

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
    expect(shapes.length).toBeGreaterThanOrEqual(2);

    const eraserShape = shapes.find((shape) =>
      shape.id.startsWith("eraser-basic-"),
    );
    const clearShape = shapes.find((shape) => shape.type === "clear");
    expect(eraserShape).toBeDefined();
    expect(clearShape).toBeDefined();

    const eraserStroke = eraserShape?.style.stroke;
    expect(eraserStroke?.compositeOp).toBe("destination-out");
    expect(eraserStroke?.size).toBe(24);

    newDrawingButton!.click();
    const createNormalButton = container.querySelector(
      '[data-doc-browser-create-normal="true"]',
    ) as HTMLButtonElement | null;
    expect(createNormalButton).not.toBeNull();
    createNormalButton!.click();
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

  test("document browser opens from actions and switches documents", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const core = createMockCore({ width: 640, height: 480 });
    const firstDocUrl = core.getCurrentDocUrl();
    const secondDoc = await core.createNew({
      documentSize: { width: 320, height: 240 },
    });
    const secondDocUrl = secondDoc.url;
    await core.open(firstDocUrl);

    const documentBackend = createMockDocumentBackend(
      [
        {
          docUrl: firstDocUrl,
          mode: "normal",
          createdAt: "2026-02-16T00:00:00.000Z",
          updatedAt: "2026-02-16T00:00:00.000Z",
          lastOpenedAt: "2026-02-16T00:00:00.000Z",
        },
        {
          docUrl: secondDocUrl,
          mode: "normal",
          createdAt: "2026-02-16T00:00:00.000Z",
          updatedAt: "2026-02-16T00:00:00.000Z",
          lastOpenedAt: "2026-02-16T00:00:00.000Z",
        },
      ],
      firstDocUrl,
    );

    const app = await createKidsDrawApp({
      container,
      width: 640,
      height: 480,
      core,
      documentBackend,
      confirmDestructiveAction: async () => true,
    });

    const browseButton = container.querySelector(
      '[data-action="browse"]',
    ) as HTMLButtonElement | null;
    expect(browseButton).not.toBeNull();
    browseButton!.click();

    const browser = container.querySelector(
      ".kids-draw-document-browser",
    ) as HTMLDivElement | null;
    expect(browser).not.toBeNull();
    expect(browser?.hidden).toBeFalse();

    const openButtonReady = await waitUntil(() => {
      return (
        container.querySelector(`[data-doc-browser-open="${secondDocUrl}"]`) !==
        null
      );
    });
    expect(openButtonReady).toBeTrue();
    const openSecondButton = container.querySelector(
      `[data-doc-browser-open="${secondDocUrl}"]`,
    ) as HTMLButtonElement | null;
    openSecondButton!.click();

    const switched = await waitUntil(
      () => core.getCurrentDocUrl() === secondDocUrl,
    );
    expect(switched).toBeTrue();
    const browserClosed = await waitUntil(() => browser?.hidden === true);
    expect(browserClosed).toBeTrue();

    app.destroy();
  });

  test("switching to normal doc clears stale coloring overlay using document metadata", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const page = getColoringPageById("pdr-v1-001");
    expect(page).not.toBeNull();

    const core = createMockCore({ width: 640, height: 480 });
    const coloringDoc = await core.createNew({
      documentSize: { width: 640, height: 480 },
      documentPresentation: {
        documentType: "coloring",
        referenceImage: {
          src: page!.src,
          composite: "over-drawing",
        },
      },
    });
    const coloringDocUrl = coloringDoc.url;
    const staleNormalDoc = await core.createNew({
      documentSize: { width: 640, height: 480 },
      documentPresentation: {
        documentType: "coloring",
        referenceImage: {
          src: page!.src,
          composite: "over-drawing",
        },
      },
    });
    const staleNormalDocUrl = staleNormalDoc.url;
    await core.open(coloringDocUrl);

    const documentBackend = createMockDocumentBackend(
      [
        {
          docUrl: coloringDocUrl,
          mode: "coloring",
          coloringPageId: "pdr-v1-001",
          referenceImageSrc: page!.src,
          referenceComposite: "over-drawing",
          createdAt: "2026-02-16T00:00:00.000Z",
          updatedAt: "2026-02-16T00:00:00.000Z",
          lastOpenedAt: "2026-02-16T00:00:00.000Z",
        },
        {
          docUrl: staleNormalDocUrl,
          mode: "normal",
          createdAt: "2026-02-16T00:00:00.000Z",
          updatedAt: "2026-02-16T00:00:00.000Z",
          lastOpenedAt: "2026-02-16T00:00:00.000Z",
        },
      ],
      coloringDocUrl,
    );

    const app = await createKidsDrawApp({
      container,
      width: 640,
      height: 480,
      core,
      documentBackend,
      confirmDestructiveAction: async () => true,
    });
    try {
      const browseButton = container.querySelector(
        '[data-action="browse"]',
      ) as HTMLButtonElement | null;
      expect(browseButton).not.toBeNull();
      browseButton!.click();

      const openNormalReady = await waitUntil(() => {
        return (
          container.querySelector(
            `[data-doc-browser-open="${staleNormalDocUrl}"]`,
          ) !== null
        );
      });
      expect(openNormalReady).toBeTrue();
      const openNormalButton = container.querySelector(
        `[data-doc-browser-open="${staleNormalDocUrl}"]`,
      ) as HTMLButtonElement | null;
      expect(openNormalButton).not.toBeNull();
      openNormalButton!.click();

      const switched = await waitUntil(
        () => core.getCurrentDocUrl() === staleNormalDocUrl,
        100,
      );
      expect(switched).toBeTrue();
      const summary = await documentBackend.getDocument(staleNormalDocUrl);
      expect(summary?.mode).toBe("normal");
      expect(summary?.referenceImageSrc).toBeUndefined();
      expect(summary?.referenceComposite).toBeUndefined();
    } finally {
      app.destroy();
    }
  });

  test("document browser can delete a non-current document", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const core = createMockCore({ width: 640, height: 480 });
    const firstDocUrl = core.getCurrentDocUrl();
    const secondDoc = await core.createNew({
      documentSize: { width: 320, height: 240 },
    });
    const secondDocUrl = secondDoc.url;
    await core.open(firstDocUrl);

    const documentBackend = createMockDocumentBackend(
      [
        {
          docUrl: firstDocUrl,
          mode: "normal",
          createdAt: "2026-02-16T00:00:00.000Z",
          updatedAt: "2026-02-16T00:00:00.000Z",
          lastOpenedAt: "2026-02-16T00:00:00.000Z",
        },
        {
          docUrl: secondDocUrl,
          mode: "normal",
          createdAt: "2026-02-16T00:00:00.000Z",
          updatedAt: "2026-02-16T00:00:00.000Z",
          lastOpenedAt: "2026-02-16T00:00:00.000Z",
        },
      ],
      firstDocUrl,
    );

    const app = await createKidsDrawApp({
      container,
      width: 640,
      height: 480,
      core,
      documentBackend,
      confirmDestructiveAction: async () => true,
    });

    const browseButton = container.querySelector(
      '[data-action="browse"]',
    ) as HTMLButtonElement | null;
    browseButton!.click();

    const deleteButtonReady = await waitUntil(() => {
      return (
        container.querySelector(
          `[data-doc-browser-delete="${secondDocUrl}"]`,
        ) !== null
      );
    });
    expect(deleteButtonReady).toBeTrue();
    const deleteSecondButton = container.querySelector(
      `[data-doc-browser-delete="${secondDocUrl}"]`,
    ) as HTMLButtonElement | null;
    deleteSecondButton!.click();

    let removed = false;
    for (let i = 0; i < 50; i += 1) {
      if ((await documentBackend.getDocument(secondDocUrl)) === null) {
        removed = true;
        break;
      }
      await waitForTurn();
    }
    expect(removed).toBeTrue();
    expect(core.getCurrentDocUrl()).toBe(firstDocUrl);

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
    const lettersPrevButton = container.querySelector(
      '[data-tool-family-prev="stamp.alphabet"]',
    ) as HTMLElement | null;
    const lettersNextButton = container.querySelector(
      '[data-tool-family-next="stamp.alphabet"]',
    ) as HTMLElement | null;

    expect(lettersFamilyButton).not.toBeNull();
    expect(lettersToolbar).not.toBeNull();
    expect(stampZVariantButton).not.toBeNull();
    expect(cursorIndicator).not.toBeNull();
    expect(lettersPrevButton).toBeNull();
    expect(lettersNextButton).toBeNull();
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
    expect(firstVariantLabel?.textContent).toBe("");
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

  test("png stamp family uses two-row scrolling variants and stamps selected images", async () => {
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

    const imageFamilyButton = container.querySelector(
      '.kids-draw-tool-selector [data-tool-family="stamp.images"]',
    ) as HTMLElement | null;
    const imageToolbar = container.querySelector(
      '[data-tool-family-toolbar="stamp.images"]',
    ) as HTMLElement | null;
    const imageVariantButton = container.querySelector(
      '[data-tool-variant="stamp.image.cat1"]',
    ) as HTMLElement | null;
    const prevPageButton = container.querySelector(
      '[data-tool-family-prev="stamp.images"]',
    ) as HTMLElement | null;
    const nextPageButton = container.querySelector(
      '[data-tool-family-next="stamp.images"]',
    ) as HTMLElement | null;
    const imageIcon = imageVariantButton?.querySelector(
      ".kids-square-icon-button__icon-image",
    ) as HTMLImageElement | null;
    const cursorIndicator = container.querySelector(
      ".kids-draw-cursor-indicator",
    ) as HTMLDivElement | null;

    expect(imageFamilyButton).not.toBeNull();
    expect(imageToolbar).not.toBeNull();
    expect(imageVariantButton).not.toBeNull();
    expect(prevPageButton).not.toBeNull();
    expect(nextPageButton).not.toBeNull();
    expect(imageIcon).not.toBeNull();
    expect(imageToolbar?.getAttribute("data-variant-layout")).toBe(
      "two-row-single-height",
    );

    imageFamilyButton!.click();
    expect(app.store.getActiveToolId()).toBe("stamp.image.bird1");
    dispatchPointer(overlay, "pointermove", 150, 130, 0, "mouse");
    expect(cursorIndicator).not.toBeNull();
    expect(cursorIndicator!.style.visibility).toBe("");

    imageVariantButton!.click();
    expect(app.store.getActiveToolId()).toBe("stamp.image.cat1");
    dispatchPointer(overlay, "pointerdown", 220, 220, 1, "mouse");
    dispatchPointer(overlay, "pointerup", 220, 220, 0, "mouse");

    const shapes = Object.values(app.store.getDocument().shapes);
    expect(shapes.length).toBeGreaterThanOrEqual(1);
    const newestShape = shapes[shapes.length - 1];
    expect(newestShape?.type).toBe("stamp");
    expect(
      (newestShape as { geometry?: { stampType?: string } })?.geometry
        ?.stampType,
    ).toBe("image");
    expect(
      (
        newestShape as {
          geometry?: {
            assetId?: string;
          };
        }
      )?.geometry?.assetId,
    ).toBe("cat1");

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
    expect(cursorIndicator!.style.width).toBe("8px");
    expect(cursorIndicator!.style.height).toBe("8px");

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

  test("stamp cursor preview hides once stamp drag starts", async () => {
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
    const alphabetFamilyButton = container.querySelector(
      '.kids-draw-tool-selector [data-tool-family="stamp.alphabet"]',
    ) as HTMLElement | null;
    const stampAVariantButton = container.querySelector(
      '[data-tool-variant="stamp.letter.a"]',
    ) as HTMLElement | null;
    expect(cursorIndicator).not.toBeNull();
    expect(alphabetFamilyButton).not.toBeNull();
    expect(stampAVariantButton).not.toBeNull();

    alphabetFamilyButton!.click();
    stampAVariantButton!.click();

    dispatchPointer(overlay, "pointermove", 200, 120, 0, "mouse");
    expect(cursorIndicator!.style.visibility).toBe("");

    dispatchPointer(overlay, "pointerdown", 200, 120, 1, "mouse");
    dispatchPointer(overlay, "pointermove", 202, 122, 1, "mouse");
    expect(cursorIndicator!.style.visibility).toBe("");

    dispatchPointer(overlay, "pointermove", 216, 136, 1, "mouse");
    expect(cursorIndicator!.style.visibility).toBe("hidden");

    dispatchPointer(overlay, "pointerup", 216, 136, 0, "mouse");
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
      const createNormalButton = container.querySelector(
        '[data-doc-browser-create-normal="true"]',
      ) as HTMLButtonElement | null;
      expect(createNormalButton).not.toBeNull();
      createNormalButton!.click();
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

  test("landscape coloring pages create landscape documents", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const app = await createKidsDrawApp({
      container,
      width: 640,
      height: 480,
      core: createMockCore({ width: 640, height: 480 }),
      confirmDestructiveAction: async () => true,
    });

    try {
      const hotCanvas = container.querySelector(
        "canvas.kids-draw-hot",
      ) as HTMLCanvasElement | null;
      const newDrawingButton = container.querySelector(
        '[data-action="new-drawing"]',
      ) as HTMLElement | null;
      expect(hotCanvas).not.toBeNull();
      expect(newDrawingButton).not.toBeNull();

      newDrawingButton!.click();
      const volumeButton = container.querySelector(
        '[data-doc-create-volume="pdr-v1"]',
      ) as HTMLButtonElement | null;
      expect(volumeButton).not.toBeNull();
      volumeButton!.click();

      const pageButton = container.querySelector(
        '[data-doc-create-page="pdr-v1-009"]',
      ) as HTMLButtonElement | null;
      expect(pageButton).not.toBeNull();
      pageButton!.click();

      const resized = await waitUntil(() => {
        return (
          hotCanvas!.style.width === "1754px" &&
          hotCanvas!.style.height === "1240px"
        );
      }, 100);
      expect(resized).toBeTrue();
    } finally {
      app.destroy();
    }
  });

  test("coloring presentation persists across app reload", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const documentBackend = createMockDocumentBackend([], null);
    const core = createMockCore({ width: 640, height: 480 });

    let app: Awaited<ReturnType<typeof createKidsDrawApp>> | null = null;
    try {
      app = await createKidsDrawApp({
        container,
        core,
        documentBackend,
        confirmDestructiveAction: async () => true,
      });

      const newDrawingButton = container.querySelector(
        '[data-action="new-drawing"]',
      ) as HTMLElement | null;
      expect(newDrawingButton).not.toBeNull();
      newDrawingButton!.click();
      const volumeButton = container.querySelector(
        '[data-doc-create-volume="pdr-v1"]',
      ) as HTMLButtonElement | null;
      expect(volumeButton).not.toBeNull();
      volumeButton!.click();
      const pageButton = container.querySelector(
        '[data-doc-create-page="pdr-v1-009"]',
      ) as HTMLButtonElement | null;
      expect(pageButton).not.toBeNull();
      pageButton!.click();

      const presentationApplied = await waitUntil(() => {
        const presentation = core.storeAdapter.getDoc().presentation;
        return (
          presentation.documentType === "coloring" &&
          presentation.referenceImage?.composite === "over-drawing" &&
          (presentation.referenceImage?.src.length ?? 0) > 0
        );
      }, 100);
      expect(presentationApplied).toBeTrue();

      app.destroy();
      app = await createKidsDrawApp({
        container,
        core,
        documentBackend,
        confirmDestructiveAction: async () => true,
      });

      const presentationRestored = await waitUntil(() => {
        const presentation = core.storeAdapter.getDoc().presentation;
        return (
          presentation.documentType === "coloring" &&
          presentation.referenceImage?.composite === "over-drawing" &&
          (presentation.referenceImage?.src.length ?? 0) > 0
        );
      }, 100);
      expect(presentationRestored).toBeTrue();

      const stageOverlay = container.querySelector(
        "img.kids-draw-coloring-overlay",
      );
      expect(stageOverlay).toBeNull();
    } finally {
      app?.destroy();
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

  test("hydrates toolbar UI state from persisted payload", async () => {
    localStorage.clear();
    const catalog = createKidsToolCatalog(createKidsShapeRendererRegistry());
    const defaultToolId =
      catalog.families.find((family) => family.id === catalog.defaultFamilyId)
        ?.defaultToolId ??
      catalog.tools[0]?.id ??
      "";
    const persistedToolId =
      catalog.tools.find((tool) => tool.id !== defaultToolId)?.id ??
      defaultToolId;

    localStorage.setItem(
      getMockDocUiStateStorageKey(),
      JSON.stringify({
        version: 1,
        activeToolId: persistedToolId,
        strokeColor: "#2E86FF",
        strokeWidth: 24,
      }),
    );

    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = await createKidsDrawApp({
      container,
      core: createMockCore({ width: 640, height: 480 }),
      confirmDestructiveAction: async () => true,
    });

    expect(app.store.getActiveToolId()).toBe(persistedToolId);
    const shared = app.store.getSharedSettings();
    expect(shared.strokeColor).toBe("#2e86ff");
    expect(shared.strokeWidth).toBe(24);

    app.destroy();
  });

  test("falls back when persisted tool id is unknown", async () => {
    localStorage.clear();
    const catalog = createKidsToolCatalog(createKidsShapeRendererRegistry());
    const defaultToolId =
      catalog.families.find((family) => family.id === catalog.defaultFamilyId)
        ?.defaultToolId ??
      catalog.tools[0]?.id ??
      "";

    localStorage.setItem(
      getMockDocUiStateStorageKey(),
      JSON.stringify({
        version: 1,
        activeToolId: "tool.unknown",
        strokeColor: "#00b894",
        strokeWidth: 16,
      }),
    );

    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = await createKidsDrawApp({
      container,
      core: createMockCore({ width: 640, height: 480 }),
      confirmDestructiveAction: async () => true,
    });

    expect(app.store.getActiveToolId()).toBe(defaultToolId);
    expect(app.store.getSharedSettings().strokeColor).toBe("#00b894");
    expect(app.store.getSharedSettings().strokeWidth).toBe(16);

    app.destroy();
  });

  test("invalid persisted payload is ignored safely", async () => {
    localStorage.clear();
    localStorage.setItem(getMockDocUiStateStorageKey(), "{broken json");

    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = await createKidsDrawApp({
      container,
      core: createMockCore({ width: 640, height: 480 }),
      confirmDestructiveAction: async () => true,
    });

    expect(app.store.getSharedSettings().strokeColor).toBe("#000000");
    expect(app.store.getSharedSettings().strokeWidth).toBe(8);

    app.destroy();
  });

  test("snaps persisted stroke width to nearest toolbar option", async () => {
    localStorage.clear();
    localStorage.setItem(
      getMockDocUiStateStorageKey(),
      JSON.stringify({
        version: 1,
        activeToolId: "tool.unknown",
        strokeColor: "#000000",
        strokeWidth: 7,
      }),
    );

    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = await createKidsDrawApp({
      container,
      core: createMockCore({ width: 640, height: 480 }),
      confirmDestructiveAction: async () => true,
    });

    expect(app.store.getSharedSettings().strokeWidth).toBe(8);
    app.destroy();
  });

  test("restores stamp variant pagination for persisted stamp tool", async () => {
    localStorage.clear();
    const catalog = createKidsToolCatalog(createKidsShapeRendererRegistry());
    const stampImagesFamily = catalog.families.find(
      (family) => family.id === "stamp.images",
    );
    const persistedToolId =
      stampImagesFamily?.toolIds[stampImagesFamily.toolIds.length - 1] ?? "";
    expect(persistedToolId).not.toBe("");
    localStorage.setItem(
      getMockDocUiStateStorageKey(),
      JSON.stringify({
        version: 1,
        activeToolId: persistedToolId,
        strokeColor: "#000000",
        strokeWidth: 8,
      }),
    );

    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = await createKidsDrawApp({
      container,
      core: createMockCore({ width: 640, height: 480 }),
      confirmDestructiveAction: async () => true,
    });
    await waitForTurn();

    expect(app.store.getActiveToolId()).toBe(persistedToolId);
    const stampPrevButton = container.querySelector(
      '[data-tool-family-prev="stamp.images"]',
    ) as HTMLButtonElement | null;
    expect(stampPrevButton).not.toBeNull();
    expect(stampPrevButton!.disabled).toBeFalse();

    app.destroy();
  });

  test("mobile reload restores tool selector page for persisted stamp family", async () => {
    localStorage.clear();
    const originalInnerWidth = window.innerWidth;
    const originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 390,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 844,
    });

    localStorage.setItem(
      getMockDocUiStateStorageKey(),
      JSON.stringify({
        version: 1,
        activeToolId: "stamp.image.cat1",
        strokeColor: "#000000",
        strokeWidth: 8,
      }),
    );

    const container = document.createElement("div");
    document.body.appendChild(container);
    try {
      const app = await createKidsDrawApp({
        container,
        core: createMockCore({ width: 640, height: 480 }),
        confirmDestructiveAction: async () => true,
      });
      await waitForTurn();

      const toolSelectorStampFamilyButton = container.querySelector(
        '.kids-draw-tool-selector [data-tool-family="stamp.images"]',
      ) as HTMLButtonElement | null;
      const selectorPrevButton = container.querySelector(
        '.kids-draw-tool-selector [data-button-grid-nav="prev"]',
      ) as HTMLButtonElement | null;
      const selectorNextButton = container.querySelector(
        '.kids-draw-tool-selector [data-button-grid-nav="next"]',
      ) as HTMLButtonElement | null;

      expect(app.store.getActiveToolId()).toBe("stamp.image.cat1");
      expect(toolSelectorStampFamilyButton).not.toBeNull();
      expect(
        toolSelectorStampFamilyButton?.classList.contains("is-selected"),
      ).toBeTrue();
      expect(selectorPrevButton).not.toBeNull();
      expect(selectorNextButton).not.toBeNull();
      expect(selectorPrevButton?.disabled).toBeFalse();

      app.destroy();
    } finally {
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

  test("resizing large to mobile with selected stamp image does not collapse tool selector to one item per page", async () => {
    localStorage.clear();
    const catalog = createKidsToolCatalog(createKidsShapeRendererRegistry());
    const selectedStampToolId =
      catalog.tools.find(
        (tool) => tool.familyId === "stamp.images" && tool.label === "Guitar",
      )?.id ??
      catalog.families.find((family) => family.id === "stamp.images")
        ?.toolIds[0] ??
      "";
    expect(selectedStampToolId).not.toBe("");

    const originalInnerWidth = window.innerWidth;
    const originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1280,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 800,
    });

    localStorage.setItem(
      getMockDocUiStateStorageKey(),
      JSON.stringify({
        version: 1,
        activeToolId: selectedStampToolId,
        strokeColor: "#000000",
        strokeWidth: 8,
      }),
    );

    const container = document.createElement("div");
    document.body.appendChild(container);
    try {
      const app = await createKidsDrawApp({
        container,
        core: createMockCore({ width: 960, height: 600 }),
        confirmDestructiveAction: async () => true,
      });
      await waitForTurn();

      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        writable: true,
        value: 380,
      });
      Object.defineProperty(window, "innerHeight", {
        configurable: true,
        writable: true,
        value: 820,
      });
      window.dispatchEvent(new window.Event("resize"));
      await waitForTurn();
      await waitForTurn();

      const visibleSelectorButtons = container.querySelectorAll(
        ".kids-draw-tool-selector [data-tool-family], .kids-draw-tool-selector [data-tool-id]",
      );
      expect(app.store.getActiveToolId()).toBe(selectedStampToolId);
      expect(visibleSelectorButtons.length).toBeGreaterThan(1);

      app.destroy();
    } finally {
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

  test("persists toolbar UI when tool/color/width change", async () => {
    localStorage.clear();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = await createKidsDrawApp({
      container,
      core: createMockCore({ width: 640, height: 480 }),
      confirmDestructiveAction: async () => true,
    });

    const penToolButton = container.querySelector(
      '[data-tool-variant="brush.freehand"]',
    ) as HTMLButtonElement | null;
    const blueColorButton = container.querySelector(
      '[data-setting="stroke-color"][data-color="#2e86ff"]',
    ) as HTMLButtonElement | null;
    const widthButton24 = container.querySelector(
      '[data-setting="stroke-width"][data-size="24"]',
    ) as HTMLButtonElement | null;
    expect(penToolButton).not.toBeNull();
    expect(blueColorButton).not.toBeNull();
    expect(widthButton24).not.toBeNull();
    penToolButton!.click();
    blueColorButton!.click();
    widthButton24!.click();

    await waitForToolbarUiPersistence();

    const persistedRaw = localStorage.getItem(getMockDocUiStateStorageKey());
    expect(persistedRaw).not.toBeNull();
    const persisted = JSON.parse(persistedRaw ?? "{}") as {
      version?: number;
      activeToolId?: string;
      strokeColor?: string;
      strokeWidth?: number;
    };
    expect(persisted.version).toBe(1);
    expect(persisted.activeToolId).toBe("brush.freehand");
    expect(persisted.strokeColor).toBe("#2e86ff");
    expect(persisted.strokeWidth).toBe(24);

    app.destroy();
  });

  test("duplicate toolbar state does not spam persisted writes", async () => {
    localStorage.clear();
    const storagePrototype = Object.getPrototypeOf(localStorage) as Storage;
    const originalSetItem = storagePrototype.setItem;
    let storageWriteCount = 0;
    storagePrototype.setItem = function setItem(
      this: Storage,
      key: string,
      value: string,
    ): void {
      if (key === getMockDocUiStateStorageKey()) {
        storageWriteCount += 1;
      }
      originalSetItem.call(this, key, value);
    };
    try {
      const container = document.createElement("div");
      document.body.appendChild(container);
      const app = await createKidsDrawApp({
        container,
        core: createMockCore({ width: 640, height: 480 }),
        confirmDestructiveAction: async () => true,
      });

      const blueColorButton = container.querySelector(
        '[data-setting="stroke-color"][data-color="#2e86ff"]',
      ) as HTMLButtonElement | null;
      const widthButton24 = container.querySelector(
        '[data-setting="stroke-width"][data-size="24"]',
      ) as HTMLButtonElement | null;
      const penToolButton = container.querySelector(
        '[data-tool-variant="brush.freehand"]',
      ) as HTMLButtonElement | null;
      expect(blueColorButton).not.toBeNull();
      expect(widthButton24).not.toBeNull();
      expect(penToolButton).not.toBeNull();

      penToolButton!.click();
      blueColorButton!.click();
      await waitForToolbarUiPersistence();
      const writesAfterFirstChange = storageWriteCount;

      blueColorButton!.click();
      blueColorButton!.click();
      await waitForToolbarUiPersistence();
      const writesAfterDuplicateColorClicks = storageWriteCount;

      widthButton24!.click();
      await waitForToolbarUiPersistence();
      const writesAfterWidthChange = storageWriteCount;

      widthButton24!.click();
      await waitForToolbarUiPersistence();

      expect(storageWriteCount).toBeGreaterThanOrEqual(1);
      expect(writesAfterDuplicateColorClicks).toBeGreaterThanOrEqual(
        writesAfterFirstChange,
      );
      expect(writesAfterWidthChange).toBeGreaterThan(writesAfterFirstChange);
      expect(storageWriteCount).toBeGreaterThanOrEqual(writesAfterWidthChange);

      app.destroy();
    } finally {
      storagePrototype.setItem = originalSetItem;
    }
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

  test("pointer move samples use coalesced events when available", async () => {
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

  test("ignores secondary touches while active touch stroke is in progress", async () => {
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

    dispatchPointer(overlay, "pointerdown", 80, 80, 1, "touch", 1);
    dispatchPointer(overlay, "pointermove", 140, 120, 1, "touch", 1);
    dispatchPointer(overlay, "pointermove", 420, 360, 1, "touch", 2);
    dispatchPointer(overlay, "pointerup", 140, 120, 0, "touch", 1);

    const shapes = Object.values(app.store.getDocument().shapes) as PenShape[];
    expect(shapes).toHaveLength(1);
    const worldPoints = getWorldPointsFromShape(shapes[0]!);
    const maxX = Math.max(...worldPoints.map(([x]) => x));
    const maxY = Math.max(...worldPoints.map(([, y]) => y));
    expect(maxX).toBeLessThan(220);
    expect(maxY).toBeLessThan(220);

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

  test("secondary pointerdown during an active stroke is prevented and does not discard the stroke", async () => {
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

    dispatchPointer(overlay, "pointerdown", 100, 100, 1, "mouse", 1);
    dispatchPointer(overlay, "pointermove", 180, 160, 1, "mouse", 1);

    const secondaryDown = new PointerEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
      clientX: 180,
      clientY: 160,
      buttons: 2,
      button: 2,
      pointerType: "mouse",
      pointerId: 2,
    });
    overlay.dispatchEvent(secondaryDown);

    dispatchPointer(overlay, "pointerup", 180, 160, 0, "mouse", 1);

    expect(secondaryDown.defaultPrevented).toBe(true);
    const shapes = Object.values(app.store.getDocument().shapes) as PenShape[];
    expect(shapes).toHaveLength(1);
    expect(getWorldPointsFromShape(shapes[0]!).length).toBeGreaterThan(1);

    app.destroy();
  });
});
