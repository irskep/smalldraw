import {
  AddShape,
  attachPointerHandlers,
  createDisposerBucket,
  createPenJSONGeometry,
  type DisposerBucket,
  type PenShape,
  type StrokeStyle,
  type ToolDefinition,
  type ToolEventHandler,
  type ToolRuntime,
} from "@smalldraw/core";
import {
  type Box,
  BoxOperations,
  getX,
  getY,
  toVec2,
  toVec2Like,
} from "@smalldraw/geometry";
import { Vec2 } from "gl-matrix";
import { isPressureSample } from "./pressure";

const PRIMARY_BUTTON_MASK = 1;
const SPRAY_RADIUS_SCALE = 0.625;
const SPRAY_SPACING_SCALE = 0.38;
const SPRAY_DOTS_PER_CLUSTER_SCALE = 1.32;
const SPRAY_DOTS_PER_CLUSTER_EXPONENT = 0.6;
const SPRAY_LARGE_SIZE_DAMPING_START = 12;
const SPRAY_DOTS_LARGE_SIZE_DAMPING_EXPONENT = 0.5;
const SPRAY_TAP_DOTS_SCALE = 2.5;
const UNEVEN_SPRAY_CLUSTERS_PER_SECOND_SCALE = 7.5;
const UNEVEN_SPRAY_CLUSTERS_PER_SECOND_EXPONENT = 0.65;
const UNEVEN_SPRAY_RATE_LARGE_SIZE_DAMPING_EXPONENT = 0.675;
const UNEVEN_SPRAY_BRIDGE_SPACING_SCALE = 1.4;
const UNEVEN_SPRAY_MAX_BRIDGE_CLUSTERS_PER_MOVE = 8;
const EVEN_SPRAYCAN_BRUSH_ID = "even-spraycan";
const UNEVEN_SPRAYCAN_BRUSH_ID = "uneven-spraycan";

interface ActiveStrokeState {
  drawing: StrokeDraftState | null;
  lastPreviewSegmentBounds: Box | null;
  sprayAnimationHandle: number | null;
  sprayAnimationLastFrameMs: number | null;
  disposers: DisposerBucket;
}

interface StrokeDraftState {
  id: string;
  geometry: {
    points: Array<[number, number]>;
    pressures?: number[];
  };
  stroke: StrokeStyle;
  zIndex: string;
  lastInputPoint: Vec2 | null;
  sprayDistanceRemainder: number;
  sprayClusterRemainder: number;
}

const runtimeState = new WeakMap<ToolRuntime, ActiveStrokeState>();

export interface StrokeToolOptions {
  stroke?: StrokeStyle;
}

export interface CreateStrokeToolOptions {
  id: string;
  label: string;
  draftIdPrefix: string;
  shapeIdPrefix: string;
  fallbackStroke: StrokeStyle;
  runtimeOptions?: StrokeToolOptions;
}

export function createStrokeTool(
  options: CreateStrokeToolOptions,
): ToolDefinition {
  const fallbackStroke = options.fallbackStroke;
  if (!fallbackStroke.brushId) {
    throw new Error(
      `Stroke tool '${options.id}' must define fallbackStroke.brushId.`,
    );
  }

  const ensureState = (runtime: ToolRuntime): ActiveStrokeState => {
    let state = runtimeState.get(runtime);
    if (!state) {
      state = {
        drawing: null,
        lastPreviewSegmentBounds: null,
        sprayAnimationHandle: null,
        sprayAnimationLastFrameMs: null,
        disposers: createDisposerBucket(),
      };
      runtimeState.set(runtime, state);
    }
    return state;
  };

  const resolveStroke = (runtime: ToolRuntime): StrokeStyle => {
    const runtimeOptions = runtime.getOptions<StrokeToolOptions>();
    const shared = runtime.getSharedSettings();
    const override = runtimeOptions?.stroke ?? options.runtimeOptions?.stroke;
    const brushId = override?.brushId ?? fallbackStroke.brushId;
    if (!brushId) {
      throw new Error(`Stroke tool '${options.id}' resolved without brushId.`);
    }
    return {
      type: "brush",
      color: override?.color ?? shared.strokeColor ?? fallbackStroke.color,
      size: override?.size ?? shared.strokeWidth ?? fallbackStroke.size,
      brushId,
      compositeOp:
        override?.compositeOp ?? fallbackStroke.compositeOp ?? "source-over",
    } satisfies StrokeStyle;
  };

  const beginDrawing = (
    runtime: ToolRuntime,
    point: Vec2,
    pressure?: number,
  ): void => {
    const state = ensureState(runtime);
    if (state.drawing) {
      finishStroke(runtime);
    }
    const draftId = runtime.generateShapeId(options.draftIdPrefix);
    const zIndex = runtime.getNextZIndex();
    const stroke = resolveStroke(runtime);
    const sprayMode = getSprayMode(stroke.brushId);
    const drawing: StrokeDraftState = {
      id: draftId,
      geometry: {
        points: sprayMode ? [] : [toVec2Like(point)],
        pressures: sprayMode
          ? undefined
          : isPressureSample(pressure)
            ? [pressure]
            : undefined,
      },
      stroke,
      zIndex,
      lastInputPoint: new Vec2(point),
      sprayDistanceRemainder: 0,
      sprayClusterRemainder: 0,
    };
    if (sprayMode) {
      appendSprayCluster(
        drawing,
        point,
        Math.max(
          1,
          Math.round(
            getSprayDotsPerCluster(stroke.size) * SPRAY_TAP_DOTS_SCALE,
          ),
        ),
      );
    }
    state.drawing = drawing;
    if (sprayMode === "uneven") {
      startUnevenSprayAnimation(runtime);
    }
    state.lastPreviewSegmentBounds = null;
    updateDraft(
      runtime,
      sprayMode ? getSprayPointDirtyBounds(point, stroke.size) : undefined,
    );
  };

  const appendPoint = (
    runtime: ToolRuntime,
    point: Vec2,
    pressure?: number,
  ): void => {
    const state = runtimeState.get(runtime);
    if (!state?.drawing) {
      return;
    }
    const sprayMode = getSprayMode(state.drawing.stroke.brushId);
    if (sprayMode === "even") {
      const dirtyBounds = appendSpraySegment(state.drawing, point);
      if (dirtyBounds) {
        updateDraft(runtime, dirtyBounds);
      }
      return;
    }
    if (sprayMode === "uneven") {
      const dirtyBounds = appendUnevenSprayBridge(state.drawing, point);
      if (dirtyBounds) {
        updateDraft(runtime, dirtyBounds);
      }
      return;
    }
    state.drawing.geometry.points.push(toVec2Like(point));
    if (state.drawing.geometry.pressures && isPressureSample(pressure)) {
      state.drawing.geometry.pressures.push(pressure);
    }
    state.drawing.lastInputPoint = new Vec2(point);
    updateDraft(runtime);
  };

  const updateDraft = (runtime: ToolRuntime, boundsHint?: Box): void => {
    const state = runtimeState.get(runtime);
    if (!state?.drawing) {
      return;
    }
    const draftShape = createPreviewStrokeShape(state.drawing) ?? null;
    if (!draftShape) {
      runtime.clearDraft();
      runtime.setPreview(null);
      state.lastPreviewSegmentBounds = null;
      return;
    }
    runtime.setDraft({
      ...draftShape,
      toolId: runtime.toolId,
      temporary: true,
    });
    const nextBounds =
      boundsHint ??
      getStrokePreviewBounds(
        state.drawing.geometry.points,
        state.drawing.stroke.size,
        state.drawing.stroke.brushId,
      );
    if (!nextBounds) {
      runtime.setPreview(null);
      state.lastPreviewSegmentBounds = null;
      return;
    }
    const dirtyBounds = state.lastPreviewSegmentBounds
      ? BoxOperations.fromBoxPair(state.lastPreviewSegmentBounds, nextBounds)
      : nextBounds;
    runtime.setPreview({ dirtyBounds });
    state.lastPreviewSegmentBounds = nextBounds;
  };

  const finishStroke = (runtime: ToolRuntime): void => {
    const state = runtimeState.get(runtime);
    if (!state?.drawing) {
      runtime.clearDraft();
      runtime.setPreview(null);
      return;
    }
    stopSprayAnimation(state);
    const minPointCount = getSprayMode(state.drawing.stroke.brushId) ? 1 : 2;
    if (state.drawing.geometry.points.length < minPointCount) {
      runtime.clearDraft();
      runtime.setPreview(null);
      state.drawing = null;
      state.lastPreviewSegmentBounds = null;
      return;
    }
    const shape = createStrokeShape(state.drawing);
    if (shape) {
      shape.id = runtime.generateShapeId(options.shapeIdPrefix);
      runtime.commit(new AddShape(shape));
    }
    runtime.clearDraft();
    runtime.setPreview(null);
    state.drawing = null;
    state.lastPreviewSegmentBounds = null;
  };

  const cancelStroke = (runtime: ToolRuntime): void => {
    const state = runtimeState.get(runtime);
    if (state) {
      stopSprayAnimation(state);
      state.drawing = null;
      state.lastPreviewSegmentBounds = null;
    }
    runtime.clearDraft();
    runtime.setPreview(null);
  };

  const startUnevenSprayAnimation = (runtime: ToolRuntime): void => {
    const state = ensureState(runtime);
    stopSprayAnimation(state);
    const tick = (timestampMs: number) => {
      const latest = runtimeState.get(runtime);
      if (!latest?.drawing) {
        stopSprayAnimation(latest);
        return;
      }
      if (getSprayMode(latest.drawing.stroke.brushId) !== "uneven") {
        stopSprayAnimation(latest);
        return;
      }
      const previous = latest.sprayAnimationLastFrameMs;
      latest.sprayAnimationLastFrameMs = timestampMs;
      if (previous === null) {
        latest.sprayAnimationHandle = requestFrame(tick);
        return;
      }
      const deltaMs = Math.max(0, Math.min(100, timestampMs - previous));
      const dirtyBounds = appendUnevenSprayFrame(latest.drawing, deltaMs);
      if (dirtyBounds) {
        updateDraft(runtime, dirtyBounds);
      }
      latest.sprayAnimationHandle = requestFrame(tick);
    };
    state.sprayAnimationLastFrameMs = null;
    state.sprayAnimationHandle = requestFrame(tick);
  };

  const createPointerDownHandler = (runtime: ToolRuntime): ToolEventHandler => {
    return (event) => {
      if ((event.buttons ?? PRIMARY_BUTTON_MASK) & PRIMARY_BUTTON_MASK) {
        beginDrawing(runtime, event.point, event.pressure);
      }
    };
  };

  const createPointerMoveHandler = (runtime: ToolRuntime): ToolEventHandler => {
    return (event) => {
      appendPoint(runtime, event.point, event.pressure);
    };
  };

  const createPointerUpHandler = (runtime: ToolRuntime): ToolEventHandler => {
    return () => {
      finishStroke(runtime);
    };
  };

  const createPointerCancelHandler = (
    runtime: ToolRuntime,
  ): ToolEventHandler => {
    return () => {
      cancelStroke(runtime);
    };
  };

  return {
    id: options.id,
    label: options.label,
    styleSupport: {
      strokeColor: true,
      strokeWidth: true,
      fillColor: false,
      transparentStrokeColor: false,
      transparentFillColor: false,
    },
    activate(runtime) {
      const state = ensureState(runtime);
      state.disposers.dispose();
      stopSprayAnimation(state);
      state.drawing = null;
      state.lastPreviewSegmentBounds = null;
      state.disposers.add(
        attachPointerHandlers(runtime, {
          onPointerDown: createPointerDownHandler(runtime),
          onPointerMove: createPointerMoveHandler(runtime),
          onPointerUp: createPointerUpHandler(runtime),
          onPointerCancel: createPointerCancelHandler(runtime),
        }),
      );
      return () => {
        state.disposers.dispose();
        stopSprayAnimation(state);
        runtime.clearDraft();
        runtime.setPreview(null);
      };
    },
  };
}

function getSprayMode(brushId: string | undefined): "even" | "uneven" | null {
  if (brushId === EVEN_SPRAYCAN_BRUSH_ID) {
    return "even";
  }
  if (brushId === UNEVEN_SPRAYCAN_BRUSH_ID) {
    return "uneven";
  }
  return null;
}

function stopSprayAnimation(state: ActiveStrokeState | undefined): void {
  if (!state?.sprayAnimationHandle) {
    if (state) {
      state.sprayAnimationLastFrameMs = null;
    }
    return;
  }
  cancelFrame(state.sprayAnimationHandle);
  state.sprayAnimationHandle = null;
  state.sprayAnimationLastFrameMs = null;
}

function requestFrame(callback: (timestampMs: number) => void): number {
  const raf = globalThis.requestAnimationFrame;
  if (typeof raf === "function") {
    return raf(callback);
  }
  return globalThis.setTimeout(
    () => callback(nowMs()),
    16,
  ) as unknown as number;
}

function cancelFrame(handle: number): void {
  const cancelRaf = globalThis.cancelAnimationFrame;
  if (typeof cancelRaf === "function") {
    cancelRaf(handle);
    return;
  }
  globalThis.clearTimeout(handle);
}

function nowMs(): number {
  if (globalThis.performance?.now) {
    return globalThis.performance.now();
  }
  return Date.now();
}

function appendUnevenSprayFrame(
  draft: StrokeDraftState,
  deltaMs: number,
): Box | null {
  const point = draft.lastInputPoint;
  if (!point) {
    return null;
  }
  const sprayRateDamping = getLargeSizeDamping(
    draft.stroke.size,
    UNEVEN_SPRAY_RATE_LARGE_SIZE_DAMPING_EXPONENT,
  );
  const clustersPerSecond = Math.max(
    8,
    Math.max(1, draft.stroke.size) **
      UNEVEN_SPRAY_CLUSTERS_PER_SECOND_EXPONENT *
      UNEVEN_SPRAY_CLUSTERS_PER_SECOND_SCALE *
      sprayRateDamping,
  );
  draft.sprayClusterRemainder += (deltaMs / 1000) * clustersPerSecond;
  const clusterCount = Math.floor(draft.sprayClusterRemainder);
  draft.sprayClusterRemainder -= clusterCount;
  if (clusterCount <= 0) {
    return null;
  }
  const dotsPerCluster = Math.max(
    1,
    Math.round(getSprayDotsPerCluster(draft.stroke.size)),
  );
  for (let index = 0; index < clusterCount; index += 1) {
    appendSprayCluster(draft, point, dotsPerCluster);
  }
  return getSprayPointDirtyBounds(point, draft.stroke.size);
}

function appendUnevenSprayBridge(
  draft: StrokeDraftState,
  point: Vec2,
): Box | null {
  const from = draft.lastInputPoint;
  draft.lastInputPoint = new Vec2(point);
  if (!from) {
    return null;
  }
  const segment = new Vec2().add(point).sub(from);
  const distance = Vec2.length(segment);
  if (distance <= 0) {
    return null;
  }
  const spacing = Math.max(
    2,
    draft.stroke.size * UNEVEN_SPRAY_BRIDGE_SPACING_SCALE,
  );
  const rawBridgeCount = Math.floor(distance / spacing);
  const bridgeCount = Math.min(
    rawBridgeCount,
    UNEVEN_SPRAY_MAX_BRIDGE_CLUSTERS_PER_MOVE,
  );
  if (bridgeCount <= 0) {
    return null;
  }
  const direction = new Vec2().add(segment).mul([1 / distance, 1 / distance]);
  const step = distance / (bridgeCount + 1);
  const dotsPerCluster = Math.max(
    1,
    Math.round(getSprayDotsPerCluster(draft.stroke.size)),
  );
  for (let index = 1; index <= bridgeCount; index += 1) {
    const length = step * index;
    const center = new Vec2()
      .add(from)
      .add(new Vec2().add(direction).mul([length, length]));
    appendSprayCluster(draft, center, dotsPerCluster);
  }
  return getSpraySegmentDirtyBounds(from, point, draft.stroke.size);
}

function appendSpraySegment(draft: StrokeDraftState, point: Vec2): Box | null {
  const from = draft.lastInputPoint;
  if (!from) {
    draft.lastInputPoint = new Vec2(point);
    appendSprayCluster(draft, point, 1);
    return getSprayPointDirtyBounds(point, draft.stroke.size);
  }
  const segment = new Vec2().add(point).sub(from);
  const distance = Vec2.length(segment);
  if (distance <= 0) {
    return null;
  }
  const spacing = Math.max(0.75, draft.stroke.size * SPRAY_SPACING_SCALE);
  const clusterDotCount = Math.max(
    1,
    Math.round(getSprayDotsPerCluster(draft.stroke.size)),
  );
  const direction = new Vec2().add(segment).mul([1 / distance, 1 / distance]);
  let traveled = 0;
  let remainder = draft.sprayDistanceRemainder;
  let appended = false;

  while (remainder + (distance - traveled) >= spacing) {
    const step = spacing - remainder;
    traveled += step;
    const samplePoint = new Vec2()
      .add(from)
      .add(new Vec2().add(direction).mul([traveled, traveled]));
    appendSprayCluster(draft, samplePoint, clusterDotCount);
    appended = true;
    remainder = 0;
  }

  draft.sprayDistanceRemainder = remainder + (distance - traveled);
  draft.lastInputPoint = new Vec2(point);
  if (!appended) {
    return null;
  }
  return getSpraySegmentDirtyBounds(from, point, draft.stroke.size);
}

function appendSprayCluster(
  draft: StrokeDraftState,
  center: Vec2,
  count: number,
): void {
  const sprayRadius = Math.max(2, draft.stroke.size * SPRAY_RADIUS_SCALE);
  for (let index = 0; index < count; index += 1) {
    const offset = sampleDiskOffset(sprayRadius);
    const dot = new Vec2().add(center).add(offset);
    draft.geometry.points.push(toVec2Like(dot));
  }
}

function sampleDiskOffset(radius: number): Vec2 {
  const angle = Math.random() * Math.PI * 2;
  const radialDistance = Math.sqrt(Math.random()) * radius;
  return new Vec2(Math.cos(angle), Math.sin(angle)).mul([
    radialDistance,
    radialDistance,
  ]);
}

function getSprayDotsPerCluster(strokeSize: number): number {
  const dotDamping = getLargeSizeDamping(
    strokeSize,
    SPRAY_DOTS_LARGE_SIZE_DAMPING_EXPONENT,
  );
  return (
    Math.max(1, strokeSize) ** SPRAY_DOTS_PER_CLUSTER_EXPONENT *
    SPRAY_DOTS_PER_CLUSTER_SCALE *
    dotDamping
  );
}

function getSpraySpreadRadius(strokeSize: number): number {
  return Math.max(2, strokeSize * SPRAY_RADIUS_SCALE);
}

function getSprayDotRadius(strokeSize: number): number {
  return Math.max(1, strokeSize * 0.12);
}

function getSprayDirtyPadding(strokeSize: number): number {
  return getSpraySpreadRadius(strokeSize) + getSprayDotRadius(strokeSize) + 1;
}

function getSprayPointDirtyBounds(point: Vec2, strokeSize: number): Box {
  const padding = getSprayDirtyPadding(strokeSize);
  const paddingVec = new Vec2(padding, padding);
  const min = new Vec2(point).sub(paddingVec);
  const max = new Vec2(point).add(paddingVec);
  return {
    min,
    max,
  };
}

function getSpraySegmentDirtyBounds(
  from: Vec2,
  to: Vec2,
  strokeSize: number,
): Box {
  const padding = getSprayDirtyPadding(strokeSize);
  const segmentBounds = BoxOperations.fromPointPair(from, to);
  const paddingVec = new Vec2(padding, padding);
  return {
    min: new Vec2(segmentBounds.min).sub(paddingVec),
    max: new Vec2(segmentBounds.max).add(paddingVec),
  };
}

function getLargeSizeDamping(strokeSize: number, exponent: number): number {
  const normalizedSize = Math.max(
    1,
    strokeSize / SPRAY_LARGE_SIZE_DAMPING_START,
  );
  return normalizedSize ** -exponent;
}

function getStrokePreviewBounds(
  points: Array<[number, number]>,
  strokeSize: number,
  brushId?: string,
): Box | null {
  const previewPoints = getSprayMode(brushId)
    ? points.slice(-64)
    : points.slice(-6);
  const pointBounds = BoxOperations.fromPointArray(previewPoints);
  if (!pointBounds) {
    return null;
  }
  const padding = Math.max(2, strokeSize * 10);
  return {
    min: [getX(pointBounds.min) - padding, getY(pointBounds.min) - padding],
    max: [getX(pointBounds.max) + padding, getY(pointBounds.max) + padding],
  };
}

function createStrokeShape(draft: StrokeDraftState): PenShape | undefined {
  const bounds = BoxOperations.fromPointArray(draft.geometry.points);
  if (!bounds) {
    return undefined;
  }
  const center = new BoxOperations(bounds).center;
  const localPoints = draft.geometry.points.map((pt) =>
    toVec2Like(new Vec2().add(toVec2(pt)).sub(center)),
  );
  return {
    id: draft.id,
    type: "pen",
    geometry: createPenJSONGeometry(localPoints, draft.geometry.pressures),
    style: {
      stroke: draft.stroke,
    },
    zIndex: draft.zIndex,
    layerId: "default",
    temporalOrder: 0,
    interactions: {
      resizable: true,
      rotatable: false,
    },
    transform: {
      translation: toVec2Like(center),
      scale: toVec2Like(new Vec2(1, 1)),
      rotation: 0,
    },
  };
}

function createPreviewStrokeShape(
  draft: StrokeDraftState,
): PenShape | undefined {
  if (!draft.geometry.points.length) {
    return undefined;
  }
  return {
    id: draft.id,
    type: "pen",
    geometry: createPenJSONGeometry(
      draft.geometry.points,
      draft.geometry.pressures,
    ),
    style: {
      stroke: draft.stroke,
    },
    zIndex: draft.zIndex,
    layerId: "default",
    temporalOrder: 0,
    interactions: {
      resizable: true,
      rotatable: false,
    },
    transform: {
      translation: [0, 0],
      scale: [1, 1],
      rotation: 0,
    },
  };
}
