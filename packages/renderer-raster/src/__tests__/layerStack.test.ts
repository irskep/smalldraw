import { describe, expect, test } from "bun:test";

import { AddShape, DrawingStore } from "@smalldraw/core";

import {
  createLayerStack,
  type LayerStack,
  resolveLayerStrategy,
} from "../layerStack";
import { createTestShapeRendererRegistry } from "./testShapeRendererRegistry";

type FakeElement = {
  tagName: string;
  style: Record<string, string>;
  dataset: Record<string, string>;
  children: FakeElement[];
  parentElement: FakeElement | null;
  className: string;
  width?: number;
  height?: number;
  getContext?: (_type: string) => object | null;
  appendChild: (child: FakeElement) => FakeElement;
  insertBefore: (child: FakeElement, before: FakeElement | null) => FakeElement;
  remove: () => void;
};

function createFakeElement(tagName: string): FakeElement {
  const element: FakeElement = {
    tagName,
    style: {},
    dataset: {},
    children: [],
    parentElement: null,
    className: "",
    appendChild(child) {
      if (child.parentElement) {
        child.remove();
      }
      this.children.push(child);
      child.parentElement = this;
      return child;
    },
    insertBefore(child, before) {
      if (child.parentElement) {
        child.remove();
      }
      if (!before) {
        this.children.push(child);
      } else {
        const index = this.children.indexOf(before);
        if (index < 0) {
          this.children.push(child);
        } else {
          this.children.splice(index, 0, child);
        }
      }
      child.parentElement = this;
      return child;
    },
    remove() {
      if (!this.parentElement) {
        return;
      }
      const index = this.parentElement.children.indexOf(this);
      if (index >= 0) {
        this.parentElement.children.splice(index, 1);
      }
      this.parentElement = null;
    },
  };
  if (tagName === "canvas") {
    element.width = 1;
    element.height = 1;
    element.getContext = () => ({
      canvas: element,
      setTransform: () => {},
      clearRect: () => {},
      fillRect: () => {},
      drawImage: () => {},
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      rect: () => {},
      clip: () => {},
      translate: () => {},
      rotate: () => {},
      scale: () => {},
      fillStyle: "",
    });
  }
  return element;
}

function withFakeDom<T>(
  fn: (env: {
    registry: ReturnType<typeof createTestShapeRendererRegistry>;
    store: DrawingStore;
    host: HTMLElement;
    hotCanvas: HTMLCanvasElement;
    stack: LayerStack & {
      scheduleFullInvalidation(): void;
      flushBakes(): Promise<void>;
    };
  }) => Promise<T> | T,
): Promise<T> | T {
  const originalDocument = globalThis.document;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const host = createFakeElement("div");
  const hotCanvas = createFakeElement("canvas");
  const fakeDocument = {
    createElement: (tagName: string) => createFakeElement(tagName),
  } as unknown as Document;
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: fakeDocument,
  });
  Object.defineProperty(globalThis, "getComputedStyle", {
    configurable: true,
    value: () => ({ position: "static" }),
  });

  const store = new DrawingStore({ tools: [] });
  const registry = createTestShapeRendererRegistry();
  const stack = createLayerStack({
    store,
    host: host as unknown as HTMLElement,
    hotCanvas: hotCanvas as unknown as HTMLCanvasElement,
    shapeRendererRegistry: registry,
    resolveImage: () => null,
  });

  const cleanup = () => {
    stack.dispose();
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: originalDocument,
    });
    Object.defineProperty(globalThis, "getComputedStyle", {
      configurable: true,
      value: originalGetComputedStyle,
    });
  };

  try {
    const result = fn({
      registry,
      store,
      host: host as unknown as HTMLElement,
      hotCanvas: hotCanvas as unknown as HTMLCanvasElement,
      stack,
    });
    if (result instanceof Promise) {
      return result.finally(cleanup);
    }
    cleanup();
    return result;
  } catch (error) {
    cleanup();
    throw error;
  }
}

function createRectShape(id: string, layerId: string, zIndex: string) {
  return {
    id,
    type: "boxed" as const,
    geometry: {
      type: "boxed" as const,
      kind: "rect",
      size: [100, 50] as [number, number],
    },
    style: { fill: { type: "solid" as const, color: "#ff0000" } },
    zIndex,
    layerId,
    transform: {
      translation: [0, 0] as [number, number],
      scale: [1, 1] as [number, number],
      rotation: 0,
    },
  };
}

describe("LayerStack", () => {
  test("tile replay filters by location and refreshes after move, delete, clear and undo-clear", () =>
    withFakeDom(async ({ stack, store, registry }) => {
      const near = createRectShape("near", "base", "a0");
      near.transform.translation = [100, 100];
      const far = createRectShape("far", "base", "a1");
      far.transform.translation = [1500, 100];
      store.mutateDocument(new AddShape(near));
      store.mutateDocument(new AddShape(far));
      const calls: string[] = [];
      registry.set("boxed", (_ctx, shape) => {
        calls.push(shape.id);
      });
      stack.updateViewport(2048, 1024, 1);
      stack.setLayers([{ id: "base", kind: "drawing", zIndex: "a0" }]);
      await stack.flushBakes();
      expect(calls).toEqual(["near", "far"]);
      calls.length = 0;
      stack.routeDirtyRegions(
        new Map([["base", [{ min: [80, 80], max: [120, 120] }]]]),
      );
      await stack.flushBakes();
      expect(calls).toEqual(["near"]);

      const doc = store.getDocument();
      store.applyDocument({
        ...doc,
        shapes: {
          ...doc.shapes,
          far: { ...doc.shapes.far, transform: { translation: [120, 100] } },
        },
      });
      calls.length = 0;
      stack.routeDirtyShapeRegions(
        new Map([
          [
            "base",
            [
              {
                shapeId: "far",
                prevBounds: { min: [1450, 75], max: [1550, 125] },
                nextBounds: { min: [70, 75], max: [170, 125] },
              },
            ],
          ],
        ]),
      );
      await stack.flushBakes();
      expect(calls).toEqual(["near", "far"]);

      const moved = store.getDocument();
      const { near: _deleted, ...remaining } = moved.shapes;
      store.applyDocument({ ...moved, shapes: remaining });
      calls.length = 0;
      stack.scheduleFullInvalidation();
      await stack.flushBakes();
      expect(calls).toEqual(["far"]);

      const beforeClear = store.getDocument();
      store.applyDocument({
        ...beforeClear,
        shapes: {
          ...beforeClear.shapes,
          clear: {
            id: "clear",
            type: "clear",
            geometry: { type: "clear" },
            zIndex: "a2",
            temporalOrder: 100,
            style: {},
          },
        },
      });
      calls.length = 0;
      stack.scheduleFullInvalidation();
      await stack.flushBakes();
      expect(calls).toEqual([]);
      store.applyDocument(beforeClear);
      stack.scheduleFullInvalidation();
      await stack.flushBakes();
      expect(calls).toEqual(["far"]);
    }));

  test("a single-tile viewport avoids bounds preparation for replay filtering", () =>
    withFakeDom(async ({ stack, store, registry }) => {
      store.mutateDocument(
        new AddShape(createRectShape("shape", "base", "a0")),
      );
      stack.updateViewport(500, 500, 1);
      stack.setLayers([{ id: "base", kind: "drawing", zIndex: "a0" }]);
      await stack.flushBakes();
      let renders = 0;
      registry.set("boxed", () => {
        renders++;
      });
      const handler = store.getShapeHandlers().get("boxed")!;
      const previous = handler.geometry!.getBounds;
      handler.geometry!.getBounds = () => {
        throw new Error("unexpected bounds work");
      };
      try {
        stack.scheduleFullInvalidation();
        await stack.flushBakes();
        expect(renders).toBe(1);
      } finally {
        handler.geometry!.getBounds = previous;
      }
    }));

  test("unchanged active layer does not move DOM nodes", () =>
    withFakeDom(async ({ stack, host }) => {
      stack.setLayers([{ id: "base", kind: "drawing", zIndex: "a0" }]);
      await stack.flushBakes();
      let moves = 0;
      const append = host.appendChild.bind(host);
      host.appendChild = ((child: Node) => {
        moves++;
        return append(child);
      }) as typeof host.appendChild;
      stack.setActiveLayer("base");
      stack.setActiveLayer("base");
      expect(moves).toBe(0);
    }));

  test.each(["cancel", "dispose"])(
    "pending capture cannot hide layers after %s",
    (operation) =>
      withFakeDom(async ({ stack, host }) => {
        stack.setLayers([{ id: "base", kind: "drawing", zIndex: "a0" }]);
        const pending = stack.beginActiveLayerDraftSession();
        if (operation === "dispose") stack.dispose();
        else stack.endActiveLayerDraftSession();
        await pending;
        expect(stack.getActiveLayerDraftComposite()).toBeNull();
        for (const child of (host as unknown as FakeElement).children)
          expect(child.style.display).not.toBe("none");
      }),
  );

  test("remote invalidation preserves the current frozen draft and refreshes the next", () =>
    withFakeDom(async ({ stack }) => {
      stack.setLayers([{ id: "base", kind: "drawing", zIndex: "a0" }]);
      await stack.beginActiveLayerDraftSession();
      const frozen = stack.getActiveLayerDraftComposite();
      stack.scheduleFullInvalidation();
      await stack.flushBakes();
      expect(stack.getActiveLayerDraftComposite()).toBe(frozen);
      stack.endActiveLayerDraftSession();
      await stack.beginActiveLayerDraftSession();
      expect(stack.getActiveLayerDraftComposite()).not.toBe(frozen);
    }));

  test("a failed bake does not poison later invalidations", () =>
    withFakeDom(async ({ stack, store, registry }) => {
      store.mutateDocument(
        new AddShape(createRectShape("shape", "base", "a0")),
      );
      const render = registry.get("boxed")!;
      registry.set("boxed", () => {
        throw new Error("temporary render failure");
      });
      stack.setLayers([{ id: "base", kind: "drawing", zIndex: "a0" }]);
      await expect(stack.flushBakes()).rejects.toThrow(
        "temporary render failure",
      );
      registry.set("boxed", render);
      stack.scheduleFullInvalidation();
      await stack.flushBakes();
      await stack.beginActiveLayerDraftSession();
      expect(stack.getActiveLayerDraftComposite()).not.toBeNull();
    }));

  test("resolveLayerStrategy is centralized by layer kind", () => {
    expect(
      resolveLayerStrategy({
        id: "base",
        kind: "drawing",
        zIndex: "a0",
      }),
    ).toBe("tile");
    expect(
      resolveLayerStrategy({
        id: "lineart",
        kind: "image",
        zIndex: "a1",
        image: { src: "/lineart.png" },
      }),
    ).toBe("canvas");
  });

  test("inserts hot canvas at active layer z-slot", () =>
    withFakeDom(({ stack, host, hotCanvas }) => {
      stack.setLayers([
        { id: "base", kind: "drawing", zIndex: "a0" },
        {
          id: "lineart",
          kind: "image",
          zIndex: "a1",
          image: { src: "/lineart.png" },
        },
        { id: "stickers", kind: "drawing", zIndex: "a2" },
      ]);
      stack.setActiveLayer("lineart");
      const children = (host as unknown as FakeElement).children;
      const labels = children.map((child) =>
        child === (hotCanvas as unknown as FakeElement)
          ? "hot"
          : (child.dataset.layerId ?? "unknown"),
      );
      expect(labels).toEqual(["base", "lineart", "hot", "stickers"]);
    }));

  test("begin/end draft hides and restores layer containers", () =>
    withFakeDom(async ({ stack, host }) => {
      stack.setLayers([
        { id: "base", kind: "drawing", zIndex: "a0" },
        { id: "stickers", kind: "drawing", zIndex: "a1" },
      ]);
      stack.setActiveLayer("base");
      const baseContainer = (host as unknown as FakeElement).children.find(
        (child) => child.dataset.layerId === "base",
      );
      if (!baseContainer) {
        throw new Error("Missing base layer container");
      }
      const stickersContainer = (host as unknown as FakeElement).children.find(
        (child) => child.dataset.layerId === "stickers",
      );
      if (!stickersContainer) {
        throw new Error("Missing stickers layer container");
      }
      expect(baseContainer.style.display ?? "").toBe("");
      expect(stickersContainer.style.display ?? "").toBe("");
      await stack.beginActiveLayerDraftSession();
      expect(baseContainer.style.display).toBe("none");
      expect(stickersContainer.style.display).toBe("none");
      stack.endActiveLayerDraftSession();
      expect(baseContainer.style.display ?? "").toBe("");
      expect(stickersContainer.style.display ?? "").toBe("");
    }));

  test("begin draft captures below active and above visible groups", () =>
    withFakeDom(async ({ stack }) => {
      stack.setLayers([
        { id: "base", kind: "drawing", zIndex: "a0" },
        { id: "color", kind: "drawing", zIndex: "a1" },
        { id: "hidden-lineart", kind: "image", zIndex: "a2", visible: false },
        { id: "stickers", kind: "drawing", zIndex: "a3" },
      ]);
      stack.setActiveLayer("color");

      await stack.beginActiveLayerDraftSession();

      const composite = stack.getActiveLayerDraftComposite();
      expect(composite).not.toBeNull();
      expect(composite?.below).not.toBeNull();
      expect(composite?.active).not.toBeNull();
      expect(composite?.above).not.toBeNull();
    }));

  test("routeDirtyShapes updates only touched layer counters", () =>
    withFakeDom(({ stack, store }) => {
      const perfState = {
        counters: {} as Record<string, number>,
      };
      (globalThis as Record<string, unknown>).__kidsDrawPerf = perfState;
      store.mutateDocument(
        new AddShape(createRectShape("shape-base", "base", "a0")),
      );
      store.mutateDocument(
        new AddShape(createRectShape("shape-stickers", "stickers", "a1")),
      );

      stack.setLayers([
        { id: "base", kind: "drawing", zIndex: "a0" },
        { id: "stickers", kind: "drawing", zIndex: "a1" },
      ]);
      stack.routeDirtyShapes(["shape-base"], []);

      expect(perfState.counters["layer.base.dirty.count"]).toBe(1);
      expect(perfState.counters["layer.stickers.dirty.count"]).toBeUndefined();
      delete (globalThis as Record<string, unknown>).__kidsDrawPerf;
    }));
});
