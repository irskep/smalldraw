import {
  DrawingStore,
  createPenTool,
  createRectangleTool,
  createSelectionTool,
  getShapeBounds,
  getOrderedShapes,
  type Bounds,
  type DrawingDocument,
  type Point,
  type Shape,
  type ToolDefinition,
  type ToolPointerEvent,
} from '@smalldraw/core';
import {
  createStage,
  renderDocument,
  type Viewport,
} from '@smalldraw/renderer-konva';

const DEFAULT_COLORS = ['#000000', '#ffffff', '#ff4b4b', '#1a73e8', '#ffcc00', '#00c16a', '#9c27b0'];
const HANDLE_SIZE = 8;
const HANDLE_HIT_PADDING = 6;

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
  const store = new DrawingStore({ tools });
  store.activateTool('selection');

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

  options.container.appendChild(root);

  const viewport: Viewport = {
    width,
    height,
    scale: 1,
    center: { x: width / 2, y: height / 2 },
    backgroundColor: options.backgroundColor ?? '#ffffff',
  };
  const stage = createStage({ container: stageContainer, width, height });

  const toolButtons = setupToolButtons(toolbar, store, availableToolIds, () => renderAll());
  const strokeSwatches = createColorRow('Stroke', palette, (color) => {
    store.updateSharedSettings({ strokeColor: color });
    renderAll();
  });
  strokeSwatches.row.dataset.role = 'stroke-swatches';
  toolbar.appendChild(strokeSwatches.row);

  const fillSwatches = createColorRow('Fill', palette, (color) => {
    store.updateSharedSettings({ fillColor: color });
    renderAll();
  });
  fillSwatches.row.dataset.role = 'fill-swatches';
  toolbar.appendChild(fillSwatches.row);

  const undoButton = document.createElement('button');
  undoButton.type = 'button';
  undoButton.textContent = 'Undo';
  undoButton.dataset.action = 'undo';
  undoButton.addEventListener('click', () => {
    if (store.undo()) {
      renderAll();
    }
  });
  const redoButton = document.createElement('button');
  redoButton.type = 'button';
  redoButton.textContent = 'Redo';
  redoButton.dataset.action = 'redo';
  redoButton.addEventListener('click', () => {
    if (store.redo()) {
      renderAll();
    }
  });
  toolbar.appendChild(undoButton);
  toolbar.appendChild(redoButton);

  const pointerHandlers = createPointerHandlers(store, overlay, () => renderAll());

  function renderAll() {
    const live = buildLiveDocument(store);
    renderDocument(stage, live, { viewport });
    renderSelectionOverlay(selectionLayer, store);
    syncToolButtons(toolButtons, store.getActiveToolId());
    syncSwatches(strokeSwatches.buttons, store.getSharedSettings().strokeColor);
    syncSwatches(fillSwatches.buttons, store.getSharedSettings().fillColor ?? '#000000');
    undoButton.disabled = !store.canUndo();
    redoButton.disabled = !store.canRedo();
    updateCursor(overlay, store);
  }

  renderAll();

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
  onChange: () => void,
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
      onChange();
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
  onChange: () => void,
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
    if (activeTool === 'selection') {
      const handleId = hitTestHandles(point, store);
      if (handleId) {
        payload.handleId = handleId;
      } else {
        updateSelectionForPoint(point, event.shiftKey, store);
      }
    }
    try {
      overlay.setPointerCapture?.(event.pointerId ?? 0);
    } catch {
      // Pointer capture can fail with synthetic events or if pointer was released
    }
    store.dispatch('pointerDown', payload);
    onChange();
  }

  function handlePointerMove(event: PointerEvent) {
    const point = getPointerPoint(event, overlay);
    const payload = buildToolEvent(event, point);
    if (store.getActiveToolId() === 'selection') {
      payload.handleId = hitTestHandles(point, store);
    }
    store.dispatch('pointerMove', payload);
    onChange();
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
    onChange();
  }

  function handlePointerCancel(event: PointerEvent) {
    const point = getPointerPoint(event, overlay);
    const payload = buildToolEvent(event, point, 0);
    store.dispatch('pointerCancel', payload);
    onChange();
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

function renderSelectionOverlay(layer: HTMLElement, store: DrawingStore) {
  layer.innerHTML = '';
  const bounds = store.getSelectionFrame() ?? computeSelectionBounds(store);
  if (!bounds) {
    return;
  }
  const frame = document.createElement('div');
  Object.assign(frame.style, {
    position: 'absolute',
    left: `${bounds.minX}px`,
    top: `${bounds.minY}px`,
    width: `${bounds.width}px`,
    height: `${bounds.height}px`,
    border: '1px dashed #4a90e2',
    background: 'rgba(74, 144, 226, 0.05)',
  });
  layer.appendChild(frame);
  const handles = store.getHandles();
  const handlePositions = handles.map((handle) => ({
    id: handle.id,
    point: resolveHandlePoint(bounds, handle),
  }));
  for (const { id, point } of handlePositions) {
    const handleEl = document.createElement('div');
    handleEl.dataset.handle = id;
    Object.assign(handleEl.style, {
      position: 'absolute',
      width: `${HANDLE_SIZE}px`,
      height: `${HANDLE_SIZE}px`,
      background: '#ffffff',
      border: '1px solid #4a90e2',
      left: `${point.x - HANDLE_SIZE / 2}px`,
      top: `${point.y - HANDLE_SIZE / 2}px`,
    });
    layer.appendChild(handleEl);
  }
}

function computeSelectionBounds(store: DrawingStore): Bounds | null {
  const selection = store.getSelection();
  const ids = Array.from(selection.ids);
  if (!ids.length) {
    return null;
  }
  const doc = store.getDocument();
  let result: Bounds | null = null;
  for (const id of ids) {
    const shape = doc.shapes[id];
    if (!shape) continue;
    const bounds = getShapeBounds(shape);
    result = result ? mergeBounds(result, bounds) : bounds;
  }
  return result;
}

function resolveHandlePoint(bounds: Bounds, handle: { position: { u: number; v: number } }): Point {
  return {
    x: bounds.minX + bounds.width * handle.position.u,
    y: bounds.minY + bounds.height * handle.position.v,
  };
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
  for (const handle of store.getHandles()) {
    const handlePoint = resolveHandlePoint(bounds, handle);
    if (distance(handlePoint, point) <= HANDLE_SIZE / 2 + HANDLE_HIT_PADDING) {
      return handle.id;
    }
  }
  return undefined;
}

function updateSelectionForPoint(point: Point, additive: boolean, store: DrawingStore) {
  const hit = hitTestShapes(point, store);
  if (hit) {
    if (additive) {
      store.toggleSelection(hit.id);
    } else {
      store.setSelection([hit.id], hit.id);
    }
    return;
  }
  if (!additive) {
    store.clearSelection();
  }
}

function hitTestShapes(point: Point, store: DrawingStore): Shape | null {
  const doc = store.getDocument();
  const ordered = getOrderedShapes(doc);
  for (let i = ordered.length - 1; i >= 0; i -= 1) {
    const shape = ordered[i];
    const bounds = getShapeBounds(shape);
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
