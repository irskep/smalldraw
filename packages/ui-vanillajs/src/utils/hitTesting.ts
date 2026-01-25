import {
  type AnyGeometry,
  type DrawingDocument,
  type DrawingStore,
  getOrderedShapes,
  getShapeBounds,
  resolveSelectionHandlePoint,
  type Shape,
} from "@smalldraw/core";
import { distance, type Point } from "@smalldraw/geometry";
import { computeSelectionBounds } from "./geometryHelpers.js";

type ShapeWithGeometry = Shape & { geometry: AnyGeometry };

const HANDLE_SIZE = 8;
const HANDLE_HIT_PADDING = 6;

/**
 * Build a live document including drafts.
 */
export function buildLiveDocument(store: DrawingStore): DrawingDocument {
  const base = store.getDocument();
  const shapes: Record<string, Shape> = {};
  for (const shape of Object.values(base.shapes)) {
    shapes[shape.id] = shape;
  }
  for (const draft of store.getDrafts()) {
    const { temporary: _temp, toolId: _tool, ...shape } = draft;
    shapes[draft.id] = shape;
  }
  return { shapes };
}

/**
 * Check if shape can show axis handles (only single rect).
 */
export function canShowAxisHandles(store: DrawingStore): boolean {
  const selection = store.getSelection();
  const ids = Array.from(selection.ids);
  if (ids.length !== 1) {
    return false;
  }
  const liveDoc = buildLiveDocument(store);
  const shape = liveDoc.shapes[ids[0]] as ShapeWithGeometry | undefined;
  if (!shape) return false;
  const registry = store.getShapeHandlers();
  return (
    registry
      .get(shape.type)
      ?.selection?.supportsAxisResize?.(shape as ShapeWithGeometry) ?? false
  );
}

/**
 * Hit test against selection handles.
 */
export function hitTestHandles(
  point: Point,
  store: DrawingStore,
): string | undefined {
  const bounds = store.getSelectionFrame() ?? computeSelectionBounds(store);
  if (!bounds) return undefined;
  const liveDoc = buildLiveDocument(store);
  const selection = store.getSelection();
  const selectedId = selection.ids.size
    ? Array.from(selection.ids)[0]
    : selection.primaryId;
  const selectedShape = selectedId ? liveDoc.shapes[selectedId] : undefined;
  const showAxisHandles = canShowAxisHandles(store);
  const registry = store.getShapeHandlers();
  for (const handle of store
    .getHandles()
    .filter(
      (descriptor) =>
        showAxisHandles || descriptor.behavior?.type !== "resize-axis",
    )) {
    const handlePoint = resolveSelectionHandlePoint(
      bounds,
      handle,
      selectedShape,
      registry,
    );
    const hitSize =
      handle.behavior?.type === "resize-axis"
        ? Math.max(12, HANDLE_SIZE)
        : HANDLE_SIZE;
    if (distance(handlePoint, point) <= hitSize / 2 + HANDLE_HIT_PADDING) {
      return handle.id;
    }
  }
  return undefined;
}

/**
 * Hit test against shapes (top-down order).
 */
export function hitTestShapes(point: Point, store: DrawingStore): Shape | null {
  const doc = store.getDocument();
  const ordered = getOrderedShapes(doc);
  const registry = store.getShapeHandlers();
  for (let i = ordered.length - 1; i >= 0; i -= 1) {
    const shape = ordered[i];
    const bounds = getShapeBounds(shape, registry);
    if (
      point.x >= bounds.minX &&
      point.x <= bounds.maxX &&
      point.y >= bounds.minY &&
      point.y <= bounds.maxY
    ) {
      return shape;
    }
  }
  return null;
}

/**
 * Check if a point is within the selection bounds.
 */
export function isPointInSelectionBounds(
  point: Point,
  store: DrawingStore,
): boolean {
  const selection = store.getSelection();
  const ids = Array.from(selection.ids);
  console.log(
    "[isPointInSelectionBounds] checking point",
    point,
    "against selection ids:",
    ids,
  );
  if (!ids.length) {
    console.log("[isPointInSelectionBounds] no selection, returning false");
    return false;
  }

  const doc = store.getDocument();
  const registry = store.getShapeHandlers();
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const id of ids) {
    const shape = doc.shapes[id];
    if (!shape) {
      console.log("[isPointInSelectionBounds] shape not found:", id);
      continue;
    }
    const bounds = getShapeBounds(shape, registry);
    console.log("[isPointInSelectionBounds] shape", id, "bounds:", bounds);
    minX = Math.min(minX, bounds.minX);
    minY = Math.min(minY, bounds.minY);
    maxX = Math.max(maxX, bounds.maxX);
    maxY = Math.max(maxY, bounds.maxY);
  }

  const selectionBounds = { minX, minY, maxX, maxY };
  const isInside =
    point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
  console.log(
    "[isPointInSelectionBounds] selection bounds:",
    selectionBounds,
    "point:",
    point,
    "isInside:",
    isInside,
  );
  return isInside;
}
