import {
  type Box,
  BoxOperations,
  getX,
  getY,
  toVec2,
  toVec2Like,
} from "@smalldraw/geometry";
import { Vec2 } from "gl-matrix";
import { AddShape } from "../actions";
import type { PenGeometry, PenShape } from "../model/shapes/penShape";
import type { StrokeStyle } from "../model/style";
import { createDisposerBucket, type DisposerBucket } from "./disposerBucket";
import { attachPointerHandlers } from "./pointerHandlers";
import { isPressureSample } from "./pressure";
import type { ToolDefinition, ToolEventHandler, ToolRuntime } from "./types";

const PRIMARY_BUTTON_MASK = 1;
const SPRAY_RADIUS_SCALE = 1.25;
const SPRAY_SPACING_SCALE = 0.38;
const SPRAY_DOTS_PER_CLUSTER_SCALE = 1.2;
const SPRAY_TAP_DOTS_SCALE = 2.5;

interface ActiveStrokeState {
  drawing: StrokeDraftState | null;
  lastPreviewSegmentBounds: Box | null;
  disposers: DisposerBucket;
}

interface StrokeDraftState {
  id: string;
  geometry: PenGeometry;
  stroke: StrokeStyle;
  zIndex: string;
  lastInputPoint: Vec2 | null;
  sprayDistanceRemainder: number;
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
    const drawing: StrokeDraftState = {
      id: draftId,
      geometry: {
        type: "pen",
        points: stroke.brushId === "spray" ? [] : [toVec2Like(point)],
        pressures:
          stroke.brushId === "spray"
            ? undefined
            : isPressureSample(pressure)
              ? [pressure]
              : undefined,
      },
      stroke,
      zIndex,
      lastInputPoint: new Vec2(point),
      sprayDistanceRemainder: 0,
    };
    if (stroke.brushId === "spray") {
      appendSprayCluster(
        drawing,
        point,
        Math.max(1, Math.round(stroke.size * SPRAY_TAP_DOTS_SCALE)),
      );
    }
    state.drawing = drawing;
    state.lastPreviewSegmentBounds = null;
    updateDraft(runtime);
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
    if (state.drawing.stroke.brushId === "spray") {
      appendSpraySegment(state.drawing, point);
      updateDraft(runtime);
      return;
    }
    state.drawing.geometry.points.push(toVec2Like(point));
    if (state.drawing.geometry.pressures && isPressureSample(pressure)) {
      state.drawing.geometry.pressures.push(pressure);
    }
    state.drawing.lastInputPoint = new Vec2(point);
    updateDraft(runtime);
  };

  const updateDraft = (runtime: ToolRuntime): void => {
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
    const nextBounds = getStrokePreviewBounds(
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
    const minPointCount = state.drawing.stroke.brushId === "spray" ? 1 : 2;
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
      state.drawing = null;
      state.lastPreviewSegmentBounds = null;
    }
    runtime.clearDraft();
    runtime.setPreview(null);
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
        runtime.clearDraft();
        runtime.setPreview(null);
      };
    },
  };
}

function appendSpraySegment(draft: StrokeDraftState, point: Vec2): void {
  const from = draft.lastInputPoint;
  if (!from) {
    draft.lastInputPoint = new Vec2(point);
    appendSprayCluster(draft, point, 1);
    return;
  }
  const segment = new Vec2().add(point).sub(from);
  const distance = Vec2.length(segment);
  if (distance <= 0) {
    return;
  }
  const spacing = Math.max(0.75, draft.stroke.size * SPRAY_SPACING_SCALE);
  const clusterDotCount = Math.max(
    1,
    Math.round(draft.stroke.size * SPRAY_DOTS_PER_CLUSTER_SCALE),
  );
  const direction = new Vec2().add(segment).mul([1 / distance, 1 / distance]);
  let traveled = 0;
  let remainder = draft.sprayDistanceRemainder;

  while (remainder + (distance - traveled) >= spacing) {
    const step = spacing - remainder;
    traveled += step;
    const samplePoint = new Vec2().add(from).add(
      new Vec2().add(direction).mul([traveled, traveled]),
    );
    appendSprayCluster(draft, samplePoint, clusterDotCount);
    remainder = 0;
  }

  draft.sprayDistanceRemainder = remainder + (distance - traveled);
  draft.lastInputPoint = new Vec2(point);
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

function getStrokePreviewBounds(
  points: Array<[number, number]>,
  strokeSize: number,
  brushId?: string,
): Box | null {
  const previewPoints =
    brushId === "spray" ? points.slice(-64) : points.slice(-6);
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
    geometry: {
      type: "pen",
      points: localPoints,
      ...(draft.geometry.pressures
        ? { pressures: draft.geometry.pressures }
        : {}),
    },
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

function createPreviewStrokeShape(draft: StrokeDraftState): PenShape | undefined {
  if (!draft.geometry.points.length) {
    return undefined;
  }
  return {
    id: draft.id,
    type: "pen",
    geometry: {
      type: "pen",
      points: draft.geometry.points,
      ...(draft.geometry.pressures
        ? { pressures: draft.geometry.pressures }
        : {}),
    },
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
