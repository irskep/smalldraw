import {
  BoxOperations,
  type PenGeometry,
  toVec2,
  toVec2Like,
} from "@smalldraw/geometry";
import { Vec2 } from "gl-matrix";
import { AddShape } from "../actions";
import type { PenShape } from "../model/shapes/penShape";
import type { StrokeStyle } from "../model/style";
import { createDisposerBucket, type DisposerBucket } from "./disposerBucket";
import { attachPointerHandlers } from "./pointerHandlers";
import type { ToolDefinition, ToolEventHandler, ToolRuntime } from "./types";

const PRIMARY_BUTTON_MASK = 1;

interface ActivePenState {
  drawing: StrokeDraftState | null;
  disposers: DisposerBucket;
}

interface StrokeDraftState {
  id: string;
  geometry: PenGeometry;
  stroke: StrokeStyle;
  zIndex: string;
}

const runtimeState = new WeakMap<ToolRuntime, ActivePenState>();

export interface PenToolOptions {
  stroke?: StrokeStyle;
}

export function createPenTool(options?: PenToolOptions): ToolDefinition {
  const fallbackStroke: StrokeStyle =
    options?.stroke ??
    ({
      type: "brush",
      color: "#000000",
      size: 2,
    } as const);

  const ensureState = (runtime: ToolRuntime): ActivePenState => {
    let state = runtimeState.get(runtime);
    if (!state) {
      state = { drawing: null, disposers: createDisposerBucket() };
      runtimeState.set(runtime, state);
    }
    return state;
  };

  const resolveStroke = (runtime: ToolRuntime): StrokeStyle => {
    const runtimeOptions = runtime.getOptions<PenToolOptions>();
    const shared = runtime.getSharedSettings();
    const override = runtimeOptions?.stroke ?? options?.stroke;
    return {
      type: "brush",
      color: override?.color ?? shared.strokeColor ?? fallbackStroke.color,
      size: override?.size ?? shared.strokeWidth ?? fallbackStroke.size,
      ...(override?.brushId ?? fallbackStroke.brushId
        ? { brushId: override?.brushId ?? fallbackStroke.brushId }
        : {}),
    } satisfies StrokeStyle;
  };

  const beginDrawing = (
    runtime: ToolRuntime,
    point: Vec2,
    pressure?: number,
  ) => {
    const state = ensureState(runtime);
    if (state.drawing) {
      finishStroke(runtime);
    }
    const draftId = runtime.generateShapeId("pen-draft");
    const zIndex = runtime.getNextZIndex();
    state.drawing = {
      id: draftId,
      geometry: {
        type: "pen",
        points: [toVec2Like(point)],
        pressures: pressure ? [pressure] : undefined,
      },
      stroke: resolveStroke(runtime),
      zIndex,
    };
    updateDraft(runtime);
  };

  const appendPoint = (
    runtime: ToolRuntime,
    point: Vec2,
    pressure?: number,
  ) => {
    const state = runtimeState.get(runtime);
    if (!state?.drawing) return;
    state.drawing.geometry.points.push(toVec2Like(point));
    if (state.drawing.geometry.pressures && pressure)
      state.drawing.geometry.pressures.push(pressure);
    updateDraft(runtime);
  };

  const updateDraft = (runtime: ToolRuntime) => {
    const state = runtimeState.get(runtime);
    if (!state?.drawing) return;
    const draftShape = createStrokeShape(state.drawing) ?? null;
    if (draftShape) {
      runtime.setDraft({
        ...draftShape,
        toolId: runtime.toolId,
        temporary: true,
      });
    } else {
      runtime.clearDraft();
    }
  };

  const finishStroke = (runtime: ToolRuntime) => {
    const state = runtimeState.get(runtime);
    if (!state?.drawing) {
      runtime.clearDraft();
      return;
    }
    if (state.drawing.geometry.points.length < 2) {
      runtime.clearDraft();
      state.drawing = null;
      return;
    }
    const shape = createStrokeShape(state.drawing);
    if (shape) {
      shape.id = runtime.generateShapeId("pen");
      runtime.commit(new AddShape(shape));
    }
    runtime.clearDraft();
    state.drawing = null;
  };

  const cancelStroke = (runtime: ToolRuntime) => {
    const state = runtimeState.get(runtime);
    if (state) {
      state.drawing = null;
    }
    runtime.clearDraft();
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
    id: "pen",
    label: "Pen",
    activate(runtime) {
      const state = ensureState(runtime);
      state.disposers.dispose();
      state.drawing = null;
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
      };
    },
  };
}
const createStrokeShape = (draft: StrokeDraftState): PenShape | undefined => {
  const bounds = BoxOperations.fromPointArray(draft.geometry.points);
  if (!bounds) return undefined;
  const boxOps = new BoxOperations(bounds);
  const center = boxOps.center;
  const localPoints = draft.geometry.points.map((pt) =>
    toVec2Like(new Vec2().add(toVec2(pt)).sub(center)),
  );
  const shape: PenShape = {
    id: draft.id,
    type: "pen",
    geometry: {
      type: "pen",
      points: localPoints,
      ...(draft.geometry.pressures && { pressures: draft.geometry.pressures }),
    },
    stroke: draft.stroke,
    zIndex: draft.zIndex,
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
  return shape;
};
