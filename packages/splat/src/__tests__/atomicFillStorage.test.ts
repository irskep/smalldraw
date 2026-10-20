import { expect, test } from "bun:test";
import {
  change,
  free,
  isImmutableString,
  load,
  save,
  stats,
} from "@automerge/automerge/slim";
import {
  type ActionContext,
  AddShape,
  type AnyShape,
  createDocument,
  DeleteShape,
  type DrawingDocumentData,
  getOrderedShapes,
  UndoManager,
} from "@smalldraw/core";
import { getDocumentImageSources } from "../shapes/getDocumentImageSources";
import { createKidsShapeHandlerRegistry } from "../shapes/kidsShapeHandlers";
import type { RasterFillShape } from "../shapes/rasterFillShape";

test("fill images remain atomic through commit, deletion, undo, serialization and image prewarming", () => {
  const registry = createKidsShapeHandlerRegistry();
  const undo = new UndoManager();
  const context: ActionContext = {
    registry,
    change: (doc, update) => change(doc, update),
  };
  const counts = [];
  for (const size of [100, 100000]) {
    const src = `data:image/png;base64,${"a".repeat(size)}`;
    let doc = createDocument([], registry);
    doc = undo.apply(
      new AddShape({
        id: "fill",
        type: "raster-fill",
        zIndex: "a0",
        style: {},
        geometry: { type: "raster-fill", src, width: 100, height: 100 },
      } as AnyShape),
      doc,
      context,
    );
    counts.push(stats(doc).numOps);
    doc = undo.apply(new DeleteShape("fill"), doc, context);
    doc = undo.undo(doc, context).doc;
    const restored = load<DrawingDocumentData>(save(doc));
    const shape = getOrderedShapes(restored)[0] as RasterFillShape;
    expect(isImmutableString(shape.geometry.src)).toBe(true);
    expect(shape.geometry.src.toString()).toBe(src);
    expect(getDocumentImageSources(restored)).toEqual([src]);
    const serializer = registry.get("raster-fill")!.serialization!;
    const json = JSON.parse(JSON.stringify(serializer.toJSON(shape)));
    const hydrated = serializer.fromJSON(json) as RasterFillShape;
    expect(isImmutableString(hydrated.geometry.src)).toBe(true);
    expect(hydrated.geometry.src.toString()).toBe(src);
    free(restored);
    free(doc);
  }
  expect(counts[1]).toBe(counts[0]);
});
