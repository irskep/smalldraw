import { describe, expect, test } from "bun:test";
import {
  createDocument,
  getDefaultLayersForPresentation,
  normalizeDocumentLayers,
} from "../document";
import { getDefaultShapeHandlerRegistry } from "../shapeHandlers";

describe("document layer normalization", () => {
  test("normalizes to default drawing layer for normal presentation", () => {
    const layers = normalizeDocumentLayers(undefined, {
      documentType: "normal",
    });
    expect(Object.keys(layers)).toEqual(["default"]);
    expect(layers.default.kind).toBe("drawing");
  });

  test("builds coloring layer stack for over-drawing reference", () => {
    const layers = getDefaultLayersForPresentation({
      documentType: "coloring",
      referenceImage: {
        src: "/lineart.png",
        composite: "over-drawing",
      },
    });
    expect(Object.keys(layers)).toEqual([
      "color-under",
      "lineart",
      "stickers-over",
    ]);
    expect(layers.lineart.kind).toBe("image");
    expect(layers.lineart.image?.src).toBe("/lineart.png");
  });

  test("builds markup layer stack for under-drawing reference", () => {
    const layers = getDefaultLayersForPresentation({
      documentType: "markup",
      referenceImage: {
        src: "/photo.png",
        composite: "under-drawing",
      },
    });
    expect(Object.keys(layers)).toEqual([
      "background",
      "default",
      "stickers-over",
    ]);
    expect(layers.background.kind).toBe("image");
    expect(layers.background.image?.src).toBe("/photo.png");
    expect(layers.background.zIndex).toBe("a0");
    expect(layers.default.zIndex).toBe("a1");
    expect(layers["stickers-over"].zIndex).toBe("a2");
  });

  test("createDocument seeds layers from presentation", () => {
    const registry = getDefaultShapeHandlerRegistry();
    const doc = createDocument(undefined, registry, undefined, {
      documentType: "coloring",
      referenceImage: {
        src: "/lineart.png",
        composite: "over-drawing",
      },
    });
    expect(Object.keys(doc.layers)).toEqual([
      "color-under",
      "lineart",
      "stickers-over",
    ]);
  });
});
