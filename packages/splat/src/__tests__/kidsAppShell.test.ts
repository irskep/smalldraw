import { describe, expect, test } from "bun:test";
import { TRPCClientError } from "@trpc/client";
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

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function createUnauthorizedTrpcError(): TRPCClientError<any> {
  return new TRPCClientError("UNAUTHORIZED", {
    result: {
      error: {
        message: "UNAUTHORIZED",
        code: -32001,
        data: {
          code: "UNAUTHORIZED",
          httpStatus: 401,
        },
      },
    },
  });
}

function createNotFoundTrpcError(message: string): TRPCClientError<any> {
  return new TRPCClientError(message, {
    result: {
      error: {
        message,
        code: -32004,
        data: {
          code: "NOT_FOUND",
          httpStatus: 404,
        },
      },
    },
  });
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
        collaborative: Boolean(
          (input.collaborative ?? existing?.collaborative) &&
            (input.collabDocUrl ?? existing?.collabDocUrl),
        ),
        collabDocUrl:
          (input.collaborative ?? existing?.collaborative) &&
          (input.collabDocUrl ?? existing?.collabDocUrl)
            ? (input.collabDocUrl ?? existing?.collabDocUrl)
            : undefined,
        joinSecret:
          (input.collaborative ?? existing?.collaborative) &&
          (input.collabDocUrl ?? existing?.collabDocUrl)
            ? (input.joinSecret ?? existing?.joinSecret)
            : undefined,
        accessToken:
          (input.collaborative ?? existing?.collaborative) &&
          (input.collabDocUrl ?? existing?.collabDocUrl)
            ? (input.accessToken ?? existing?.accessToken)
            : undefined,
        accessTokenScope:
          (input.collaborative ?? existing?.collaborative) &&
          (input.collabDocUrl ?? existing?.collabDocUrl)
            ? (input.accessTokenScope ?? existing?.accessTokenScope)
            : undefined,
        accountAttached:
          input.accountAttached === true || existing?.accountAttached === true
            ? true
            : undefined,
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
    createDocumentCopy() {
      return { url: "automerge:copy-1", binary: new Uint8Array([1, 2, 3]) };
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
    expect(root?.dataset.runtimeVariant).toBe("design-system");
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
      '[data-tool-variant].is-selected',
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
    expect(defaultColorSwatch?.dataset.selected).toBe("true");
    expect(defaultColorSwatch?.getAttribute("role")).toBe("radio");
    expect(defaultColorSwatch?.getAttribute("aria-checked")).toBe("true");
    expect(activeToolVariant?.getAttribute("aria-pressed")).toBe("true");
    expect(selectedStrokeWidth?.getAttribute("role")).toBe("radio");

    app.destroy();
    expect(container.querySelector(".kids-draw-app")).toBeNull();
  });

  test("mounts the design-system shell and dialogs", async () => {
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
    expect(root?.dataset.runtimeVariant).toBe("design-system");
    expect(container.querySelector(".ds-splat-context__scene")).not.toBeNull();
    expect(container.querySelector(".ds-color-picker")).not.toBeNull();
    expect(container.querySelector(".ds-stroke-picker")).not.toBeNull();
    expect(container.querySelector(".ds-modal-dialog")).not.toBeNull();
    expect(container.querySelector(".ds-share-dialog")).not.toBeNull();
    expect(container.querySelector(".kids-draw-toolbar-view")).toBeNull();
    expect(container.querySelector(".kids-draw-mobile-actions-popover")).toBeNull();
    expect(container.querySelector(".kids-share-dialog")).toBeNull();

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
      '.ds-splat-context__tool-selector [data-tool-family="eraser"]',
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
      '[data-new-document-mode="normal"]',
    ) as HTMLButtonElement | null;
    expect(createNormalButton).not.toBeNull();
    createNormalButton!.click();
    const resetSettled = await waitUntil(() => {
      const currentUndoButton = container.querySelector(
        '[data-action="undo"]',
      ) as DisableableElement | null;
      const currentRedoButton = container.querySelector(
        '[data-action="redo"]',
      ) as DisableableElement | null;
      return (
        Object.values(app.store.getDocument().shapes).length === 0 &&
        currentUndoButton?.disabled === true &&
        currentRedoButton?.disabled === true
      );
    }, 100);
    expect(resetSettled).toBeTrue();

    app.destroy();
  });

  test("shows offline collaboration status for collaborative current document", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const now = new Date().toISOString();
    const backend = createMockDocumentBackend(
      [
        {
          docUrl: "automerge:mock-1",
          mode: "normal",
          collaborative: true,
          collabDocUrl: "automerge:collab-1",
          joinSecret: "join-secret-1",
          createdAt: now,
          updatedAt: now,
          lastOpenedAt: now,
        },
      ],
      "automerge:mock-1",
    );

    const app = await createKidsDrawApp({
      container,
      width: 640,
      height: 480,
      core: createMockCore({ width: 640, height: 480 }),
      documentBackend: backend,
      confirmDestructiveAction: async () => true,
    });

    const status = container.querySelector(".ds-sync-indicator") as
      | HTMLElement
      | null;
    expect(status).not.toBeNull();
    const statusVisible = await waitUntil(() => status?.hidden === false, 80);
    expect(statusVisible).toBeTrue();
    expect(status?.hidden).toBeFalse();
    expect(status?.dataset.state).toBe("synced-to-server-but-offline");
    expect(status?.textContent?.trim()).toBe("Offline");

    app.destroy();
  });

  test("surfaces collaborative sync timeout as a sync indicator error", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const originalAddEventListener = window.addEventListener.bind(window);
    const originalRemoveEventListener = window.removeEventListener.bind(window);
    type WindowEventListener = (event: Event) => void;
    let unhandledRejectionListener: WindowEventListener | null = null;
    window.addEventListener = ((
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) => {
      if (type === "unhandledrejection") {
        unhandledRejectionListener = listener as WindowEventListener;
      }
      return originalAddEventListener(type, listener, options);
    }) as typeof window.addEventListener;
    window.removeEventListener = ((
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions,
    ) => {
      if (
        type === "unhandledrejection" &&
        unhandledRejectionListener === listener
      ) {
        unhandledRejectionListener = null;
      }
      return originalRemoveEventListener(type, listener, options);
    }) as typeof window.removeEventListener;
    const now = new Date().toISOString();
    const backend = createMockDocumentBackend(
      [
        {
          docUrl: "automerge:mock-1",
          mode: "normal",
          collaborative: true,
          collabDocUrl: "automerge:collab-1",
          joinSecret: "join-secret-1",
          createdAt: now,
          updatedAt: now,
          lastOpenedAt: now,
        },
      ],
      "automerge:mock-1",
    );

    const app = await createKidsDrawApp({
      container,
      width: 640,
      height: 480,
      core: createMockCore({ width: 640, height: 480 }),
      documentBackend: backend,
      confirmDestructiveAction: async () => true,
    });

    const status = container.querySelector(".ds-sync-indicator") as
      | HTMLElement
      | null;
    expect(status).not.toBeNull();
    const initiallyOffline = await waitUntil(
      () => status?.dataset.state === "synced-to-server-but-offline",
      80,
    );
    expect(initiallyOffline).toBeTrue();

    const error = new Error("withTimeout: timed out after 60000ms");
    error.name = "TimeoutError";
    error.stack = "TimeoutError\n at beginSync (DocSynchronizer.js:184:1)";
    if (!unhandledRejectionListener) {
      throw new Error("Expected collaborative sync error listener to be bound");
    }
    let prevented = false;
    const boundUnhandledRejectionListener =
      unhandledRejectionListener as WindowEventListener;
    boundUnhandledRejectionListener({
      type: "unhandledrejection",
      reason: error,
      preventDefault() {
        prevented = true;
      },
    } as Event & { reason: Error; preventDefault(): void });
    const statusVisible = await waitUntil(
      () => status?.dataset.state === "error",
      80,
    );
    expect(statusVisible).toBeTrue();
    expect(prevented).toBeTrue();
    expect(status?.textContent?.trim()).toBe("Sync issue");
    expect(status?.title).toBe(
      "Sync is taking longer than expected. Changes may not be reaching the server. Check your connection and try again.",
    );

    app.destroy();
    window.addEventListener = originalAddEventListener;
    window.removeEventListener = originalRemoveEventListener;
  });

  test("share command fails gracefully when multiplayer api is not configured", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = await createKidsDrawApp({
      container,
      width: 640,
      height: 480,
      core: createMockCore({ width: 640, height: 480 }),
      confirmDestructiveAction: async () => true,
    });

    const shareButton = container.querySelector(
      '[data-action="share"]',
    ) as DisableableElement | null;
    expect(shareButton).not.toBeNull();
    expect(shareButton?.disabled).toBeFalse();

    app.commands.share();
    const settled = await waitUntil(() => {
      const currentShareButton = container.querySelector(
        '[data-action="share"]',
      ) as DisableableElement | null;
      return currentShareButton?.disabled === false;
    }, 80);
    expect(settled).toBeTrue();
    const currentShareButton = container.querySelector(
      '[data-action="share"]',
    ) as DisableableElement | null;
    expect(currentShareButton?.disabled).toBeFalse();

    app.destroy();
  });

  test("join bootstrap stores a separate local catalog key for collaborative docs", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = (async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes("/listAccountCollaborativeDocuments")) {
        return new Response(JSON.stringify([{ result: { data: [] } }]), {
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("/resolveAnonymousCollaborativeDocument")) {
        return new Response(
          JSON.stringify([
            {
              result: {
                data: {
                  collabDocUrl: "automerge:joined-doc",
                  joinSecret: "join-seed",
                  accessToken: "access-seed",
                  content: btoa("fake-doc-binary"),
                },
              },
            },
          ]),
          {
            headers: { "content-type": "application/json" },
          },
        );
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;
    if (typeof window !== "undefined") {
      window.fetch = fetchMock;
    }

    try {
      const container = document.createElement("div");
      document.body.appendChild(container);
      const backend = createMockDocumentBackend([], null);

      const app = await createKidsDrawApp({
        container,
        width: 640,
        height: 480,
        core: createMockCore({ width: 640, height: 480 }),
        documentBackend: backend,
        confirmDestructiveAction: async () => true,
        multiplayer: {
          syncServerHttpUrl: "http://localhost:3030/api",
          startupIntent: {
            kind: "open-share-link",
            joinSecret: "join-seed",
          },
        },
      });

      const documents = await backend.listDocuments();
      const joined = documents.find(
        (summary) => summary.collabDocUrl === "automerge:joined-doc",
      );
      expect(joined).not.toBeUndefined();
      expect(joined?.docUrl).toBe("catalog-collab:joined-doc");
      expect(await backend.getCurrentDocument()).toBe(
        "catalog-collab:joined-doc",
      );

      app.destroy();
    } finally {
      globalThis.fetch = originalFetch;
      if (typeof window !== "undefined") {
        window.fetch = originalFetch;
      }
    }
  });

  test("account document bootstrap stores an account-attached collaborative catalog entry", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = (async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes("/listAccountCollaborativeDocuments")) {
        return new Response(JSON.stringify([{ result: { data: [] } }]), {
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("/resolveAccountCollaborativeDocument")) {
        expect(decodeURIComponent(url)).toContain('"documentId":"account-doc"');
        expect(decodeURIComponent(url)).toContain('"deviceTag":"device-1"');
        return new Response(
          JSON.stringify([
            {
              result: {
                data: {
                  collabDocUrl: "automerge:account-doc",
                  accessToken: "account-access",
                  accessTokenScope: "owner",
                  content: btoa("fake-account-doc-binary"),
                },
              },
            },
          ]),
          {
            headers: { "content-type": "application/json" },
          },
        );
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;
    if (typeof window !== "undefined") {
      window.fetch = fetchMock;
    }

    try {
      const container = document.createElement("div");
      document.body.appendChild(container);
      const backend = createMockDocumentBackend([], null);

      const app = await createKidsDrawApp({
        container,
        width: 640,
        height: 480,
        core: createMockCore({ width: 640, height: 480 }),
        documentBackend: backend,
        confirmDestructiveAction: async () => true,
        multiplayer: {
          syncServerHttpUrl: "http://localhost:3030/api",
          startupIntent: {
            kind: "open-account-document",
            documentId: "account-doc",
          },
          deviceTag: "device-1",
        },
      });

      const documents = await backend.listDocuments();
      const accountDoc = documents.find(
        (summary) => summary.collabDocUrl === "automerge:account-doc",
      );
      expect(accountDoc).toMatchObject({
        docUrl: "catalog-collab:account-doc",
        collaborative: true,
        collabDocUrl: "automerge:account-doc",
        accessToken: "account-access",
        accessTokenScope: "owner",
        accountAttached: true,
      });
      expect(await backend.getCurrentDocument()).toBe(
        "catalog-collab:account-doc",
      );

      app.destroy();
    } finally {
      globalThis.fetch = originalFetch;
      if (typeof window !== "undefined") {
        window.fetch = originalFetch;
      }
    }
  });

  test("account document bootstrap falls back to cached local access when auth is missing", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = (async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes("/listAccountCollaborativeDocuments")) {
        return new Response(JSON.stringify([{ result: { data: [] } }]), {
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("/resolveAccountCollaborativeDocument")) {
        throw createUnauthorizedTrpcError();
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;
    if (typeof window !== "undefined") {
      window.fetch = fetchMock;
    }

    try {
      const container = document.createElement("div");
      document.body.appendChild(container);
      const now = new Date().toISOString();
      const backend = createMockDocumentBackend(
        [
          {
            docUrl: "catalog-collab:account-doc",
            collaborative: true,
            collabDocUrl: "automerge:account-doc",
            accessToken: "cached-access-token",
            accessTokenScope: "owner",
            accountAttached: true,
            mode: "normal",
            createdAt: now,
            updatedAt: now,
            lastOpenedAt: now,
          },
        ],
        null,
      );

      const app = await createKidsDrawApp({
        container,
        width: 640,
        height: 480,
        core: createMockCore({ width: 640, height: 480 }),
        documentBackend: backend,
        confirmDestructiveAction: async () => true,
        multiplayer: {
          syncServerHttpUrl: "http://localhost:3030/api",
          startupIntent: {
            kind: "open-account-document",
            documentId: "account-doc",
          },
          deviceTag: "device-1",
        },
      });

      expect(await backend.getCurrentDocument()).toBe(
        "catalog-collab:account-doc",
      );

      app.destroy();
    } finally {
      globalThis.fetch = originalFetch;
      if (typeof window !== "undefined") {
        window.fetch = originalFetch;
      }
    }
  });

  test("account document bootstrap surfaces auth-required access error without local fallback", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = (async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes("/listAccountCollaborativeDocuments")) {
        return new Response(JSON.stringify([{ result: { data: [] } }]), {
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("/resolveAccountCollaborativeDocument")) {
        throw createUnauthorizedTrpcError();
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;
    if (typeof window !== "undefined") {
      window.fetch = fetchMock;
    }

    try {
      const container = document.createElement("div");
      document.body.appendChild(container);
      const backend = createMockDocumentBackend([], null);

      const app = await createKidsDrawApp({
          container,
          width: 640,
          height: 480,
          core: createMockCore({ width: 640, height: 480 }),
          documentBackend: backend,
          confirmDestructiveAction: async () => true,
          multiplayer: {
            syncServerHttpUrl: "http://localhost:3030/api",
            startupIntent: {
              kind: "open-account-document",
              documentId: "account-doc",
            },
            deviceTag: "device-1",
          },
        });
      const documentState = container.querySelector(
        ".ds-document-access-state",
      );
      expect(documentState?.textContent).toContain(
        "You can't access this drawing",
      );
      expect(documentState?.textContent).toContain(
        "This drawing needs account access before it can be opened here.",
      );
      expect(container.querySelector(".ds-splat-context__canvas-shell")).toBeNull();
      app.destroy();
    } finally {
      globalThis.fetch = originalFetch;
      if (typeof window !== "undefined") {
        window.fetch = originalFetch;
      }
    }
  });

  test("account document bootstrap surfaces missing repository content", async () => {
    const originalFetch = globalThis.fetch;
    const missingContentMessage =
      "Document metadata exists, but its drawing content is missing from repository storage.";
    const fetchMock = (async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes("/listAccountCollaborativeDocuments")) {
        return new Response(JSON.stringify([{ result: { data: [] } }]), {
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("/resolveAccountCollaborativeDocument")) {
        throw createNotFoundTrpcError(missingContentMessage);
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;
    if (typeof window !== "undefined") {
      window.fetch = fetchMock;
    }

    try {
      const container = document.createElement("div");
      document.body.appendChild(container);
      const backend = createMockDocumentBackend([], null);

      const app = await createKidsDrawApp({
        container,
        width: 640,
        height: 480,
        core: createMockCore({ width: 640, height: 480 }),
        documentBackend: backend,
        confirmDestructiveAction: async () => true,
        multiplayer: {
          syncServerHttpUrl: "http://localhost:3030/api",
          startupIntent: {
            kind: "open-account-document",
            documentId: "missing-content-doc",
          },
          deviceTag: "device-1",
        },
      });

      const documentState = container.querySelector(
        ".ds-document-access-state",
      );
      expect(documentState?.textContent).toContain("Could not open drawing");
      expect(documentState?.textContent).toContain(missingContentMessage);
      expect(
        container.querySelector(".ds-splat-context__canvas-shell"),
      ).toBeNull();
      app.destroy();
    } finally {
      globalThis.fetch = originalFetch;
      if (typeof window !== "undefined") {
        window.fetch = originalFetch;
      }
    }
  });

  test("empty local catalog syncs account document metadata and loads only the selected drawing", async () => {
    const originalFetch = globalThis.fetch;
    const resolvedDocumentIds: string[] = [];
    const fetchMock = (async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes("/listAccountCollaborativeDocuments")) {
        return new Response(
          JSON.stringify([
            {
              result: {
                data: [
                  {
                    documentId: "account-doc-a",
                    name: "Account Doc A",
                    thumbnailUrl: null,
                  },
                  {
                    documentId: "account-doc-b",
                    name: "Account Doc B",
                    thumbnailUrl: null,
                  },
                ],
              },
            },
          ]),
          {
            headers: { "content-type": "application/json" },
          },
        );
      }
      if (url.includes("/resolveAccountCollaborativeDocument")) {
        const decodedUrl = decodeURIComponent(url);
        if (decodedUrl.includes('"documentId":"account-doc-a"')) {
          resolvedDocumentIds.push("account-doc-a");
          return new Response(
            JSON.stringify([
              {
                result: {
                  data: {
                    collabDocUrl: "automerge:account-doc-a",
                    accessToken: "account-access-a",
                    accessTokenScope: "owner",
                    content: btoa("fake-account-doc-a-binary"),
                  },
                },
              },
            ]),
            {
              headers: { "content-type": "application/json" },
            },
          );
        }
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;
    if (typeof window !== "undefined") {
      window.fetch = fetchMock;
    }

    try {
      const container = document.createElement("div");
      document.body.appendChild(container);
      const backend = createMockDocumentBackend([], null);

      const app = await createKidsDrawApp({
        container,
        width: 640,
        height: 480,
        core: createMockCore({ width: 640, height: 480 }),
        documentBackend: backend,
        confirmDestructiveAction: async () => true,
        multiplayer: {
          syncServerHttpUrl: "http://localhost:3030/api",
          startupIntent: {
            kind: "open-last-local",
          },
          deviceTag: "device-1",
        },
      });

      const documents = await backend.listDocuments();
      expect(documents).toHaveLength(2);
      expect(documents.map((document) => document.docUrl).sort()).toEqual([
        "catalog-collab:account-doc-a",
        "catalog-collab:account-doc-b",
      ]);
      expect(await backend.getCurrentDocument()).toBe(
        "catalog-collab:account-doc-a",
      );
      expect(
        documents.find(
          (document) => document.docUrl === "catalog-collab:account-doc-a",
        ),
      ).toMatchObject({
        title: "Account Doc A",
        collaborative: true,
        collabDocUrl: "automerge:account-doc-a",
        accessToken: "account-access-a",
        accessTokenScope: "owner",
        accountAttached: true,
      });
      expect(
        documents.find(
          (document) => document.docUrl === "catalog-collab:account-doc-b",
        ),
      ).toMatchObject({
        title: "Account Doc B",
        collaborative: true,
        collabDocUrl: "automerge:account-doc-b",
        accessToken: undefined,
        accountAttached: true,
      });
      expect(resolvedDocumentIds).toEqual(["account-doc-a"]);

      app.destroy();
    } finally {
      globalThis.fetch = originalFetch;
      if (typeof window !== "undefined") {
        window.fetch = originalFetch;
      }
    }
  });

  test("default startup refreshes account metadata without loading non-current drawings", async () => {
    const originalFetch = globalThis.fetch;
    const resolvedDocumentIds: string[] = [];
    const fetchMock = (async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes("/listAccountCollaborativeDocuments")) {
        return new Response(
          JSON.stringify([
            {
              result: {
                data: [
                  {
                    documentId: "account-doc-b",
                    name: "Renamed Account Doc B",
                    thumbnailUrl: null,
                  },
                  {
                    documentId: "account-doc-c",
                    name: "New Account Doc C",
                    thumbnailUrl: null,
                  },
                ],
              },
            },
          ]),
          {
            headers: { "content-type": "application/json" },
          },
        );
      }
      if (url.includes("/resolveAccountCollaborativeDocument")) {
        const decodedUrl = decodeURIComponent(url);
        const match = decodedUrl.match(/"documentId":"([^"]+)"/);
        resolvedDocumentIds.push(match?.[1] ?? "unknown");
        throw new Error(`Unexpected account content load: ${url}`);
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;
    if (typeof window !== "undefined") {
      window.fetch = fetchMock;
    }

    try {
      const container = document.createElement("div");
      document.body.appendChild(container);
      const now = new Date().toISOString();
      const backend = createMockDocumentBackend(
        [
          {
            docUrl: "automerge:local-doc",
            mode: "normal",
            createdAt: now,
            updatedAt: now,
            lastOpenedAt: now,
          },
          {
            docUrl: "catalog-collab:account-doc-b",
            mode: "normal",
            title: "Old Account Doc B",
            collaborative: true,
            collabDocUrl: "automerge:account-doc-b",
            accountAttached: true,
            createdAt: now,
            updatedAt: now,
            lastOpenedAt: now,
          },
        ],
        "automerge:local-doc",
      );

      const app = await createKidsDrawApp({
        container,
        width: 640,
        height: 480,
        core: createMockCore({ width: 640, height: 480 }),
        documentBackend: backend,
        confirmDestructiveAction: async () => true,
        multiplayer: {
          syncServerHttpUrl: "http://localhost:3030/api",
          startupIntent: {
            kind: "open-last-local",
          },
          deviceTag: "device-1",
        },
      });

      const documents = await backend.listDocuments();
      expect(await backend.getCurrentDocument()).toBe("automerge:local-doc");
      expect(
        documents.find(
          (document) => document.docUrl === "catalog-collab:account-doc-b",
        ),
      ).toMatchObject({
        title: "Renamed Account Doc B",
        collaborative: true,
        collabDocUrl: "automerge:account-doc-b",
        accountAttached: true,
        accessToken: undefined,
      });
      expect(
        documents.find(
          (document) => document.docUrl === "catalog-collab:account-doc-c",
        ),
      ).toMatchObject({
        title: "New Account Doc C",
        collaborative: true,
        collabDocUrl: "automerge:account-doc-c",
        accountAttached: true,
        accessToken: undefined,
      });
      expect(resolvedDocumentIds).toEqual([]);

      app.destroy();
    } finally {
      globalThis.fetch = originalFetch;
      if (typeof window !== "undefined") {
        window.fetch = originalFetch;
      }
    }
  });

  test("default startup ignores stale current localStorage and selects an account document", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = (async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes("/listAccountCollaborativeDocuments")) {
        return new Response(
          JSON.stringify([
            {
              result: {
                data: [
                  {
                    documentId: "account-doc-a",
                    name: "Account Doc A",
                    thumbnailUrl: null,
                  },
                ],
              },
            },
          ]),
          {
            headers: { "content-type": "application/json" },
          },
        );
      }
      if (url.includes("/resolveAccountCollaborativeDocument")) {
        expect(decodeURIComponent(url)).toContain(
          '"documentId":"account-doc-a"',
        );
        return new Response(
          JSON.stringify([
            {
              result: {
                data: {
                  collabDocUrl: "automerge:account-doc-a",
                  accessToken: "account-access-a",
                  accessTokenScope: "owner",
                  content: btoa("fake-account-doc-a-binary"),
                },
              },
            },
          ]),
          {
            headers: { "content-type": "application/json" },
          },
        );
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;
    if (typeof window !== "undefined") {
      window.fetch = fetchMock;
    }

    try {
      const container = document.createElement("div");
      document.body.appendChild(container);
      const backend = createMockDocumentBackend([], "automerge:stale-local");

      const app = await createKidsDrawApp({
        container,
        width: 640,
        height: 480,
        core: createMockCore({ width: 640, height: 480 }),
        documentBackend: backend,
        confirmDestructiveAction: async () => true,
        multiplayer: {
          syncServerHttpUrl: "http://localhost:3030/api",
          startupIntent: {
            kind: "open-last-local",
          },
          deviceTag: "device-1",
        },
      });

      expect(await backend.getCurrentDocument()).toBe(
        "catalog-collab:account-doc-a",
      );
      expect(
        (await backend.getDocument("catalog-collab:account-doc-a"))
          ?.accessToken,
      ).toBe("account-access-a");

      app.destroy();
    } finally {
      globalThis.fetch = originalFetch;
      if (typeof window !== "undefined") {
        window.fetch = originalFetch;
      }
    }
  });

  test("local document startup opens an existing browser catalog entry", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const now = new Date().toISOString();
    const backend = createMockDocumentBackend(
      [
        {
          docUrl: "automerge:local-doc",
          mode: "normal",
          createdAt: now,
          updatedAt: now,
          lastOpenedAt: now,
        },
      ],
      null,
    );

    const app = await createKidsDrawApp({
      container,
      width: 640,
      height: 480,
      core: createMockCore({ width: 640, height: 480 }),
      documentBackend: backend,
      confirmDestructiveAction: async () => true,
      multiplayer: {
        startupIntent: {
          kind: "open-local-document",
          docUrl: "automerge:local-doc",
        },
      },
    });

    expect(await backend.getCurrentDocument()).toBe("automerge:local-doc");

    app.destroy();
  });

  test("local document startup still refreshes account metadata", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = (async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes("/listAccountCollaborativeDocuments")) {
        return new Response(
          JSON.stringify([
            {
              result: {
                data: [
                  {
                    documentId: "account-doc-a",
                    name: "Account Doc A",
                    thumbnailUrl: null,
                  },
                ],
              },
            },
          ]),
          {
            headers: { "content-type": "application/json" },
          },
        );
      }
      if (url.includes("/resolveAccountCollaborativeDocument")) {
        throw new Error(`Unexpected account content load: ${url}`);
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;
    if (typeof window !== "undefined") {
      window.fetch = fetchMock;
    }

    try {
      const container = document.createElement("div");
      document.body.appendChild(container);
      const now = new Date().toISOString();
      const backend = createMockDocumentBackend(
        [
          {
            docUrl: "automerge:local-doc",
            mode: "normal",
            createdAt: now,
            updatedAt: now,
            lastOpenedAt: now,
          },
        ],
        null,
      );

      const app = await createKidsDrawApp({
        container,
        width: 640,
        height: 480,
        core: createMockCore({ width: 640, height: 480 }),
        documentBackend: backend,
        confirmDestructiveAction: async () => true,
        multiplayer: {
          syncServerHttpUrl: "http://localhost:3030/api",
          startupIntent: {
            kind: "open-local-document",
            docUrl: "automerge:local-doc",
          },
          deviceTag: "device-1",
        },
      });

      const documents = await backend.listDocuments();
      expect(await backend.getCurrentDocument()).toBe("automerge:local-doc");
      expect(
        documents.find(
          (document) => document.docUrl === "catalog-collab:account-doc-a",
        ),
      ).toMatchObject({
        title: "Account Doc A",
        collaborative: true,
        collabDocUrl: "automerge:account-doc-a",
        accountAttached: true,
        accessToken: undefined,
      });

      app.destroy();
    } finally {
      globalThis.fetch = originalFetch;
      if (typeof window !== "undefined") {
        window.fetch = originalFetch;
      }
    }
  });

  test("stale local document URL after local data reset falls back to account catalog", async () => {
    const originalFetch = globalThis.fetch;
    const requests: string[] = [];
    const fetchMock = (async (input: RequestInfo | URL) => {
      const url = input.toString();
      requests.push(url);
      if (url.includes("/listAccountCollaborativeDocuments")) {
        return new Response(
          JSON.stringify([
            {
              result: {
                data: [
                  {
                    documentId: "account-doc-a",
                    name: "Account Doc A",
                    thumbnailUrl: null,
                  },
                ],
              },
            },
          ]),
          {
            headers: { "content-type": "application/json" },
          },
        );
      }
      if (url.includes("/resolveAccountCollaborativeDocument")) {
        expect(decodeURIComponent(url)).toContain(
          '"documentId":"account-doc-a"',
        );
        return new Response(
          JSON.stringify([
            {
              result: {
                data: {
                  collabDocUrl: "automerge:account-doc-a",
                  accessToken: "account-access-a",
                  accessTokenScope: "owner",
                  content: btoa("fake-account-doc-a-binary"),
                },
              },
            },
          ]),
          {
            headers: { "content-type": "application/json" },
          },
        );
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;
    if (typeof window !== "undefined") {
      window.fetch = fetchMock;
    }

    try {
      const container = document.createElement("div");
      document.body.appendChild(container);
      const backend = createMockDocumentBackend([], null);

      const app = await createKidsDrawApp({
        container,
        width: 640,
        height: 480,
        core: createMockCore({ width: 640, height: 480 }),
        documentBackend: backend,
        confirmDestructiveAction: async () => true,
        multiplayer: {
          syncServerHttpUrl: "http://localhost:3030/api",
          startupIntent: {
            kind: "open-local-document",
            docUrl: "automerge:stale-local-doc",
          },
          deviceTag: "device-1",
        },
      });

      expect(requests.some((url) => url.includes("/listAccount"))).toBe(true);
      expect(await backend.getCurrentDocument()).toBe(
        "catalog-collab:account-doc-a",
      );
      expect(
        (await backend.getDocument("catalog-collab:account-doc-a"))
          ?.accessToken,
      ).toBe("account-access-a");

      app.destroy();
    } finally {
      globalThis.fetch = originalFetch;
      if (typeof window !== "undefined") {
        window.fetch = originalFetch;
      }
    }
  });

  test("local document startup shows access state for missing browser catalog entries", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const app = await createKidsDrawApp({
      container,
      width: 640,
      height: 480,
      core: createMockCore({ width: 640, height: 480 }),
      documentBackend: createMockDocumentBackend([], null),
      confirmDestructiveAction: async () => true,
      multiplayer: {
        startupIntent: {
          kind: "open-local-document",
          docUrl: "automerge:missing-doc",
        },
      },
    });

    const documentState = container.querySelector(
      ".ds-document-access-state",
    ) as HTMLElement | null;
    const canvasShell = container.querySelector(
      ".ds-splat-context__canvas-shell",
    ) as HTMLElement | null;

    expect(documentState).not.toBeNull();
    expect(documentState?.textContent).toContain("This drawing is not available here");
    expect(documentState?.textContent).toContain(
      "This drawing is not stored in this browser anymore.",
    );
    expect(canvasShell).toBeNull();

    const menuTrigger = Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        'button[aria-haspopup="menu"]',
      ),
    ).find((button) => button.textContent?.includes("Menu"));
    expect(menuTrigger).not.toBeUndefined();
    menuTrigger!.click();

    const browseAction = container.querySelector(
      '.ds-dropdown-menu__item[data-action="browse"]',
    ) as HTMLButtonElement | null;
    expect(browseAction).not.toBeNull();
    browseAction!.click();

    const browserDialog = container.querySelector(
      "dialog.kids-draw-document-browser-dialog",
    ) as HTMLDialogElement | null;
    expect(browserDialog).not.toBeNull();
    const browserOpened = await waitUntil(() => browserDialog?.open === true);
    expect(browserOpened).toBeTrue();
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
      '.ds-splat-context__tool-selector [data-tool-family="shape.filled"]',
    ) as HTMLElement | null;
    const outlineShapeFamilyButton = container.querySelector(
      '.ds-splat-context__tool-selector [data-tool-family="shape.outline"]',
    ) as HTMLElement | null;
    const yellowColorSwatch = container.querySelector(
      'button[data-setting="stroke-color"][data-color="#ffdb4d"]',
    ) as DisableableElement | null;
    const grayColorSwatch = container.querySelector(
      'button[data-setting="stroke-color"][data-color="#9ca3af"]',
    ) as DisableableElement | null;
    expect(filledShapeFamilyButton).not.toBeNull();
    expect(outlineShapeFamilyButton).not.toBeNull();
    expect(yellowColorSwatch).not.toBeNull();
    expect(grayColorSwatch).not.toBeNull();

    filledShapeFamilyButton!.click();
    expect(app.store.getActiveToolId()).toBe("rect");
    const rectVariantButton = container.querySelector(
      '[data-tool-variant="rect"]',
    ) as HTMLElement | null;
    const ellipseVariantButton = container.querySelector(
      '[data-tool-variant="ellipse"]',
    ) as HTMLElement | null;
    expect(rectVariantButton).not.toBeNull();
    expect(ellipseVariantButton).not.toBeNull();
    yellowColorSwatch!.click();
    expect(app.store.getSharedSettings().strokeColor).toBe("#ffdb4d");
    expect(app.store.getSharedSettings().fillColor).toBe("#ffffff");

    ellipseVariantButton!.click();
    expect(app.store.getActiveToolId()).toBe("ellipse");
    outlineShapeFamilyButton!.click();
    const ellipseOutlineVariantButton = container.querySelector(
      '[data-tool-variant="ellipse.outline"]',
    ) as HTMLElement | null;
    expect(ellipseOutlineVariantButton).not.toBeNull();
    expect(app.store.getActiveToolId()).toBe("ellipse.outline");
    dispatchPointer(overlay, "pointerdown", 80, 80, 1);
    dispatchPointer(overlay, "pointermove", 200, 140, 1);
    dispatchPointer(overlay, "pointerup", 200, 140, 0);
    filledShapeFamilyButton!.click();
    expect(app.store.getActiveToolId()).toBe("ellipse");

    grayColorSwatch!.click();
    expect(app.store.getSharedSettings().strokeColor).toBe("#9ca3af");
    outlineShapeFamilyButton!.click();
    const rectOutlineVariantButton = container.querySelector(
      '[data-tool-variant="rect.outline"]',
    ) as HTMLElement | null;
    expect(rectOutlineVariantButton).not.toBeNull();
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
      '.ds-splat-context__tool-selector [data-tool-family="brush"]',
    ) as HTMLElement | null;
    expect(brushFamilyButton).not.toBeNull();
    brushFamilyButton!.click();
    const penVariantButtonAfterBrush = container.querySelector(
      '[data-tool-variant="brush.freehand"]',
    ) as HTMLElement | null;
    expect(penVariantButtonAfterBrush).not.toBeNull();
    penVariantButtonAfterBrush!.click();
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
    const currentDocumentSummaries: Array<KidsDocumentSummary | null> = [];

    const app = await createKidsDrawApp({
      container,
      width: 640,
      height: 480,
      core,
      documentBackend,
      confirmDestructiveAction: async () => true,
      onCurrentDocumentSummaryChanged: (summary) => {
        currentDocumentSummaries.push(summary);
      },
    });

    const browseButton = container.querySelector(
      '[data-action="browse"]',
    ) as HTMLButtonElement | null;
    expect(browseButton).not.toBeNull();
    browseButton!.click();

    const browser = container.querySelector(
      "dialog.kids-draw-document-browser-dialog",
    ) as HTMLDialogElement | null;
    expect(browser).not.toBeNull();
    const browserOpened = await waitUntil(() => browser?.open === true);
    expect(browserOpened).toBeTrue();

    const openButtonReady = await waitUntil(() => {
      return (
        container.querySelector(
          `[data-document-browser-open="${secondDocUrl}"]`,
        ) !==
        null
      );
    });
    expect(openButtonReady).toBeTrue();
    const openSecondButton = container.querySelector(
      `[data-document-browser-open="${secondDocUrl}"]`,
    ) as HTMLButtonElement | null;
    openSecondButton!.click();

    const switched = await waitUntil(
      () => core.getCurrentDocUrl() === secondDocUrl,
    );
    expect(switched).toBeTrue();
    const summaryChanged = await waitUntil(
      () => currentDocumentSummaries.at(-1)?.docUrl === secondDocUrl,
    );
    expect(summaryChanged).toBeTrue();
    await waitMs(240);
    const browserClosed = await waitUntil(() => browser?.open === false, 300);
    expect(browserClosed).toBeTrue();

    app.destroy();
  });

  test("switching to normal doc clears stale coloring overlay using document metadata", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const page = getColoringPageById("coloring/pdr-v1/page-001.png");
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
          coloringPageId: page!.id,
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
            `[data-document-browser-open="${staleNormalDocUrl}"]`,
          ) !== null
        );
      });
      expect(openNormalReady).toBeTrue();
      const openNormalButton = container.querySelector(
        `[data-document-browser-open="${staleNormalDocUrl}"]`,
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
          `[data-document-browser-delete="${secondDocUrl}"]`,
        ) !== null
      );
    });
    expect(deleteButtonReady).toBeTrue();
    const deleteSecondButton = container.querySelector(
      `[data-document-browser-delete="${secondDocUrl}"]`,
    ) as HTMLButtonElement | null;
    deleteSecondButton!.click();

    let removed = false;
    for (let i = 0; i < 120; i += 1) {
      if ((await documentBackend.getDocument(secondDocUrl)) === null) {
        removed = true;
        break;
      }
      await waitMs(5);
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
      '.ds-splat-context__tool-selector [data-tool-family="stamp.alphabet"]',
    ) as HTMLElement | null;
    const cursorIndicator = container.querySelector(
      ".kids-draw-cursor-indicator",
    ) as HTMLDivElement | null;

    expect(lettersFamilyButton).not.toBeNull();
    expect(cursorIndicator).not.toBeNull();
    expect(lettersFamilyButton?.getAttribute("title")).toBe("Letters");

    lettersFamilyButton!.click();
    expect(app.store.getActiveToolId()).toBe("stamp.letter.a");
    const selectedLettersFamilyButton = container.querySelector(
      '.ds-splat-context__tool-selector [data-tool-family="stamp.alphabet"]',
    ) as HTMLElement | null;
    expect(selectedLettersFamilyButton?.getAttribute("aria-pressed")).toBe(
      "true",
    );
    const lettersToolbar = container.querySelector(
      ".ds-splat-context__variant-strip",
    ) as HTMLElement | null;
    const stampZVariantButton = container.querySelector(
      '[data-tool-variant="stamp.letter.z"]',
    ) as HTMLElement | null;
    expect(lettersToolbar).not.toBeNull();
    expect(stampZVariantButton).not.toBeNull();
    expect(lettersToolbar?.getAttribute("data-large-layout")).toBe("two-row");
    expect(lettersToolbar?.getAttribute("data-paginate-large")).toBe("false");
    const variantButtons = lettersToolbar?.querySelectorAll(
      "[data-tool-variant]",
    );
    expect(variantButtons?.length).toBe(26);
    expect(
      stampZVariantButton?.getAttribute("data-layout") ?? null,
    ).toBeNull();
    const firstVariantLabel = lettersToolbar?.querySelector(
      '[data-tool-variant="stamp.letter.a"] .kids-square-icon-button__label',
    ) as HTMLElement | null;
    expect(firstVariantLabel?.textContent).toBe("A");
    dispatchPointer(overlay, "pointermove", 140, 110, 0, "mouse");
    expect(cursorIndicator!.classList.contains("is-glyph-preview")).toBeTrue();
    expect(cursorIndicator!.style.visibility).toBe("");

    stampZVariantButton!.click();
    expect(app.store.getActiveToolId()).toBe("stamp.letter.z");
    const selectedLettersAfterVariant = container.querySelector(
      '.ds-splat-context__tool-selector [data-tool-family="stamp.alphabet"]',
    ) as HTMLElement | null;
    expect(selectedLettersAfterVariant?.getAttribute("aria-pressed")).toBe(
      "true",
    );
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
      '.ds-splat-context__tool-selector [data-tool-family="stamp.images"]',
    ) as HTMLElement | null;
    const cursorIndicator = container.querySelector(
      ".kids-draw-cursor-indicator",
    ) as HTMLDivElement | null;

    expect(imageFamilyButton).not.toBeNull();

    imageFamilyButton!.click();
    expect(app.store.getActiveToolId()).toBe("stamp.image.bird1");
    const selectedImageFamilyButton = container.querySelector(
      '.ds-splat-context__tool-selector [data-tool-family="stamp.images"]',
    ) as HTMLElement | null;
    expect(selectedImageFamilyButton?.getAttribute("aria-pressed")).toBe(
      "true",
    );
    const imageToolbar = container.querySelector(
      ".ds-splat-context__variant-strip",
    ) as HTMLElement | null;
    const imageVariantButton = container.querySelector(
      '[data-tool-variant="stamp.image.cat1"]',
    ) as HTMLElement | null;
    const prevPageButton = container.querySelector(
      '.ds-splat-context__variant-strip [data-button-grid-nav="prev"]',
    ) as HTMLElement | null;
    const nextPageButton = container.querySelector(
      '.ds-splat-context__variant-strip [data-button-grid-nav="next"]',
    ) as HTMLElement | null;
    const imageIcon = imageVariantButton?.querySelector(
      ".kids-square-icon-button__icon-image",
    ) as HTMLImageElement | null;
    expect(imageToolbar).not.toBeNull();
    expect(imageVariantButton).not.toBeNull();
    expect(prevPageButton).not.toBeNull();
    expect(nextPageButton).not.toBeNull();
    expect(imageIcon).not.toBeNull();
    expect(imageToolbar?.getAttribute("data-large-layout")).toBe("two-row");
    expect(imageToolbar?.getAttribute("data-paginate-large")).toBe("true");
    expect(
      imageVariantButton?.getAttribute("data-layout") ?? null,
    ).toBeNull();
    dispatchPointer(overlay, "pointermove", 150, 130, 0, "mouse");
    expect(cursorIndicator).not.toBeNull();
    expect(cursorIndicator!.style.visibility).toBe("");

    imageVariantButton!.click();
    expect(app.store.getActiveToolId()).toBe("stamp.image.cat1");
    const selectedImagesAfterVariant = container.querySelector(
      '.ds-splat-context__tool-selector [data-tool-family="stamp.images"]',
    ) as HTMLElement | null;
    expect(selectedImagesAfterVariant?.getAttribute("aria-pressed")).toBe(
      "true",
    );
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
      '.ds-splat-context__tool-selector [data-tool-family="brush"]',
    ) as HTMLElement | null;
    const penVariantButton = container.querySelector(
      '[data-tool-variant="brush.freehand"]',
    ) as HTMLElement | null;
    const eraserFamilyButton = container.querySelector(
      '.ds-splat-context__tool-selector [data-tool-family="eraser"]',
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
      '.ds-splat-context__tool-selector [data-tool-family="stamp.alphabet"]',
    ) as HTMLElement | null;
    expect(cursorIndicator).not.toBeNull();
    expect(alphabetFamilyButton).not.toBeNull();

    alphabetFamilyButton!.click();
    const stampAVariantButton = container.querySelector(
      '[data-tool-variant="stamp.letter.a"]',
    ) as HTMLElement | null;
    expect(stampAVariantButton).not.toBeNull();
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
        '[data-new-document-mode="normal"]',
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
    const landscapePage = getColoringPageById("coloring/pdr-v1/page-009.png");
    expect(landscapePage).not.toBeNull();

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
        '[data-new-document-volume="pdr-v1"]',
      ) as HTMLButtonElement | null;
      expect(volumeButton).not.toBeNull();
      volumeButton!.click();

      const pageButton = container.querySelector(
        '[data-new-document-page="coloring/pdr-v1/page-009.png"]',
      ) as HTMLButtonElement | null;
      expect(pageButton).not.toBeNull();
      pageButton!.click();

      const resized = await waitUntil(() => {
        return (
          hotCanvas!.style.width === `${landscapePage!.size.width}px` &&
          hotCanvas!.style.height === `${landscapePage!.size.height}px`
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
        '[data-new-document-volume="pdr-v1"]',
      ) as HTMLButtonElement | null;
      expect(volumeButton).not.toBeNull();
      volumeButton!.click();
      const pageButton = container.querySelector(
        '[data-new-document-page="coloring/pdr-v1/page-009.png"]',
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
      '.ds-splat-context__variant-strip [data-button-grid-nav="prev"]',
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
        '.ds-splat-context__tool-selector [data-tool-family="stamp.images"]',
      ) as HTMLButtonElement | null;
      const selectorPrevButton = container.querySelector(
        '.ds-splat-context__variant-strip [data-button-grid-nav="prev"]',
      ) as HTMLButtonElement | null;
      const selectorNextButton = container.querySelector(
        '.ds-splat-context__variant-strip [data-button-grid-nav="next"]',
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
        ".ds-splat-context__tool-selector [data-tool-family], .ds-splat-context__tool-selector [data-tool-id]",
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
