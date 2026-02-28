import {
  type AnyShape,
  type ApplyDocumentDiff,
  DEFAULT_LAYER_ID,
  getShapeBounds,
  type ShapeHandlerRegistry,
} from "@smalldraw/core";
import type { Box } from "@smalldraw/geometry";
import type { LayerStack, ShapeRegionChange } from "@smalldraw/renderer-raster";
import { logDiagnosticEvent } from "../controller/diagnostics/diagnosticLogger";

export function processApplyDocumentDiff(
  diff: ApplyDocumentDiff,
  layerStack: LayerStack,
  shapeHandlers: ShapeHandlerRegistry,
): void {
  logDiagnosticEvent("pipeline_apply_diff_consumed", {
    added: diff.added.size,
    removed: diff.removed.size,
    changed: diff.changed.size,
    zOrderChangedLayers: diff.zOrderChangedLayers.size,
    requiresFullInvalidation: diff.requiresFullInvalidation,
    layerTopologyChanged: diff.layerTopologyChanged,
  });

  if (diff.requiresFullInvalidation) {
    layerStack.scheduleFullInvalidation();
    return;
  }

  const shapeChangesByLayer = new Map<string, ShapeRegionChange[]>();
  const regionFallbackByLayer = new Map<string, Box[]>();
  const fullyInvalidatedLayers = new Set<string>();

  const scheduleFullLayerInvalidation = (layerId: string): void => {
    if (fullyInvalidatedLayers.has(layerId)) {
      return;
    }
    fullyInvalidatedLayers.add(layerId);
    shapeChangesByLayer.delete(layerId);
    regionFallbackByLayer.delete(layerId);
    layerStack.scheduleFullLayerInvalidation(layerId);
  };

  const addShapeChange = (layerId: string, change: ShapeRegionChange): void => {
    if (fullyInvalidatedLayers.has(layerId)) {
      return;
    }
    const bucket = shapeChangesByLayer.get(layerId);
    if (bucket) {
      bucket.push(change);
      return;
    }
    shapeChangesByLayer.set(layerId, [change]);
  };

  const addRegionFallback = (layerId: string, region: Box): void => {
    if (fullyInvalidatedLayers.has(layerId)) {
      return;
    }
    const bucket = regionFallbackByLayer.get(layerId);
    if (bucket) {
      bucket.push(region);
      return;
    }
    regionFallbackByLayer.set(layerId, [region]);
  };

  for (const layerId of diff.zOrderChangedLayers) {
    scheduleFullLayerInvalidation(layerId);
  }

  for (const id of diff.added) {
    const shape = diff.nextDoc.shapes[id];
    if (!shape) {
      continue;
    }
    const layerId = shape.layerId ?? DEFAULT_LAYER_ID;
    const bounds = tryGetShapeBounds(shape, shapeHandlers);
    if (!bounds) {
      scheduleFullLayerInvalidation(layerId);
      continue;
    }
    addShapeChange(layerId, {
      shapeId: id,
      prevBounds: null,
      nextBounds: bounds,
    });
  }

  for (const id of diff.removed) {
    const shape = diff.prevDoc.shapes[id];
    if (!shape) {
      continue;
    }
    const layerId = shape.layerId ?? DEFAULT_LAYER_ID;
    const bounds = tryGetShapeBounds(shape, shapeHandlers);
    if (!bounds) {
      scheduleFullLayerInvalidation(layerId);
      continue;
    }
    addShapeChange(layerId, {
      shapeId: id,
      prevBounds: bounds,
      nextBounds: null,
    });
  }

  for (const id of diff.changed) {
    const prevShape = diff.prevDoc.shapes[id];
    const nextShape = diff.nextDoc.shapes[id];
    if (!prevShape || !nextShape) {
      continue;
    }

    const prevLayerId = prevShape.layerId ?? DEFAULT_LAYER_ID;
    const nextLayerId = nextShape.layerId ?? DEFAULT_LAYER_ID;
    const prevBounds = tryGetShapeBounds(prevShape, shapeHandlers);
    const nextBounds = tryGetShapeBounds(nextShape, shapeHandlers);

    if (!prevBounds || !nextBounds) {
      if (prevLayerId === nextLayerId) {
        scheduleFullLayerInvalidation(prevLayerId);
        continue;
      }
      if (prevBounds) {
        addRegionFallback(prevLayerId, prevBounds);
      } else {
        scheduleFullLayerInvalidation(prevLayerId);
      }
      if (nextBounds) {
        addRegionFallback(nextLayerId, nextBounds);
      } else {
        scheduleFullLayerInvalidation(nextLayerId);
      }
      continue;
    }

    if (prevLayerId === nextLayerId) {
      addShapeChange(prevLayerId, {
        shapeId: id,
        prevBounds,
        nextBounds,
      });
      continue;
    }

    addShapeChange(prevLayerId, {
      shapeId: id,
      prevBounds,
      nextBounds: null,
    });
    addShapeChange(nextLayerId, {
      shapeId: id,
      prevBounds: null,
      nextBounds,
    });
  }

  if (shapeChangesByLayer.size > 0) {
    layerStack.routeDirtyShapeRegions(shapeChangesByLayer);
  }
  if (regionFallbackByLayer.size > 0) {
    layerStack.routeDirtyRegions(regionFallbackByLayer);
  }
}

function tryGetShapeBounds(
  shape: AnyShape,
  shapeHandlers: ShapeHandlerRegistry,
): Box | null {
  try {
    return getShapeBounds(shape, shapeHandlers);
  } catch {
    return null;
  }
}
