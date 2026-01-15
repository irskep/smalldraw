import type { DrawingDocument } from '@smalldraw/core';
import { getOrderedShapes } from '@smalldraw/core';
import Konva from 'konva';
import type { Layer } from 'konva/lib/Layer.js';
import type { Stage, StageConfig } from 'konva/lib/Stage.js';

import {
  defaultShapeRendererRegistry,
  renderShapeNode,
  type ShapeRendererRegistry,
} from './shapes.js';
import { applyViewportToStage, DEFAULT_BACKGROUND_COLOR, type Viewport } from './viewport.js';

const DEFAULT_LAYER_ID = 'smalldraw-layer';

export interface RenderDocumentOptions {
  layerId?: string;
  clear?: boolean;
  registry?: ShapeRendererRegistry;
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
  const layer = ensureRendererLayer(stage, options?.layerId ?? DEFAULT_LAYER_ID);
  if (options?.viewport) {
    applyViewportToStage(stage, layer, options.viewport);
  }
  const shouldClear = options?.clear !== false;
  if (shouldClear) {
    layer.destroyChildren();
  }
  fillBackground(layer, options);
  const registry = options?.registry ?? defaultShapeRendererRegistry;
  const orderedShapes = getOrderedShapes(document);
  let zIndex = 0;
  for (const shape of orderedShapes) {
    const node = renderShapeNode(shape, registry);
    if (!node) continue;
    layer.add(node);
    node.zIndex(zIndex);
    zIndex += 1;
  }
  layer.draw();
  return layer;
}

export function ensureRendererLayer(stage: Stage, layerId: string = DEFAULT_LAYER_ID): Layer {
  const existing = stage.findOne<Layer>(`#${layerId}`);
  if (existing) {
    return existing;
  }
  const layer = new Konva.Layer({ id: layerId, name: 'smalldraw-layer' });
  stage.add(layer);
  return layer;
}

function fillBackground(layer: Layer, options?: RenderDocumentOptions): void {
  const stage = layer.getStage();
  if (!stage) return;
  const color = options?.backgroundColor ?? options?.viewport?.backgroundColor ?? DEFAULT_BACKGROUND_COLOR;
  layer.clearBeforeDraw(false);
  layer.off('.smalldraw-background');
  layer.on('beforeDraw.smalldraw-background', () => {
    const ctx = layer.getCanvas().getContext();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, stage.width(), stage.height());
    ctx.setAttr('fillStyle', color);
    ctx.fillRect(0, 0, stage.width(), stage.height());
    ctx.restore();
    layer.getHitCanvas().getContext().clear();
  });
}
