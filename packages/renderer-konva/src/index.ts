export type {
  CreateStageOptions,
  ReconcileDocumentOptions,
  RenderDocumentOptions,
} from "./document.js";
export {
  createStage,
  ensureRendererLayer,
  reconcileDocument,
  renderDocument,
} from "./document.js";
export { KonvaReconciler } from "./reconciler.js";
export type { ShapeRenderer, ShapeRendererRegistry } from "./shapes.js";
export {
  createShapeRendererRegistry,
  defaultShapeRendererRegistry,
  renderShapeNode,
} from "./shapes.js";
export type { StrokePathOptions, StrokePolygonResult } from "./stroke.js";
export {
  createFreehandStroke,
  flattenOutline,
  outlineToPath,
} from "./stroke.js";
export type { Viewport } from "./viewport.js";
export { applyViewportToStage, DEFAULT_BACKGROUND_COLOR } from "./viewport.js";
