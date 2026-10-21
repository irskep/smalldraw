import { expect, test } from "bun:test";

import { Repo } from "@automerge/automerge-repo/slim";
import {
  change,
  clone,
  free,
  from,
  getConflicts,
  getObjectId,
  ImmutableString,
  isImmutableString,
  load,
  merge,
  save,
  stats,
} from "@automerge/automerge/slim";

import { type ActionContext, AddShape, DeleteShape } from "../actions";
import { fromJSON, toJSON } from "../automerge/serialization";
import { createSmalldraw } from "../createSmalldraw";
import {
  createDocument,
  type DrawingDocument,
  type DrawingDocumentData,
} from "../model/document";
import { getDefaultShapeHandlerRegistry } from "../model/shapeHandlers";
import {
  createPenJSONGeometry,
  getPenGeometryPoints,
  type PenShape,
} from "../model/shapes/penShape";
import { UndoManager } from "../undo";

const registry = getDefaultShapeHandlerRegistry();
const context: ActionContext = {
  registry,
  change: (doc, update) => change(doc, update),
};
const stroke = (count: number): PenShape => ({
  id: "stroke",
  type: "pen",
  zIndex: "a0",
  style: {
    stroke: { type: "brush", brushId: "marker", color: "#000000", size: 8 },
  },
  geometry: createPenJSONGeometry(
    Array.from({ length: count }, (_, i) => [i / 3, Math.sin(i) * 50]),
  ),
});
const geometry = (doc: DrawingDocument) =>
  (doc.shapes.stroke as PenShape).geometry;

test("stroke persistence uses constant operation count through add, delete, undo and redo", () => {
  const counts: number[] = [];
  for (const count of [10, 4000]) {
    const undo = new UndoManager();
    let doc = createDocument([], registry);
    doc = undo.apply(new AddShape(stroke(count)), doc, context);
    const points = getPenGeometryPoints(geometry(doc));
    expect(isImmutableString(geometry(doc).pointsJson)).toBe(true);
    counts.push(stats(doc).numOps);
    doc = undo.undo(doc, context).doc;
    expect(doc.shapes.stroke).toBeUndefined();
    doc = undo.redo(doc, context).doc;
    doc = undo.apply(new DeleteShape("stroke"), doc, context);
    doc = undo.undo(doc, context).doc;
    expect(isImmutableString(geometry(doc).pointsJson)).toBe(true);
    const restored = load<DrawingDocumentData>(save(doc));
    expect(getPenGeometryPoints(geometry(restored))).toEqual(points);
    expect(isImmutableString(geometry(restored).pointsJson)).toBe(true);
    free(restored);
    free(doc);
  }
  expect(counts[1]).toBe(counts[0]);
});

test("JSON exports plain coordinates and imports restore atomic storage", () => {
  const doc = createDocument([stroke(100)], registry);
  const json = toJSON(doc, registry);
  expect(
    typeof (json.shapes.stroke.geometry as unknown as { pointsJson: unknown })
      .pointsJson,
  ).toBe("string");
  const restored = fromJSON(JSON.parse(JSON.stringify(json)), registry);
  expect(isImmutableString(geometry(restored).pointsJson)).toBe(true);
  expect(getPenGeometryPoints(geometry(restored))).toEqual(
    getPenGeometryPoints(geometry(doc)),
  );
  free(restored);
  free(doc);
});

test("concurrent geometry replacement merges whole coordinate strings", () => {
  const base = createDocument([stroke(10)], registry);
  const leftText = "[[1,2],[3,4]]",
    rightText = "[[5,6],[7,8]]";
  const left = change(clone(base), (d) => {
    geometry(d).pointsJson = new ImmutableString(leftText);
  });
  const right = change(clone(base), (d) => {
    geometry(d).pointsJson = new ImmutableString(rightText);
  });
  const merged = merge(left, right);
  expect([leftText, rightText]).toContain(
    geometry(merged).pointsJson.toString(),
  );
  const conflicts = Object.values(
    getConflicts(geometry(merged), "pointsJson")!,
  );
  expect(conflicts.map(String).sort()).toEqual([leftText, rightText].sort());
  expect(isImmutableString(geometry(merged).pointsJson)).toBe(true);
  free(merged);
  free(right);
  free(base);
});

test("sharing copies and retries retain atomic coordinates, including drawings loaded from plain JSON", async () => {
  const source = createDocument([stroke(4000)], registry);
  const expected = getPenGeometryPoints(geometry(source));
  // A JSON document has collaborative strings; sharing must hydrate its shape values.
  const plain = from<DrawingDocumentData & Record<string, unknown>>(
    JSON.parse(JSON.stringify(source)),
  );
  const repo = new Repo({ network: [] });
  const original = repo.import<DrawingDocumentData>(save(plain));
  const core = await createSmalldraw({
    repo,
    shapeHandlers: registry,
    persistence: {
      getCurrentDocUrl: () => original.url,
      setCurrentDocUrl: () => {},
    },
  });
  const copied = core.createDocumentCopy();
  const restored = load<DrawingDocumentData>(copied.binary);
  expect(isImmutableString(geometry(restored).pointsJson)).toBe(true);
  expect(getPenGeometryPoints(geometry(restored))).toEqual(expected);
  expect(stats(restored).numOps).toBeLessThan(300);
  const retry = load<DrawingDocumentData>(
    core.createDocumentCopy(copied.url).binary,
  );
  expect(getObjectId(geometry(retry))).toBe(getObjectId(geometry(restored)));
  expect(isImmutableString(geometry(retry).pointsJson)).toBe(true);
  const peer = new Repo({ network: [] });
  const joined = peer.import<DrawingDocumentData>(copied.binary);
  await joined.whenReady();
  expect(getPenGeometryPoints(geometry(joined.doc()))).toEqual(expected);
  expect(isImmutableString(geometry(joined.doc()).pointsJson)).toBe(true);
  await repo.shutdown();
  await peer.shutdown();
  free(source);
  free(plain);
  free(restored);
  free(retry);
});
