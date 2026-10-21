import { describe, expect, test } from "bun:test";

import { change } from "@automerge/automerge/slim";

import { createDocument } from "../model/document";
import { getDefaultShapeHandlerRegistry } from "../model/shapeHandlers";
import type { BoxedShape } from "../model/shapes/boxedShape";
import {
  getOrderedLayers,
  getShapesInLayer,
  getTopZIndexInLayer,
} from "../zindex";

describe("layer z-index helpers", () => {
  test("returns layers ordered by zIndex", () => {
    const registry = getDefaultShapeHandlerRegistry();
    const baseDoc = createDocument(undefined, registry);
    const doc = change(baseDoc, (draft) => {
      draft.layers = {
        top: { id: "top", kind: "drawing", zIndex: "c" },
        bottom: { id: "bottom", kind: "drawing", zIndex: "a" },
        middle: { id: "middle", kind: "drawing", zIndex: "b" },
      };
    });
    expect(getOrderedLayers(doc).map((layer) => layer.id)).toEqual([
      "bottom",
      "middle",
      "top",
    ]);
  });

  test("filters shapes by layer and returns zIndex order", () => {
    const registry = getDefaultShapeHandlerRegistry();
    const doc = createDocument(
      [
        {
          id: "a",
          type: "boxed",
          geometry: { type: "boxed", kind: "rect", size: [10, 10] },
          style: {},
          zIndex: "b",
          layerId: "default",
        } as BoxedShape,
        {
          id: "b",
          type: "boxed",
          geometry: { type: "boxed", kind: "rect", size: [10, 10] },
          style: {},
          zIndex: "a",
          layerId: "sticker",
        } as BoxedShape,
        {
          id: "c",
          type: "boxed",
          geometry: { type: "boxed", kind: "rect", size: [10, 10] },
          style: {},
          zIndex: "c",
          layerId: "default",
        } as BoxedShape,
      ],
      registry,
    );
    expect(getShapesInLayer(doc, "default").map((shape) => shape.id)).toEqual([
      "a",
      "c",
    ]);
    expect(getTopZIndexInLayer(doc, "default")).toBe("c");
    expect(getTopZIndexInLayer(doc, "sticker")).toBe("a");
    expect(getTopZIndexInLayer(doc, "missing")).toBeNull();
  });
});

test("new layer positions stay above shapes hidden by a clear", () => {
  const registry = getDefaultShapeHandlerRegistry();
  const doc = change(createDocument(undefined, registry), (draft) => {
    draft.shapes.hidden = {
      id: "hidden",
      type: "boxed",
      geometry: { type: "boxed", kind: "rect", size: [10, 10] },
      style: {},
      zIndex: "a5",
      layerId: "default",
      temporalOrder: 0,
    } as BoxedShape;
    draft.shapes.clear = {
      id: "clear",
      type: "clear",
      geometry: { type: "clear" },
      style: {},
      zIndex: "a0",
      temporalOrder: 1,
    };
  });
  expect(getShapesInLayer(doc, "default")).toHaveLength(0);
  expect(getTopZIndexInLayer(doc, "default")).toBe("a5");
});
