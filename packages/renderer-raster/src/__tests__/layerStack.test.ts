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
      fillStyle: "",
    });
  }
  return element;
}

function withFakeDom<T>(
  fn: (env: {
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
  const stack = createLayerStack({
    store,
    host: host as unknown as HTMLElement,
    hotCanvas: hotCanvas as unknown as HTMLCanvasElement,
    shapeRendererRegistry: createTestShapeRendererRegistry(),
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

  test("begin/end draft toggles active layer container visibility", () =>
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
      expect(baseContainer.style.visibility ?? "").toBe("");
      await stack.beginActiveLayerDraftSession();
      expect(baseContainer.style.visibility).toBe("hidden");
      stack.endActiveLayerDraftSession();
      expect(baseContainer.style.visibility ?? "").toBe("");
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
