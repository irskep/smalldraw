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
import { createPointerDragHandler } from './pointerDrag';
import type {
  DraftShape,
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

interface AxisResizeState {
  shapeId: string;
  axis: 'x' | 'y';
  anchor: Point;
  direction: Point;
  startExtent: number;
  startProjection: number;
}

interface DragState {
  mode: 'move' | 'resize' | 'resize-proportional' | 'resize-axis' | 'rotate';
  selectionIds: string[];
  startPoint: Point;
  lastPoint: Point;
  transforms: Map<string, CanonicalShapeTransform>;
  layouts: Map<string, NormalizedLayout>;
  selectionBounds?: Bounds;
  oppositeCorner?: Point;
  center?: Point;
  axisResize?: AxisResizeState;
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
    id: 'mid-top',
    position: { u: 0.5, v: 0 },
    behavior: { type: 'resize-axis', axis: 'y' },
  },
  {
    id: 'top-right',
    position: { u: 1, v: 0 },
    behavior: { type: 'resize' },
    altBehavior: { type: 'rotate' },
    shiftBehavior: { type: 'resize', proportional: true },
  },
  {
    id: 'mid-left',
    position: { u: 0, v: 0.5 },
    behavior: { type: 'resize-axis', axis: 'x' },
  },
  {
    id: 'bottom-left',
    position: { u: 0, v: 1 },
    behavior: { type: 'resize' },
    altBehavior: { type: 'rotate' },
    shiftBehavior: { type: 'resize', proportional: true },
  },
  {
    id: 'mid-right',
    position: { u: 1, v: 0.5 },
    behavior: { type: 'resize-axis', axis: 'x' },
  },
  {
    id: 'bottom-right',
    position: { u: 1, v: 1 },
    behavior: { type: 'resize' },
    altBehavior: { type: 'rotate' },
    shiftBehavior: { type: 'resize', proportional: true },
  },
  {
    id: 'mid-bottom',
    position: { u: 0.5, v: 1 },
    behavior: { type: 'resize-axis', axis: 'y' },
  },
  {
    id: 'rotate',
    position: { u: 0.5, v: -0.2 },
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
      behavior.type === 'resize-axis' &&
      event.handleId
    ) {
      const axisResize = createAxisResizeState(
        shapes,
        dragState,
        behavior.axis,
        event.handleId,
        event.point,
      );
      if (axisResize) {
        dragState.mode = 'resize-axis';
        dragState.axisResize = axisResize;
      }
    } else if (
      behavior &&
      behavior.type === 'resize' &&
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
    runtime.setDrafts(computePreviewShapes(runtime, state.drag));
  };

  const onPointerUp = (runtime: ToolRuntime): ToolEventHandler => (event) => {
    emitHandleHover(runtime, undefined, event);
    const state = ensureState(runtime);
    if (!state.drag) return;
    state.drag.lastPoint = event.point;
    const drag = state.drag;
    runtime.clearDraft();
    applyDrag(runtime, drag);
    const finalBounds = computeBoundsForSelection(runtime, drag.selectionIds);
    emitSelectionFrame(runtime, finalBounds);
    state.drag = undefined;
  };

  const onPointerCancel = (runtime: ToolRuntime): ToolEventHandler => (event) => {
    emitHandleHover(runtime, undefined, event);
    const state = ensureState(runtime);
    if (state.drag) {
      runtime.clearDraft();
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
        createPointerDragHandler(runtime, {
          onStart(point, event) {
            onPointerDown(runtime)({ ...event, point, buttons: event.buttons ?? 1 });
            return ensureState(runtime).drag ?? null;
          },
          onMove(drag, point, event) {
            drag.lastPoint = point;
            const frame = computeDragFrame(runtime, drag);
            emitSelectionFrame(runtime, frame ?? drag.selectionBounds);
            runtime.setDrafts(computePreviewShapes(runtime, drag));
          },
          onEnd(state, point, event) {
            onPointerUp(runtime)({ ...event, point, buttons: event.buttons ?? 0 });
          },
          onCancel() {
            onPointerCancel(runtime)({ point: { x: 0, y: 0 }, buttons: 0 });
          },
        }),
      );
      state.disposers.push(runtime.on('pointerMove', onPointerMove(runtime)));
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

function getRotatedRectAabbSize(
  width: number,
  height: number,
  rotation: number,
): { width: number; height: number } {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const absCos = Math.abs(cos);
  const absSin = Math.abs(sin);
  return {
    width: width * absCos + height * absSin,
    height: width * absSin + height * absCos,
  };
}

function solveRectSizeForAabb(
  targetWidth: number,
  targetHeight: number,
  rotation: number,
  baseSize: { width: number; height: number },
): { width: number; height: number } {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const absCos = Math.abs(cos);
  const absSin = Math.abs(sin);
  const det = absCos * absCos - absSin * absSin;
  if (det !== 0) {
    const width = (absCos * targetWidth - absSin * targetHeight) / det;
    const height = (absCos * targetHeight - absSin * targetWidth) / det;
    return {
      width: Math.max(0, width),
      height: Math.max(0, height),
    };
  }
  const sum =
    absCos === 0 ? 0 : (targetWidth + targetHeight) / (2 * absCos);
  const baseWidth = baseSize.width;
  const baseHeight = baseSize.height;
  if (baseWidth === 0 && baseHeight === 0) {
    return { width: 0, height: 0 };
  }
  if (baseHeight === 0) {
    return { width: sum, height: 0 };
  }
  if (baseWidth === 0) {
    return { width: 0, height: sum };
  }
  const ratio = baseWidth / baseHeight;
  const height = sum / (1 + ratio);
  const width = sum - height;
  return { width, height };
}

function getRotatedEllipseAabbSize(
  radiusX: number,
  radiusY: number,
  rotation: number,
): { width: number; height: number } {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const width = 2 * Math.sqrt((radiusX * cos) ** 2 + (radiusY * sin) ** 2);
  const height = 2 * Math.sqrt((radiusX * sin) ** 2 + (radiusY * cos) ** 2);
  return { width, height };
}

function solveEllipseRadiiForAabb(
  targetWidth: number,
  targetHeight: number,
  rotation: number,
  baseRadii: { radiusX: number; radiusY: number },
): { radiusX: number; radiusY: number } {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const cos2 = cos * cos;
  const sin2 = sin * sin;
  const det = cos2 - sin2;
  const halfWidth = targetWidth / 2;
  const halfHeight = targetHeight / 2;
  const w2 = halfWidth * halfWidth;
  const h2 = halfHeight * halfHeight;
  if (det !== 0) {
    const rx2 = (cos2 * w2 - sin2 * h2) / det;
    const ry2 = (cos2 * h2 - sin2 * w2) / det;
    return {
      radiusX: Math.sqrt(Math.max(0, rx2)),
      radiusY: Math.sqrt(Math.max(0, ry2)),
    };
  }
  const sumSq = cos2 === 0 ? 0 : (w2 + h2) / (2 * cos2);
  const baseX = baseRadii.radiusX;
  const baseY = baseRadii.radiusY;
  if (baseX === 0 && baseY === 0) {
    return { radiusX: 0, radiusY: 0 };
  }
  if (baseY === 0) {
    return { radiusX: Math.sqrt(Math.max(0, sumSq)), radiusY: 0 };
  }
  if (baseX === 0) {
    return { radiusX: 0, radiusY: Math.sqrt(Math.max(0, sumSq)) };
  }
  const ratio = (baseX * baseX) / (baseY * baseY);
  const ry2 = sumSq / (1 + ratio);
  const rx2 = sumSq - ry2;
  return {
    radiusX: Math.sqrt(Math.max(0, rx2)),
    radiusY: Math.sqrt(Math.max(0, ry2)),
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
    resize({ snapshotGeometry, selectionScale, nextBounds, layout, transform }) {
      if (!layout) return null;
      const scaleX = Math.abs(transform.scale.x);
      const scaleY = Math.abs(transform.scale.y);
      const baseWidth = snapshotGeometry.size.width * scaleX;
      const baseHeight = snapshotGeometry.size.height * scaleY;
      const currentAabb = getRotatedRectAabbSize(
        baseWidth,
        baseHeight,
        transform.rotation,
      );
      const targetAabbWidth = currentAabb.width * selectionScale.x;
      const targetAabbHeight = currentAabb.height * selectionScale.y;
      const solved = solveRectSizeForAabb(
        targetAabbWidth,
        targetAabbHeight,
        transform.rotation,
        { width: baseWidth, height: baseHeight },
      );
      const geometry: RectGeometry = {
        type: 'rect',
        size: {
          width: scaleX === 0 ? 0 : solved.width / scaleX,
          height: scaleY === 0 ? 0 : solved.height / scaleY,
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
    resize({ snapshotGeometry, selectionScale, nextBounds, layout, transform }) {
      if (!layout) return null;
      const scaleX = Math.abs(transform.scale.x);
      const scaleY = Math.abs(transform.scale.y);
      const baseRadiusX = snapshotGeometry.radiusX * scaleX;
      const baseRadiusY = snapshotGeometry.radiusY * scaleY;
      const currentAabb = getRotatedEllipseAabbSize(
        baseRadiusX,
        baseRadiusY,
        transform.rotation,
      );
      const targetAabbWidth = currentAabb.width * selectionScale.x;
      const targetAabbHeight = currentAabb.height * selectionScale.y;
      const solved = solveEllipseRadiiForAabb(
        targetAabbWidth,
        targetAabbHeight,
        transform.rotation,
        { radiusX: baseRadiusX, radiusY: baseRadiusY },
      );
      const geometry: EllipseGeometry = {
        type: 'ellipse',
        radiusX: scaleX === 0 ? 0 : solved.radiusX / scaleX,
        radiusY: scaleY === 0 ? 0 : solved.radiusY / scaleY,
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
      return { x: (minX + maxX) / 2, y: minY - (maxY - minY) * 0.2 };
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
    case 'resize-axis':
      applyAxisResize(runtime, drag);
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

function applyAxisResize(runtime: ToolRuntime, drag: DragState) {
  const axisResize = drag.axisResize;
  if (!axisResize) return;
  const shapeId = axisResize.shapeId;
  const shape = runtime.getShape(shapeId);
  const transform = drag.transforms.get(shapeId);
  if (!shape || !transform) return;
  const result = computeAxisResizeResult(drag, shape, transform, drag.lastPoint);
  if (!result) return;
  const actions: UndoableAction[] = [
    new UpdateShapeGeometry(shapeId, result.geometry),
    new UpdateShapeTransform(shapeId, {
      ...transform,
      translation: result.translation,
    }),
  ];
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

function computePreviewShapes(runtime: ToolRuntime, drag: DragState): DraftShape[] {
  const previews: DraftShape[] = [];

  for (const shapeId of drag.selectionIds) {
    const shape = runtime.getShape(shapeId);
    const transform = drag.transforms.get(shapeId);
    if (!shape || !transform) continue;

    let previewGeometry = shape.geometry;
    let previewTransform = transform;

    switch (drag.mode) {
      case 'move': {
        const dx = drag.lastPoint.x - drag.startPoint.x;
        const dy = drag.lastPoint.y - drag.startPoint.y;
        previewTransform = {
          ...transform,
          translation: {
            x: transform.translation.x + dx,
            y: transform.translation.y + dy,
          },
        };
        break;
      }
      case 'resize':
      case 'resize-proportional': {
        const bounds = drag.selectionBounds;
        const opposite = drag.oppositeCorner;
        if (bounds && opposite) {
          const newBounds = createBoundsFromPoints(opposite, drag.lastPoint);
          const selectionScale = {
            x: bounds.width === 0 ? 1 : newBounds.width / bounds.width,
            y: bounds.height === 0 ? 1 : newBounds.height / bounds.height,
          };
          const layout = drag.layouts.get(shapeId);
          const entry = drag.resizeEntries.get(shapeId);

          if (entry && entry.adapter.matches(shape)) {
            const result = entry.adapter.resize({
              shape: shape as Shape & { geometry: Geometry },
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
                previewGeometry = result.geometry;
              }
              if (result.transform) {
                previewTransform = result.transform;
              } else if (result.translation) {
                previewTransform = { ...transform, translation: result.translation };
              }
            }
          } else {
            const normalizedTranslation = layout ? getPointFromLayout(layout, newBounds) : undefined;
            previewTransform = {
              ...transform,
              translation: normalizedTranslation ?? {
                x: transform.translation.x + (newBounds.minX - bounds.minX),
                y: transform.translation.y + (newBounds.minY - bounds.minY),
              },
            };
          }
        }
        break;
      }
      case 'resize-axis': {
        const result = computeAxisResizeResult(drag, shape, transform, drag.lastPoint);
        if (result) {
          previewGeometry = result.geometry;
          previewTransform = {
            ...transform,
            translation: result.translation,
          };
        }
        break;
      }
      case 'rotate': {
        const delta = getRotationDelta(drag);
        if (shape.interactions?.rotatable) {
          previewTransform = {
            ...transform,
            rotation: transform.rotation + delta,
          };
        }
        break;
      }
    }

    previews.push({
      ...shape,
      geometry: previewGeometry,
      transform: previewTransform,
      toolId: 'selection',
      temporary: true,
    });
  }

  return previews;
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
    case 'resize-axis':
      return computeAxisResizeBounds(runtime, drag);
    case 'rotate':
      return computeRotatedBounds(runtime, drag);
    default:
      return drag.selectionBounds;
  }
}

function computeAxisResizeBounds(runtime: ToolRuntime, drag: DragState): Bounds | undefined {
  const axisResize = drag.axisResize;
  if (!axisResize) return drag.selectionBounds;
  const shape = runtime.getShape(axisResize.shapeId);
  const transform = drag.transforms.get(axisResize.shapeId);
  if (!shape || !transform) return drag.selectionBounds;
  const result = computeAxisResizeResult(drag, shape, transform, drag.lastPoint);
  if (!result) return drag.selectionBounds;
  const previewShape: Shape = {
    ...shape,
    geometry: result.geometry,
  };
  const previewTransform: CanonicalShapeTransform = {
    ...transform,
    translation: result.translation,
  };
  return getShapeBounds(previewShape, previewTransform);
}

function computeAxisResizeResult(
  drag: DragState,
  shape: Shape,
  transform: CanonicalShapeTransform,
  point: Point,
): { geometry: RectGeometry; translation: Point } | null {
  const axisResize = drag.axisResize;
  if (!axisResize || axisResize.shapeId !== shape.id) return null;
  if (shape.geometry.type !== 'rect') return null;
  const entry = drag.resizeEntries.get(shape.id);
  if (!entry || entry.snapshot.geometry.type !== 'rect') return null;
  const snapshot = entry.snapshot.geometry;
  const direction = axisResize.direction;
  const anchor = axisResize.anchor;
  const delta = { x: point.x - anchor.x, y: point.y - anchor.y };
  const projected = delta.x * direction.x + delta.y * direction.y;
  const extent = Math.max(0, axisResize.startExtent + (projected - axisResize.startProjection));
  const half = extent / 2;
  const scaleX = Math.abs(transform.scale.x);
  const scaleY = Math.abs(transform.scale.y);
  const width =
    axisResize.axis === 'x'
      ? scaleX === 0
        ? 0
        : extent / scaleX
      : snapshot.size.width;
  const height =
    axisResize.axis === 'y'
      ? scaleY === 0
        ? 0
        : extent / scaleY
      : snapshot.size.height;
  return {
    geometry: {
      type: 'rect',
      size: { width, height },
    },
    translation: {
      x: anchor.x + direction.x * half,
      y: anchor.y + direction.y * half,
    },
  };
}

function createAxisResizeState(
  shapes: Shape[],
  drag: DragState,
  axis: 'x' | 'y',
  handleId: string,
  startPoint: Point,
): AxisResizeState | null {
  if (shapes.length !== 1) return null;
  const shape = shapes[0];
  if (shape.geometry.type !== 'rect' || shape.interactions?.resizable === false) {
    return null;
  }
  const transform = drag.transforms.get(shape.id);
  const entry = drag.resizeEntries.get(shape.id);
  if (!transform || !entry || entry.snapshot.geometry.type !== 'rect') return null;
  const side = getAxisHandleSide(handleId);
  if (!side) return null;
  const rotation = transform.rotation;
  const signX = transform.scale.x === 0 ? 1 : Math.sign(transform.scale.x);
  const signY = transform.scale.y === 0 ? 1 : Math.sign(transform.scale.y);
  const baseDirection =
    axis === 'x'
      ? { x: Math.cos(rotation) * signX, y: Math.sin(rotation) * signX }
      : { x: -Math.sin(rotation) * signY, y: Math.cos(rotation) * signY };
  const snapshot = entry.snapshot.geometry;
  const startExtent =
    axis === 'x'
      ? snapshot.size.width * Math.abs(transform.scale.x)
      : snapshot.size.height * Math.abs(transform.scale.y);
  const half = startExtent / 2;
  const center = transform.translation;
  const direction =
    side === 'positive'
      ? baseDirection
      : { x: -baseDirection.x, y: -baseDirection.y };
  const anchor =
    side === 'positive'
      ? { x: center.x - direction.x * half, y: center.y - direction.y * half }
      : { x: center.x - direction.x * half, y: center.y - direction.y * half };
  const startDelta = { x: startPoint.x - anchor.x, y: startPoint.y - anchor.y };
  const startProjection = startDelta.x * direction.x + startDelta.y * direction.y;
  return {
    shapeId: shape.id,
    axis,
    anchor,
    direction,
    startExtent,
    startProjection,
  };
}

function getAxisHandleSide(handleId: string): 'positive' | 'negative' | null {
  switch (handleId) {
    case 'mid-right':
    case 'mid-bottom':
      return 'positive';
    case 'mid-left':
    case 'mid-top':
      return 'negative';
    default:
      return null;
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
