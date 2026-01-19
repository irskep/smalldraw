import {
  DrawingStore,
  createPenTool,
  createRectangleTool,
  createSelectionTool,
  getShapeBounds,
  applyTransformToPoint,
  getOrderedShapes,
  type Bounds,
  type DrawingDocument,
  type HandleDescriptor,
  type Point,
  type RectGeometry,
  type Shape,
  type ToolDefinition,
  type ToolPointerEvent,
} from '@smalldraw/core';
import {
  createStage,
  reconcileDocument,
  KonvaReconciler,
  type Viewport,
} from '@smalldraw/renderer-konva';
import { SelectionOverlay } from './selectionOverlay.js';

const DEFAULT_COLORS = ['#000000', '#ffffff', '#ff4b4b', '#1a73e8', '#ffcc00', '#00c16a', '#9c27b0'];
const HANDLE_SIZE = 8;
const HANDLE_HIT_PADDING = 6;
const AXIS_HANDLE_IDS = new Set(['mid-left', 'mid-right', 'mid-top', 'mid-bottom']);

export interface VanillaDrawingAppOptions {
  container: HTMLElement;
  width?: number;
  height?: number;
  backgroundColor?: string;
  palette?: string[];
  tools?: ToolDefinition[];
}

export interface VanillaDrawingApp {
  root: HTMLElement;
  store: DrawingStore;
  resize(width: number, height: number): void;
  destroy(): void;
}

interface SwatchGroup {
  row: HTMLDivElement;
  buttons: HTMLButtonElement[];
}

export function createVanillaDrawingApp(options: VanillaDrawingAppOptions): VanillaDrawingApp {
  if (!options?.container) {
    throw new Error('container is required');
  }
  const width = options.width ?? 800;
  const height = options.height ?? 600;
  const palette = (options.palette?.length ? options.palette : DEFAULT_COLORS).slice();
  const baseTools = options.tools ?? [createSelectionTool(), createRectangleTool(), createPenTool()];
  const tools = ensureSelectionTool(baseTools);
  const availableToolIds = new Set(tools.map((tool) => tool.id));

  const root = document.createElement('div');
  root.className = 'smalldraw-app';
  Object.assign(root.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '14px',
    color: '#111111',
    maxWidth: `${width}px`,
  });

  const toolbar = document.createElement('div');
  toolbar.className = 'smalldraw-toolbar';
  Object.assign(toolbar.style, {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    alignItems: 'center',
  });
  root.appendChild(toolbar);

  const canvasWrapper = document.createElement('div');
  canvasWrapper.className = 'smalldraw-canvas-wrapper';
  Object.assign(canvasWrapper.style, {
    position: 'relative',
    width: `${width}px`,
    height: `${height}px`,
    border: '1px solid #d0d0d0',
    background: '#fdfdfd',
  });
  root.appendChild(canvasWrapper);

  const stageContainer = document.createElement('div');
  stageContainer.className = 'smalldraw-stage';
  Object.assign(stageContainer.style, {
    width: '100%',
    height: '100%',
  });
  canvasWrapper.appendChild(stageContainer);

  const overlay = document.createElement('div');
  overlay.className = 'smalldraw-overlay';
  Object.assign(overlay.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    right: '0',
    bottom: '0',
    cursor: 'default',
    touchAction: 'none',
  });
  canvasWrapper.appendChild(overlay);

  const selectionLayer = document.createElement('div');
  selectionLayer.className = 'smalldraw-selection-layer';
  Object.assign(selectionLayer.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    right: '0',
    bottom: '0',
    pointerEvents: 'none',
  });
  overlay.appendChild(selectionLayer);

  // Create SelectionOverlay for incremental DOM updates
  const selectionOverlay = new SelectionOverlay(selectionLayer);

  options.container.appendChild(root);

  const viewport: Viewport = {
    width,
    height,
    scale: 1,
    center: { x: width / 2, y: height / 2 },
    backgroundColor: options.backgroundColor ?? '#ffffff',
  };
  const stage = createStage({ container: stageContainer, width, height });
  const reconciler = new KonvaReconciler();

  // Will be populated after store is created
  let toolButtons: Map<string, HTMLButtonElement>;
  let strokeSwatches: SwatchGroup;
  let fillSwatches: SwatchGroup;
  let undoButton: HTMLButtonElement;
  let redoButton: HTMLButtonElement;

  function renderAll() {
    const { shapes, dirtyState } = store.getRenderState();
    reconcileDocument(stage, reconciler, shapes, dirtyState, { viewport });
    updateSelectionOverlay(selectionOverlay, store);
    syncToolButtons(toolButtons, store.getActiveToolId());
    syncSwatches(strokeSwatches.buttons, store.getSharedSettings().strokeColor);
    syncSwatches(fillSwatches.buttons, store.getSharedSettings().fillColor ?? '#000000');
    undoButton.disabled = !store.canUndo();
    redoButton.disabled = !store.canRedo();
    updateCursor(overlay, store);
  }

  // Create store with render callback
  const store = new DrawingStore({ tools, onRenderNeeded: renderAll });

  // Setup UI controls
  toolButtons = setupToolButtons(toolbar, store, availableToolIds);

  strokeSwatches = createColorRow('Stroke', palette, (color) => {
    store.updateSharedSettings({ strokeColor: color });
  });
  strokeSwatches.row.dataset.role = 'stroke-swatches';
  toolbar.appendChild(strokeSwatches.row);

  fillSwatches = createColorRow('Fill', palette, (color) => {
    store.updateSharedSettings({ fillColor: color });
  });
  fillSwatches.row.dataset.role = 'fill-swatches';
  toolbar.appendChild(fillSwatches.row);

  undoButton = document.createElement('button');
  undoButton.type = 'button';
  undoButton.textContent = 'Undo';
  undoButton.dataset.action = 'undo';
  undoButton.addEventListener('click', () => {
    store.undo();
  });

  redoButton = document.createElement('button');
  redoButton.type = 'button';
  redoButton.textContent = 'Redo';
  redoButton.dataset.action = 'redo';
  redoButton.addEventListener('click', () => {
    store.redo();
  });
  toolbar.appendChild(undoButton);
  toolbar.appendChild(redoButton);

  const pointerHandlers = createPointerHandlers(store, overlay);

  // Activate default tool and render initial state
  store.activateTool('selection');

  function resize(nextWidth: number, nextHeight: number) {
    viewport.width = nextWidth;
    viewport.height = nextHeight;
    viewport.center = { x: nextWidth / 2, y: nextHeight / 2 };
    stage.width(nextWidth);
    stage.height(nextHeight);
    canvasWrapper.style.width = `${nextWidth}px`;
    canvasWrapper.style.height = `${nextHeight}px`;
    root.style.maxWidth = `${nextWidth}px`;
    renderAll();
  }

  function destroy() {
    overlay.removeEventListener('pointerdown', pointerHandlers.down);
    overlay.removeEventListener('pointermove', pointerHandlers.move);
    overlay.removeEventListener('pointerup', pointerHandlers.up);
    overlay.removeEventListener('pointercancel', pointerHandlers.cancel);
    overlay.removeEventListener('pointerleave', pointerHandlers.cancel);
    reconciler.clear();
    stage.destroy();
    root.remove();
  }

  return {
    root,
    store,
    resize,
    destroy,
  };
}

function ensureSelectionTool(tools: ToolDefinition[]): ToolDefinition[] {
  const hasSelection = tools.some((tool) => tool.id === 'selection');
  if (hasSelection) {
    return tools;
  }
  return [createSelectionTool(), ...tools];
}

function setupToolButtons(
  toolbar: HTMLElement,
  store: DrawingStore,
  availableToolIds: Set<string>,
): Map<string, HTMLButtonElement> {
  const config = [
    { id: 'selection', label: 'Select' },
    { id: 'rect', label: 'Rect' },
    { id: 'pen', label: 'Pen' },
  ];
  const buttons = new Map<string, HTMLButtonElement>();
  for (const tool of config) {
    if (!availableToolIds.has(tool.id)) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = tool.label;
    button.dataset.tool = tool.id;
    button.addEventListener('click', () => {
      store.activateTool(tool.id);
    });
    toolbar.appendChild(button);
    buttons.set(tool.id, button);
  }
  return buttons;
}

function syncToolButtons(
  buttons: Map<string, HTMLButtonElement>,
  activeId: string | null,
): void {
  buttons.forEach((button, id) => {
    if (id === activeId) {
      button.disabled = true;
      button.style.fontWeight = '600';
    } else {
      button.disabled = false;
      button.style.fontWeight = '400';
    }
  });
}

function createColorRow(
  label: string,
  palette: string[],
  onSelect: (color: string) => void,
): SwatchGroup {
  const row = document.createElement('div');
  Object.assign(row.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  });
  const labelEl = document.createElement('span');
  labelEl.textContent = label;
  row.appendChild(labelEl);
  const buttons: HTMLButtonElement[] = [];
  palette.forEach((color) => {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.dataset.color = color;
    Object.assign(swatch.style, {
      width: '20px',
      height: '20px',
      border: '1px solid #bbbbbb',
      background: color,
      padding: '0',
    });
    swatch.addEventListener('click', () => onSelect(color));
    row.appendChild(swatch);
    buttons.push(swatch);
  });
  return { row, buttons };
}

function syncSwatches(buttons: HTMLButtonElement[], activeColor: string) {
  buttons.forEach((button) => {
    if (button.dataset.color?.toLowerCase() === activeColor?.toLowerCase()) {
      button.style.outline = '2px solid #333333';
    } else {
      button.style.outline = 'none';
    }
  });
}

function createPointerHandlers(
  store: DrawingStore,
  overlay: HTMLElement,
) {
  const handlers = {
    down: handlePointerDown,
    move: handlePointerMove,
    up: handlePointerUp,
    cancel: handlePointerCancel,
  } as const;
  overlay.addEventListener('pointerdown', handlePointerDown);
  overlay.addEventListener('pointermove', handlePointerMove);
  overlay.addEventListener('pointerup', handlePointerUp);
  overlay.addEventListener('pointercancel', handlePointerCancel);
  overlay.addEventListener('pointerleave', handlePointerCancel);

  function handlePointerDown(event: PointerEvent) {
    event.preventDefault();
    const point = getPointerPoint(event, overlay);
    const payload = buildToolEvent(event, point);
    const activeTool = store.getActiveToolId();
    const selectionBefore = store.getSelection();
    console.log('[pointerDown] START', {
      point,
      activeTool,
      shiftKey: event.shiftKey,
      selectionBefore: { ids: Array.from(selectionBefore.ids), primaryId: selectionBefore.primaryId }
    });
    if (activeTool === 'selection') {
      const handleId = hitTestHandles(point, store);
      console.log('[pointerDown] hitTestHandles result:', handleId);
      if (handleId) {
        payload.handleId = handleId;
      } else {
        console.log('[pointerDown] calling updateSelectionForPoint');
        updateSelectionForPoint(point, event.shiftKey, store);
        const selectionAfter = store.getSelection();
        console.log('[pointerDown] selection after updateSelectionForPoint:', {
          ids: Array.from(selectionAfter.ids),
          primaryId: selectionAfter.primaryId
        });
      }
    }
    try {
      overlay.setPointerCapture?.(event.pointerId ?? 0);
    } catch {
      // Pointer capture can fail with synthetic events or if pointer was released
    }
    console.log('[pointerDown] dispatching to tool with payload:', payload);
    store.dispatch('pointerDown', payload);
    console.log('[pointerDown] END');
  }

  function handlePointerMove(event: PointerEvent) {
    const point = getPointerPoint(event, overlay);
    const payload = buildToolEvent(event, point);
    if (store.getActiveToolId() === 'selection') {
      payload.handleId = hitTestHandles(point, store);
    }
    store.dispatch('pointerMove', payload);
  }

  function handlePointerUp(event: PointerEvent) {
    const point = getPointerPoint(event, overlay);
    const payload = buildToolEvent(event, point, 0);
    payload.handleId = undefined;
    try {
      overlay.releasePointerCapture?.(event.pointerId ?? 0);
    } catch {
      // Release can fail if pointer was never captured or already released
    }
    store.dispatch('pointerUp', payload);
  }

  function handlePointerCancel(event: PointerEvent) {
    const point = getPointerPoint(event, overlay);
    const payload = buildToolEvent(event, point, 0);
    store.dispatch('pointerCancel', payload);
  }

  return handlers;
}

function buildToolEvent(
  event: PointerEvent,
  point: Point,
  buttonsOverride?: number,
): ToolPointerEvent {
  return {
    point,
    buttons: buttonsOverride ?? event.buttons ?? (event.type === 'pointerup' ? 0 : 1),
    pressure: typeof event.pressure === 'number' ? event.pressure : undefined,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
  };
}

function getPointerPoint(event: PointerEvent, overlay: HTMLElement): Point {
  const rect = overlay.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function buildLiveDocument(store: DrawingStore): DrawingDocument {
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
 * Update the selection overlay with incremental DOM updates.
 * Uses SelectionOverlay class to avoid rebuilding the entire DOM each frame.
 */
function updateSelectionOverlay(overlay: SelectionOverlay, store: DrawingStore): void {
  const bounds = store.getSelectionFrame() ?? computeSelectionBounds(store);
  const showAxisHandles = canShowAxisHandles(store);
  const handles = store
    .getHandles()
    .filter((handle: HandleDescriptor) => showAxisHandles || handle.behavior?.type !== 'resize-axis');
  const liveDoc = buildLiveDocument(store);
  const selection = store.getSelection();
  const selectedId = selection.ids.size
    ? Array.from(selection.ids)[0]
    : selection.primaryId;
  const selectedShape = selectedId ? liveDoc.shapes[selectedId] : undefined;
  overlay.update(bounds, handles, selectedShape);
}

function computeSelectionBounds(store: DrawingStore): Bounds | null {
  const selection = store.getSelection();
  const ids = Array.from(selection.ids);
  if (!ids.length) {
    return null;
  }
  const doc = store.getDocument();
  let result: Bounds | null = null;
  const registry = store.getShapeHandlers();
  for (const id of ids) {
    const shape = doc.shapes[id];
    if (!shape) continue;
    const bounds = getShapeBounds(shape, registry);
    result = result ? mergeBounds(result, bounds) : bounds;
  }
  return result;
}

function canShowAxisHandles(store: DrawingStore): boolean {
  const selection = store.getSelection();
  const ids = Array.from(selection.ids);
  if (ids.length !== 1) {
    return false;
  }
  const liveDoc = buildLiveDocument(store);
  const shape = liveDoc.shapes[ids[0]];
  return shape?.geometry.type === 'rect';
}

function resolveHandlePoint(
  bounds: Bounds,
  handle: { id: string; position: { u: number; v: number }; behavior?: { type?: string; axis?: string } },
  shape?: Shape,
): Point {
  if (handle.behavior?.type === 'resize-axis' && shape?.geometry.type === 'rect') {
    const point = resolveAxisHandlePoint(handle.id, shape);
    if (point) return point;
  }
  return {
    x: bounds.minX + bounds.width * handle.position.u,
    y: bounds.minY + bounds.height * handle.position.v,
  };
}

function resolveAxisHandlePoint(handleId: string, shape: Shape): Point | null {
  if (shape.geometry.type !== 'rect') return null;
  const rectGeometry = shape.geometry as RectGeometry;
  const halfWidth = rectGeometry.size.width / 2;
  const halfHeight = rectGeometry.size.height / 2;
  let local: Point | null = null;
  switch (handleId) {
    case 'mid-right':
      local = { x: halfWidth, y: 0 };
      break;
    case 'mid-left':
      local = { x: -halfWidth, y: 0 };
      break;
    case 'mid-top':
      local = { x: 0, y: -halfHeight };
      break;
    case 'mid-bottom':
      local = { x: 0, y: halfHeight };
      break;
    default:
      return null;
  }
  const world = applyTransformToPoint(local, shape.transform);
  return world;
}

function mergeBounds(a: Bounds, b: Bounds): Bounds {
  const minX = Math.min(a.minX, b.minX);
  const minY = Math.min(a.minY, b.minY);
  const maxX = Math.max(a.maxX, b.maxX);
  const maxY = Math.max(a.maxY, b.maxY);
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function hitTestHandles(point: Point, store: DrawingStore): string | undefined {
  const bounds = store.getSelectionFrame() ?? computeSelectionBounds(store);
  if (!bounds) return undefined;
  const liveDoc = buildLiveDocument(store);
  const selection = store.getSelection();
  const selectedId = selection.ids.size
    ? Array.from(selection.ids)[0]
    : selection.primaryId;
  const selectedShape = selectedId ? liveDoc.shapes[selectedId] : undefined;
  const showAxisHandles = canShowAxisHandles(store);
  for (const handle of store
    .getHandles()
    .filter((descriptor) => showAxisHandles || descriptor.behavior?.type !== 'resize-axis')) {
    const handlePoint = resolveHandlePoint(bounds, handle, selectedShape);
    const hitSize =
      handle.behavior?.type === 'resize-axis'
        ? Math.max(12, HANDLE_SIZE)
        : HANDLE_SIZE;
    if (distance(handlePoint, point) <= hitSize / 2 + HANDLE_HIT_PADDING) {
      return handle.id;
    }
  }
  return undefined;
}

function updateSelectionForPoint(point: Point, additive: boolean, store: DrawingStore) {
  const selection = store.getSelection();
  console.log('[updateSelectionForPoint] START', {
    point,
    additive,
    selectionIds: Array.from(selection.ids),
    selectionSize: selection.ids.size
  });

  // If clicking within current selection bounds, don't change selection (allow drag)
  if (selection.ids.size > 0 && !additive) {
    const inBounds = isPointInSelectionBounds(point, store);
    console.log('[updateSelectionForPoint] checking if in selection bounds:', inBounds);
    if (inBounds) {
      console.log('[updateSelectionForPoint] EARLY RETURN - point is in selection bounds');
      return;
    }
  }

  const hit = hitTestShapes(point, store);
  console.log('[updateSelectionForPoint] hitTestShapes result:', hit?.id ?? null);
  if (hit) {
    if (additive) {
      console.log('[updateSelectionForPoint] toggling selection for:', hit.id);
      store.toggleSelection(hit.id);
    } else {
      console.log('[updateSelectionForPoint] setting selection to:', hit.id);
      store.setSelection([hit.id], hit.id);
    }
    return;
  }
  if (!additive) {
    console.log('[updateSelectionForPoint] clearing selection (clicked empty space)');
    store.clearSelection();
  }
}

function isPointInSelectionBounds(point: Point, store: DrawingStore): boolean {
  const selection = store.getSelection();
  const ids = Array.from(selection.ids);
  console.log('[isPointInSelectionBounds] checking point', point, 'against selection ids:', ids);
  if (!ids.length) {
    console.log('[isPointInSelectionBounds] no selection, returning false');
    return false;
  }

  const doc = store.getDocument();
  const registry = store.getShapeHandlers();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const id of ids) {
    const shape = doc.shapes[id];
    if (!shape) {
      console.log('[isPointInSelectionBounds] shape not found:', id);
      continue;
    }
    const bounds = getShapeBounds(shape, registry);
    console.log('[isPointInSelectionBounds] shape', id, 'bounds:', bounds);
    minX = Math.min(minX, bounds.minX);
    minY = Math.min(minY, bounds.minY);
    maxX = Math.max(maxX, bounds.maxX);
    maxY = Math.max(maxY, bounds.maxY);
  }

  const selectionBounds = { minX, minY, maxX, maxY };
  const isInside = point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
  console.log('[isPointInSelectionBounds] selection bounds:', selectionBounds, 'point:', point, 'isInside:', isInside);
  return isInside;
}

function hitTestShapes(point: Point, store: DrawingStore): Shape | null {
  const doc = store.getDocument();
  const ordered = getOrderedShapes(doc);
  const registry = store.getShapeHandlers();
  for (let i = ordered.length - 1; i >= 0; i -= 1) {
    const shape = ordered[i];
    const bounds = getShapeBounds(shape, registry);
    if (point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY) {
      return shape;
    }
  }
  return null;
}

function distance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function updateCursor(overlay: HTMLElement, store: DrawingStore) {
  const hover = store.getHandleHover();
  if (hover.handleId) {
    overlay.style.cursor = cursorForHandle(hover.handleId, hover.behavior?.type);
    return;
  }
  const active = store.getActiveToolId();
  overlay.style.cursor = active === 'pen' || active === 'rect' ? 'crosshair' : 'default';
}

function cursorForHandle(handleId: string, behaviorType?: string | null): string {
  if (behaviorType === 'rotate' || handleId === 'rotate') {
    return 'alias';
  }
  if (behaviorType === 'resize-axis') {
    switch (handleId) {
      case 'mid-left':
      case 'mid-right':
        return 'ew-resize';
      case 'mid-top':
      case 'mid-bottom':
        return 'ns-resize';
      default:
        return 'pointer';
    }
  }
  switch (handleId) {
    case 'top-left':
    case 'bottom-right':
      return 'nwse-resize';
    case 'top-right':
    case 'bottom-left':
      return 'nesw-resize';
    default:
      return behaviorType === 'move' ? 'move' : 'pointer';
  }
}
