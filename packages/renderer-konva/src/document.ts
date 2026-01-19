import type {
  DirtyState,
  DrawingDocument,
  ShapeHandlerRegistry,
  Shape,
} from "@smalldraw/core";
import { getOrderedShapes } from "@smalldraw/core";
import Konva from "konva";
import type { Layer } from "konva/lib/Layer.js";
import type { Stage, StageConfig } from "konva/lib/Stage.js";

import { KonvaReconciler } from "./reconciler.js";
import {
  defaultShapeRendererRegistry,
  renderShapeNode,
  type ShapeRendererRegistry,
} from "./shapes.js";
import {
  applyViewportToStage,
  DEFAULT_BACKGROUND_COLOR,
  type Viewport,
} from "./viewport.js";

const DEFAULT_LAYER_ID = "smalldraw-layer";

export interface RenderDocumentOptions {
  layerId?: string;
  clear?: boolean;
  registry?: ShapeRendererRegistry;
  geometryHandlerRegistry?: ShapeHandlerRegistry;
  viewport?: Viewport;
  backgroundColor?: string;
}

export interface CreateStageOptions extends StageConfig {}

export function createStage(options: CreateStageOptions): Stage {
  return new Konva.Stage(options);
}

export function renderDocument(
  stage: Stage,
  document: DrawingDocument,
  options?: RenderDocumentOptions,
): Layer {
  const layer = ensureRendererLayer(
    stage,
    options?.layerId ?? DEFAULT_LAYER_ID,
  );
  if (options?.viewport) {
    applyViewportToStage(stage, layer, options.viewport);
  }
  const shouldClear = options?.clear !== false;
  if (shouldClear) {
    layer.destroyChildren();
  }
  fillBackground(layer, options);
  const registry = options?.registry ?? defaultShapeRendererRegistry;
  const geometryHandlerRegistry = options?.geometryHandlerRegistry;
  const orderedShapes = getOrderedShapes(document);
  let zIndex = 1; // Start at 1 to keep shapes above background rect
  for (const shape of orderedShapes) {
    const node = renderShapeNode(shape, registry, geometryHandlerRegistry);
    if (!node) continue;
    layer.add(node);
    node.zIndex(zIndex);
    zIndex += 1;
  }
  layer.draw();
  return layer;
}

export function ensureRendererLayer(
  stage: Stage,
  layerId: string = DEFAULT_LAYER_ID,
): Layer {
  const existing = stage.findOne<Layer>(`#${layerId}`);
  if (existing) {
    return existing;
  }
  const layer = new Konva.Layer({ id: layerId, name: "smalldraw-layer" });
  stage.add(layer);
  return layer;
}

function fillBackground(layer: Layer, options?: RenderDocumentOptions): void {
  const stage = layer.getStage();
  if (!stage) return;
  const color =
    options?.backgroundColor ??
    options?.viewport?.backgroundColor ??
    DEFAULT_BACKGROUND_COLOR;
  const bgRect = new Konva.Rect({
    x: 0,
    y: 0,
    width: stage.width(),
    height: stage.height(),
    fill: color,
    listening: false,
  });
  layer.add(bgRect);
  bgRect.moveToBottom();
}

export interface ReconcileDocumentOptions {
  layerId?: string;
  registry?: ShapeRendererRegistry;
  geometryHandlerRegistry?: ShapeHandlerRegistry;
  viewport?: Viewport;
  backgroundColor?: string;
}

/**
 * Incrementally render a document using dirty tracking.
 * Only shapes in the dirty set are updated; deleted shapes are removed.
 * This is more efficient than full re-render for small changes.
 *
 * @param stage - The Konva stage
 * @param reconciler - The reconciler instance (maintains node cache)
 * @param shapes - All shapes to render (in z-order)
 * @param dirtyState - The dirty/deleted state from the store
 * @param options - Rendering options
 */
export function reconcileDocument(
  stage: Stage,
  reconciler: KonvaReconciler,
  shapes: Shape[],
  dirtyState: DirtyState,
  options?: ReconcileDocumentOptions,
): Layer {
  const layer = ensureRendererLayer(
    stage,
    options?.layerId ?? DEFAULT_LAYER_ID,
  );
  if (options?.viewport) {
    applyViewportToStage(stage, layer, options.viewport);
  }

  // Ensure background exists (only on first call or if cleared)
  ensureBackground(layer, options);

  // Reconcile shapes
  reconciler.reconcile(layer, shapes, dirtyState.dirty, dirtyState.deleted);

  layer.batchDraw();
  return layer;
}

/**
 * Ensure background rect exists and is at the bottom.
 * Unlike fillBackground, this doesn't recreate it every time.
 */
function ensureBackground(
  layer: Layer,
  options?: ReconcileDocumentOptions,
): void {
  const stage = layer.getStage();
  if (!stage) return;

  const existingBg = layer.findOne<Konva.Rect>(".smalldraw-background");
  if (existingBg) {
    // Update size if stage changed
    existingBg.width(stage.width());
    existingBg.height(stage.height());
    existingBg.moveToBottom();
    return;
  }

  const color =
    options?.backgroundColor ??
    options?.viewport?.backgroundColor ??
    DEFAULT_BACKGROUND_COLOR;
  const bgRect = new Konva.Rect({
    name: "smalldraw-background",
    x: 0,
    y: 0,
    width: stage.width(),
    height: stage.height(),
    fill: color,
    listening: false,
  });
  layer.add(bgRect);
  bgRect.moveToBottom();
}
