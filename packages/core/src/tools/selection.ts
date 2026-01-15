import { CompositeAction, UpdateShapeGeometry, UpdateShapeTransform } from '../actions';
import type { UndoableAction } from '../actions';
import { createBoundsFromPoints, getBoundsCenter, getShapeBounds } from '../model/geometryBounds';
import type {
  Geometry,
  RectGeometry,
  EllipseGeometry,
  RegularPolygonGeometry,
  PenGeometry,
} from '../model/geometry';
import type { Bounds, Point } from '../model/primitives';
import type { CanonicalShapeTransform, Shape } from '../model/shape';
import { normalizeShapeTransform } from '../model/shape';
import { attachPointerHandlers } from './pointerHandlers';
import type {
  HandleBehavior,
  HandleDescriptor,
  ToolDefinition,
  ToolEventHandler,
  ToolPointerEvent,
  ToolRuntime,
} from './types';

const runtimeState = new WeakMap<ToolRuntime, SelectionToolState>();

export const RESIZABLE_GEOMETRY_TYPES = ['rect', 'ellipse', 'regularPolygon', 'pen'] as const;

const RESIZE_ADAPTERS: SelectionResizeAdapter[] = [
  createRectangleResizeAdapter(),
  createEllipseResizeAdapter(),
  createRegularPolygonResizeAdapter(),
  createPenResizeAdapter(),
];

interface SelectionToolState {
  drag?: DragState;
  disposers: Array<() => void>;
}

interface DragState {
  mode: 'move' | 'resize' | 'resize-proportional' | 'rotate';
  selectionIds: string[];
  startPoint: Point;
  lastPoint: Point;
  transforms: Map<string, CanonicalShapeTransform>;
  layouts: Map<string, NormalizedLayout>;
  selectionBounds?: Bounds;
  oppositeCorner?: Point;
  center?: Point;
  resizeEntries: Map<string, ShapeResizeEntry>;
  shapeBounds: Map<string, Bounds>;
}

type SelectionBounds = Bounds;

interface SelectionBoundsResult {
  bounds?: Bounds;
  shapeBounds: Map<string, Bounds>;
}

interface NormalizedLayout {
  offsetU: number;
  offsetV: number;
}

interface SelectionResizeResult {
  geometry?: Geometry;
  translation?: Point;
  transform?: CanonicalShapeTransform;
}

interface SelectionResizeSnapshot<TGeometry extends Geometry = Geometry, TData = unknown> {
  geometry: TGeometry;
  data?: TData;
}

interface SelectionResizeOperation<TGeometry extends Geometry = Geometry, TData = unknown> {
  shape: Shape & { geometry: TGeometry };
  snapshotGeometry: TGeometry;
  snapshotData?: TData;
  transform: CanonicalShapeTransform;
  initialBounds: Bounds;
  nextBounds: Bounds;
  selectionScale: { x: number; y: number };
  layout?: NormalizedLayout;
}

interface SelectionResizeAdapter<TGeometry extends Geometry = Geometry, TData = unknown> {
  matches(shape: Shape): shape is Shape & { geometry: TGeometry };
  prepare(shape: Shape & { geometry: TGeometry }): SelectionResizeSnapshot<TGeometry, TData>;
  resize(operation: SelectionResizeOperation<TGeometry, TData>): SelectionResizeResult | null;
}

interface ShapeResizeEntry {
  adapter: SelectionResizeAdapter;
  snapshot: SelectionResizeSnapshot;
}

function ensureState(runtime: ToolRuntime): SelectionToolState {
  let state = runtimeState.get(runtime);
  if (!state) {
    state = { disposers: [] };
    runtimeState.set(runtime, state);
  }
  return state;
}

const HANDLE_DESCRIPTORS: HandleDescriptor[] = [
  {
    id: 'top-left',
    position: { u: 0, v: 0 },
    behavior: { type: 'resize' },
    altBehavior: { type: 'rotate' },
    shiftBehavior: { type: 'resize', proportional: true },
  },
  {
    id: 'top-right',
    position: { u: 1, v: 0 },
    behavior: { type: 'resize' },
    altBehavior: { type: 'rotate' },
    shiftBehavior: { type: 'resize', proportional: true },
  },
  {
    id: 'bottom-left',
    position: { u: 0, v: 1 },
    behavior: { type: 'resize' },
    altBehavior: { type: 'rotate' },
    shiftBehavior: { type: 'resize', proportional: true },
  },
  {
    id: 'bottom-right',
    position: { u: 1, v: 1 },
    behavior: { type: 'resize' },
    altBehavior: { type: 'rotate' },
    shiftBehavior: { type: 'resize', proportional: true },
  },
  {
    id: 'rotate',
    position: { u: 0.5, v: 0 },
    behavior: { type: 'rotate' },
  },
];

export function createSelectionTool(): ToolDefinition {
  const onPointerDown = (runtime: ToolRuntime): ToolEventHandler => (event) => {
    const selection = runtime.getSelection();
    const selectionIds = selection.ids.size
      ? Array.from(selection.ids)
      : selection.primaryId
        ? [selection.primaryId]
        : [];
    if (!selectionIds.length) return;

    const shapes = selectionIds
      .map((id) => runtime.getShape(id))
      .filter((shape): shape is Shape => Boolean(shape));
    if (!shapes.length) return;

    const transforms = new Map<string, CanonicalShapeTransform>();
    const resizeEntries = new Map<string, ShapeResizeEntry>();
    for (const shape of shapes) {
      const normalized = normalizeShapeTransform(shape.transform);
      transforms.set(shape.id, normalized);
      const adapter = findResizeAdapter(shape);
      if (adapter && adapter.matches(shape)) {
        const snapshot = adapter.prepare(shape);
        resizeEntries.set(shape.id, {
          adapter,
          snapshot,
        });
      }
    }

    const { bounds, shapeBounds } = computeSelectionBounds(shapes);
    const layouts = bounds
      ? computeNormalizedLayouts(shapes, bounds, shapeBounds)
      : new Map<string, NormalizedLayout>();
    const primaryShape =
      shapes.find((shape) => shape.id === selection.primaryId) ?? shapes[0];

    const dragState: DragState = {
      mode: 'move',
      selectionIds: shapes.map((shape) => shape.id),
      startPoint: event.point,
      lastPoint: event.point,
      transforms,
      layouts,
      selectionBounds: bounds,
      resizeEntries,
      shapeBounds,
    };

    const behavior = event.handleId
      ? resolveHandleBehavior(event, event.handleId)
      : null;

    if (behavior?.type === 'rotate' && hasRotatableShape(shapes)) {
      dragState.mode = 'rotate';
      dragState.center = bounds
        ? getBoundsCenter(bounds)
        : getShapeCenter(primaryShape, transforms.get(primaryShape.id)!);
    } else if (
      behavior &&
      behavior.type.startsWith('resize') &&
      hasResizableShape(shapes) &&
      bounds
    ) {
      dragState.mode = behavior.proportional ? 'resize-proportional' : 'resize';
      dragState.oppositeCorner = getHandlePosition(bounds, getOppositeHandle(event.handleId!));
    } else if (event.altKey && hasRotatableShape(shapes)) {
      dragState.mode = 'rotate';
      dragState.center = bounds
        ? getBoundsCenter(bounds)
        : getShapeCenter(primaryShape, transforms.get(primaryShape.id)!);
    }

    ensureState(runtime).drag = dragState;
    emitSelectionFrame(runtime, bounds);
  };

  const onPointerMove = (runtime: ToolRuntime): ToolEventHandler => (event) => {
    emitHandleHover(runtime, event.handleId, event);
    const state = ensureState(runtime);
    if (!state.drag) return;
    state.drag.lastPoint = event.point;
    const frame = computeDragFrame(runtime, state.drag);
    emitSelectionFrame(runtime, frame ?? state.drag.selectionBounds);
  };

  const onPointerUp = (runtime: ToolRuntime): ToolEventHandler => (event) => {
    emitHandleHover(runtime, undefined, event);
    const state = ensureState(runtime);
    if (!state.drag) return;
    state.drag.lastPoint = event.point;
    const drag = state.drag;
    applyDrag(runtime, drag);
    const finalBounds = computeBoundsForSelection(runtime, drag.selectionIds);
    emitSelectionFrame(runtime, finalBounds);
    state.drag = undefined;
  };

  const onPointerCancel = (runtime: ToolRuntime): ToolEventHandler => (event) => {
    emitHandleHover(runtime, undefined, event);
    const state = ensureState(runtime);
    if (state.drag) {
      emitSelectionFrame(runtime, state.drag.selectionBounds);
      state.drag = undefined;
    }
  };

  return {
    id: 'selection',
    label: 'Selection',
    activate(runtime) {
      const state = ensureState(runtime);
      state.disposers.forEach((dispose) => dispose());
      state.disposers = [];
      state.drag = undefined;
      state.disposers.push(
        attachPointerHandlers(runtime, {
          onPointerDown: onPointerDown(runtime),
          onPointerMove: onPointerMove(runtime),
          onPointerUp: onPointerUp(runtime),
          onPointerCancel: onPointerCancel(runtime),
        }),
      );
      runtime.emit({ type: 'handles', payload: HANDLE_DESCRIPTORS });
    },
    deactivate(runtime) {
      const state = ensureState(runtime);
      state.disposers.forEach((dispose) => dispose());
      state.disposers = [];
      state.drag = undefined;
      runtime.emit({ type: 'handles', payload: [] });
      runtime.emit({ type: 'handle-hover', payload: { handleId: null, behavior: null } });
      emitSelectionFrame(runtime, undefined);
    },
  };
}

function computeSelectionBounds(shapes: Shape[]): SelectionBoundsResult {
  const shapeBounds = new Map<string, SelectionBounds>();
  if (!shapes.length) return { bounds: undefined, shapeBounds };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const shape of shapes) {
    const bounds = getShapeBounds(shape);
    shapeBounds.set(shape.id, bounds);
    minX = Math.min(minX, bounds.minX);
    minY = Math.min(minY, bounds.minY);
    maxX = Math.max(maxX, bounds.maxX);
    maxY = Math.max(maxY, bounds.maxY);
  }
  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
    return { bounds: undefined, shapeBounds };
  }
  return {
    bounds: {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    },
    shapeBounds,
  };
}

function createRectangleResizeAdapter(): SelectionResizeAdapter<RectGeometry> {
  return {
    matches(shape): shape is Shape & { geometry: RectGeometry } {
      return shape.geometry.type === 'rect' && shape.interactions?.resizable !== false;
    },
    prepare(shape) {
      return {
        geometry: {
          type: 'rect',
          size: { ...shape.geometry.size },
        },
      };
    },
    resize({ snapshotGeometry, selectionScale, nextBounds, layout }) {
      if (!layout) return null;
      const geometry: RectGeometry = {
        type: 'rect',
        size: {
          width: snapshotGeometry.size.width * selectionScale.x,
          height: snapshotGeometry.size.height * selectionScale.y,
        },
      };
      const translation = getPointFromLayout(layout, nextBounds);
      return { geometry, translation };
    },
  };
}

function createEllipseResizeAdapter(): SelectionResizeAdapter<EllipseGeometry> {
  return {
    matches(shape): shape is Shape & { geometry: EllipseGeometry } {
      return shape.geometry.type === 'ellipse' && shape.interactions?.resizable !== false;
    },
    prepare(shape) {
      return {
        geometry: {
          type: 'ellipse',
          radiusX: shape.geometry.radiusX,
          radiusY: shape.geometry.radiusY,
        },
      };
    },
    resize({ snapshotGeometry, selectionScale, nextBounds, layout }) {
      if (!layout) return null;
      const geometry: EllipseGeometry = {
        type: 'ellipse',
        radiusX: snapshotGeometry.radiusX * selectionScale.x,
        radiusY: snapshotGeometry.radiusY * selectionScale.y,
      };
      const translation = getPointFromLayout(layout, nextBounds);
      return { geometry, translation };
    },
  };
}

function createRegularPolygonResizeAdapter(): SelectionResizeAdapter<RegularPolygonGeometry> {
  return {
    matches(shape): shape is Shape & { geometry: RegularPolygonGeometry } {
      return shape.geometry.type === 'regularPolygon' && shape.interactions?.resizable !== false;
    },
    prepare(shape) {
      return {
        geometry: {
          type: 'regularPolygon',
          radius: shape.geometry.radius,
          sides: shape.geometry.sides,
        },
      };
    },
    resize({ selectionScale, nextBounds, layout, transform }) {
      const translation = layout ? getPointFromLayout(layout, nextBounds) : transform.translation;
      const newScale = {
        x: transform.scale.x * selectionScale.x,
        y: transform.scale.y * selectionScale.y,
      };
      return {
        transform: {
          ...transform,
          translation,
          scale: newScale,
        },
      };
    },
  };
}

function createPenResizeAdapter(): SelectionResizeAdapter<PenGeometry> {
  return {
    matches(shape): shape is Shape & { geometry: PenGeometry } {
      return shape.geometry.type === 'pen' && shape.interactions?.resizable !== false;
    },
    prepare(shape) {
      return {
        geometry: {
          type: 'pen',
          points: shape.geometry.points.map((pt) => ({ ...pt })),
          simulatePressure: shape.geometry.simulatePressure,
        },
      };
    },
    resize({ selectionScale, nextBounds, layout, transform }) {
      const translation = layout ? getPointFromLayout(layout, nextBounds) : transform.translation;
      return {
        transform: {
          ...transform,
          translation,
          scale: {
            x: transform.scale.x * selectionScale.x,
            y: transform.scale.y * selectionScale.y,
          },
        },
      };
    },
  };
}


function computeNormalizedLayouts(
  shapes: Shape[],
  bounds: SelectionBounds,
  shapeBounds: Map<string, SelectionBounds>,
): Map<string, NormalizedLayout> {
  const layouts = new Map<string, NormalizedLayout>();
  for (const shape of shapes) {
    const localBounds = shapeBounds.get(shape.id);
    if (!localBounds) continue;
    const center = getBoundsCenter(localBounds);
    const offsetU = bounds.width === 0 ? 0.5 : (center.x - bounds.minX) / bounds.width;
    const offsetV = bounds.height === 0 ? 0.5 : (center.y - bounds.minY) / bounds.height;
    layouts.set(shape.id, {
      offsetU,
      offsetV,
    });
  }
  return layouts;
}

function getHandlePosition(bounds: SelectionBounds, handleId: string): Point {
  const { minX, minY, maxX, maxY } = bounds;
  switch (handleId) {
    case 'top-left':
      return { x: minX, y: minY };
    case 'top-right':
      return { x: maxX, y: minY };
    case 'bottom-left':
      return { x: minX, y: maxY };
    case 'bottom-right':
      return { x: maxX, y: maxY };
    case 'rotate':
      return { x: (minX + maxX) / 2, y: minY };
    default:
      return { x: minX, y: minY };
  }
}

function getPointFromLayout(layout: NormalizedLayout, bounds: SelectionBounds): Point {
  const width = bounds.width;
  const height = bounds.height;
  return {
    x: bounds.minX + width * layout.offsetU,
    y: bounds.minY + height * layout.offsetV,
  };
}

function hasRotatableShape(shapes: Shape[]): boolean {
  return shapes.some((shape) => shape.interactions?.rotatable);
}

function hasResizableShape(shapes: Shape[]): boolean {
  return shapes.some((shape) => Boolean(findResizeAdapter(shape)));
}

function applyDrag(runtime: ToolRuntime, drag: DragState) {
  switch (drag.mode) {
    case 'move':
      applyMove(runtime, drag);
      return;
    case 'resize':
    case 'resize-proportional':
      applyResize(runtime, drag);
      return;
    case 'rotate':
      applyRotate(runtime, drag);
      return;
  }
}

function applyMove(runtime: ToolRuntime, drag: DragState) {
  const dx = drag.lastPoint.x - drag.startPoint.x;
  const dy = drag.lastPoint.y - drag.startPoint.y;
  if (dx === 0 && dy === 0) return;
  const actions: UndoableAction[] = [];
  for (const shapeId of drag.selectionIds) {
    const transform = drag.transforms.get(shapeId);
    if (!transform) continue;
    actions.push(
      new UpdateShapeTransform(shapeId, {
        ...transform,
        translation: {
          x: transform.translation.x + dx,
          y: transform.translation.y + dy,
        },
      }),
    );
  }
  commitActions(runtime, actions);
}

function applyResize(runtime: ToolRuntime, drag: DragState) {
  const bounds = drag.selectionBounds;
  const opposite = drag.oppositeCorner;
  if (!bounds || !opposite) {
    // Fallback: treat selection as move only
    applyMove(runtime, drag);
    return;
  }
  const newBounds = createBoundsFromPoints(opposite, drag.lastPoint);
  if (newBounds.width === 0 && newBounds.height === 0) {
    return;
  }
  const selectionScale = {
    x: bounds.width === 0 ? 1 : newBounds.width / bounds.width,
    y: bounds.height === 0 ? 1 : newBounds.height / bounds.height,
  };
  const actions: UndoableAction[] = [];
  for (const shapeId of drag.selectionIds) {
    const layout = drag.layouts.get(shapeId);
    const transform = drag.transforms.get(shapeId);
    if (!transform) continue;
    const entry = drag.resizeEntries.get(shapeId);
    if (entry) {
      const shape = runtime.getShape(shapeId);
      if (shape && entry.adapter.matches(shape)) {
        const result = entry.adapter.resize({
          shape,
          snapshotGeometry: entry.snapshot.geometry as Geometry,
          snapshotData: entry.snapshot.data,
          transform,
          initialBounds: bounds,
          nextBounds: newBounds,
          selectionScale,
          layout,
        });
        if (result) {
          if (result.geometry) {
            actions.push(new UpdateShapeGeometry(shapeId, result.geometry));
          }
          if (result.transform) {
            actions.push(new UpdateShapeTransform(shapeId, result.transform));
            continue;
          }
          if (result.translation) {
            actions.push(
              new UpdateShapeTransform(shapeId, {
                ...transform,
                translation: result.translation,
              }),
            );
            continue;
          }
          continue;
        }
      }
    }
    const normalizedTranslation = layout ? getPointFromLayout(layout, newBounds) : undefined;
    const fallbackTranslation = normalizedTranslation ?? {
      x: transform.translation.x + (newBounds.minX - bounds.minX),
      y: transform.translation.y + (newBounds.minY - bounds.minY),
    };
    actions.push(
      new UpdateShapeTransform(shapeId, {
        ...transform,
        translation: fallbackTranslation,
      }),
    );
  }
  commitActions(runtime, actions);
}

function applyRotate(runtime: ToolRuntime, drag: DragState) {
  const delta = getRotationDelta(drag);
  if (delta === 0) return;
  const actions: UndoableAction[] = [];
  for (const shapeId of drag.selectionIds) {
    const transform = drag.transforms.get(shapeId);
    const shape = runtime.getShape(shapeId);
    if (!transform || !shape?.interactions?.rotatable) continue;
    actions.push(
      new UpdateShapeTransform(shapeId, {
        ...transform,
        rotation: transform.rotation + delta,
      }),
    );
  }
  commitActions(runtime, actions);
}

function commitActions(runtime: ToolRuntime, actions: UndoableAction[]): void {
  if (!actions.length) return;
  if (actions.length === 1) {
    runtime.commit(actions[0]);
    return;
  }
  runtime.commit(new CompositeAction(actions));
}

function getShapeCenter(shape: Shape, transform: CanonicalShapeTransform): Point {
  const bounds = getShapeBounds(shape, transform);
  return getBoundsCenter(bounds);
}

function angleBetween(a: Point, b: Point) {
  return Math.atan2(b.y, b.x) - Math.atan2(a.y, a.x);
}

function emitHandleHover(
  runtime: ToolRuntime,
  handleId: string | undefined,
  event: ToolPointerEvent,
) {
  if (!handleId) {
    runtime.emit({ type: 'handle-hover', payload: { handleId: null, behavior: null } });
    return;
  }
  const behavior = resolveHandleBehavior(event, handleId);
  runtime.emit({
    type: 'handle-hover',
    payload: { handleId, behavior: behavior ?? null },
  });
}

function resolveHandleBehavior(event: ToolPointerEvent, handleId: string): HandleBehavior | null {
  const handle = HANDLE_DESCRIPTORS.find((h) => h.id === handleId);
  if (!handle) return null;
  if (event.shiftKey && handle.shiftBehavior) return handle.shiftBehavior;
  if (event.altKey && handle.altBehavior) return handle.altBehavior;
  return handle.behavior;
}

function getOppositeHandle(handleId: string): string {
  switch (handleId) {
    case 'top-left':
      return 'bottom-right';
    case 'top-right':
      return 'bottom-left';
    case 'bottom-left':
      return 'top-right';
    case 'bottom-right':
      return 'top-left';
    default:
      return handleId;
  }
}

function computeDragFrame(runtime: ToolRuntime, drag: DragState): Bounds | undefined {
  switch (drag.mode) {
    case 'move': {
      if (!drag.selectionBounds) return undefined;
      const dx = drag.lastPoint.x - drag.startPoint.x;
      const dy = drag.lastPoint.y - drag.startPoint.y;
      return offsetBounds(drag.selectionBounds, dx, dy);
    }
    case 'resize':
    case 'resize-proportional':
      return drag.oppositeCorner
        ? createBoundsFromPoints(drag.oppositeCorner, drag.lastPoint)
        : drag.selectionBounds;
    case 'rotate':
      return computeRotatedBounds(runtime, drag);
    default:
      return drag.selectionBounds;
  }
}

function computeRotatedBounds(runtime: ToolRuntime, drag: DragState): Bounds | undefined {
  if (!drag.selectionBounds || !drag.center) {
    return drag.selectionBounds;
  }
  const delta = getRotationDelta(drag);
  if (delta === 0) {
    return drag.selectionBounds;
  }
  let merged: Bounds | undefined;
  for (const shapeId of drag.selectionIds) {
    const transform = drag.transforms.get(shapeId);
    const shape = runtime.getShape(shapeId);
    if (!transform || !shape) continue;
    const rotatedTransform: CanonicalShapeTransform = {
      ...transform,
      rotation: transform.rotation + delta,
    };
    const bounds = getShapeBounds(shape, rotatedTransform);
    merged = merged ? mergeBounds(merged, bounds) : bounds;
  }
  return merged ?? drag.selectionBounds;
}

function getRotationDelta(drag: DragState): number {
  if (!drag.center) return 0;
  const startVector = {
    x: drag.startPoint.x - drag.center.x,
    y: drag.startPoint.y - drag.center.y,
  };
  if (startVector.x === 0 && startVector.y === 0) return 0;
  const currentVector = {
    x: drag.lastPoint.x - drag.center.x,
    y: drag.lastPoint.y - drag.center.y,
  };
  return angleBetween(startVector, currentVector);
}

function offsetBounds(bounds: Bounds, dx: number, dy: number): Bounds {
  return {
    minX: bounds.minX + dx,
    minY: bounds.minY + dy,
    maxX: bounds.maxX + dx,
    maxY: bounds.maxY + dy,
    width: bounds.width,
    height: bounds.height,
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

function computeBoundsForSelection(runtime: ToolRuntime, ids: string[]): Bounds | undefined {
  const shapes = ids
    .map((id) => runtime.getShape(id))
    .filter((shape): shape is Shape => Boolean(shape));
  return computeSelectionBounds(shapes).bounds;
}

function emitSelectionFrame(runtime: ToolRuntime, bounds?: Bounds) {
  runtime.emit({ type: 'selection-frame', payload: bounds ?? null });
}

function findResizeAdapter(shape: Shape): SelectionResizeAdapter | null {
  for (const adapter of RESIZE_ADAPTERS) {
    if (adapter.matches(shape)) {
      return adapter;
    }
  }
  return null;
}

export function __getResizeAdapterForTest(shape: Shape): SelectionResizeAdapter | null {
  return findResizeAdapter(shape);
}
