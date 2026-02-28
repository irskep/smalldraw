import { DEFAULT_LAYER_ID, type DrawingDocument } from "../model/document";

export interface ApplyDocumentDiff {
  prevDoc: DrawingDocument;
  nextDoc: DrawingDocument;
  added: Set<string>;
  removed: Set<string>;
  changed: Set<string>;
  zOrderChangedLayers: Set<string>;
  layerTopologyChanged: boolean;
  requiresFullInvalidation: boolean;
}

/**
 * Compute a structural diff between two document snapshots.
 *
 * Change detection uses reference equality (`prevDoc.shapes[id] !== nextDoc.shapes[id]`).
 * Callers must not mutate shape objects in place and then diff those snapshots.
 */
export function diffDocumentShapes(
  prevDoc: DrawingDocument,
  nextDoc: DrawingDocument,
): Omit<ApplyDocumentDiff, "prevDoc" | "nextDoc"> {
  const added = new Set<string>();
  const removed = new Set<string>();
  const changed = new Set<string>();
  const zOrderChangedLayers = new Set<string>();

  for (const id of Object.keys(prevDoc.shapes)) {
    const prevShape = prevDoc.shapes[id];
    const nextShape = nextDoc.shapes[id];
    if (!nextShape) {
      removed.add(id);
      continue;
    }
    if (prevShape !== nextShape) {
      changed.add(id);
    }
  }

  for (const id of Object.keys(nextDoc.shapes)) {
    if (!(id in prevDoc.shapes)) {
      added.add(id);
    }
  }

  for (const id of changed) {
    const prevShape = prevDoc.shapes[id];
    const nextShape = nextDoc.shapes[id];
    if (!prevShape || !nextShape) {
      continue;
    }
    if (prevShape.zIndex !== nextShape.zIndex) {
      zOrderChangedLayers.add(prevShape.layerId ?? DEFAULT_LAYER_ID);
      zOrderChangedLayers.add(nextShape.layerId ?? DEFAULT_LAYER_ID);
    }
  }

  const prevLayerIds = getReferencedLayerIds(prevDoc);
  const nextLayerIds = getReferencedLayerIds(nextDoc);
  const layerTopologyChanged = !setsEqual(prevLayerIds, nextLayerIds);

  return {
    added,
    removed,
    changed,
    zOrderChangedLayers,
    layerTopologyChanged,
    requiresFullInvalidation: layerTopologyChanged,
  };
}

function getReferencedLayerIds(doc: DrawingDocument): Set<string> {
  const layerIds = new Set<string>();
  for (const shape of Object.values(doc.shapes)) {
    layerIds.add(shape.layerId ?? DEFAULT_LAYER_ID);
  }
  return layerIds;
}

function setsEqual(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) {
    return false;
  }
  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }
  return true;
}
