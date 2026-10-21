import { expect, test } from "bun:test";
import type { DrawingDocument, DrawingStoreActionEvent } from "@smalldraw/core";
import { createDrawingUsageAnalytics } from "../app/usageAnalytics";

const tools = [
  { id: "brush.marker", familyId: "brush", label: "Marker" },
  { id: "fill.basic", familyId: "fill", label: "Fill" },
];
function action(
  type: DrawingStoreActionEvent["type"],
  shapeType = "raster-fill",
): DrawingStoreActionEvent {
  const doc = {
    shapes: { shape: { type: shapeType } },
    presentation: {
      documentType: "coloring",
      referenceImage: {
        src: "coloring/pdr-v1/page-001.png",
        composite: "over-drawing",
      },
    },
  } as unknown as DrawingDocument;
  return {
    type,
    doc,
    action: {
      affectedShapeIds: () => ["shape"],
      affectsZOrder: () => false,
      redo: () => doc,
      undo: () => doc,
    },
  };
}

test("async fills retain their attribution after switching tools; undo/redo are not usage", () => {
  const events: string[] = [];
  const usage = createDrawingUsageAnalytics(
    { event: (name) => events.push(name) },
    tools,
  );
  usage.action(action("undo"), "brush.marker");
  usage.action(action("redo"), "brush.marker");
  expect(events).toEqual([]);
  usage.action(action("apply"), "brush.marker");
  expect(events).toEqual([
    "tool-used/fill.basic",
    "coloring-started/pdr-v1/page-001",
  ]);
});

test("deletion and unrecognized references do not produce tool or private page events", () => {
  const events: string[] = [];
  const usage = createDrawingUsageAnalytics(
    { event: (name) => events.push(name) },
    tools,
  );
  const change = action("apply");
  change.doc = { ...change.doc, shapes: {} };
  usage.action(change, "brush.marker");
  usage.opened({
    ...change.doc,
    presentation: {
      documentType: "coloring",
      referenceImage: {
        src: "https://private.example/SECRET",
        composite: "over-drawing",
      },
    },
  });
  expect(events).toEqual([]);
});
