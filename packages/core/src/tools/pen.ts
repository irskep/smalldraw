import { AddShape } from '../actions';
import type { Point } from '../model/primitives';
import type { Shape } from '../model/shape';
import type { StrokeStyle } from '../model/style';
import type { ToolDefinition, ToolEventHandler, ToolRuntime } from './types';
import { attachPointerHandlers } from './pointerHandlers';

const PRIMARY_BUTTON_MASK = 1;

interface ActivePenState {
  drawing: StrokeDraftState | null;
  disposers: Array<() => void>;
}

interface StrokeDraftState {
  id: string;
  points: Point[];
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
    (
      {
        type: 'brush',
        color: '#000000',
        size: 2,
      } as const
    );

  const ensureState = (runtime: ToolRuntime): ActivePenState => {
    let state = runtimeState.get(runtime);
    if (!state) {
      state = { drawing: null, disposers: [] };
      runtimeState.set(runtime, state);
    }
    return state;
  };

  const resolveStroke = (runtime: ToolRuntime): StrokeStyle => {
    const runtimeOptions = runtime.getOptions<PenToolOptions>();
    const shared = runtime.getSharedSettings();
    const override = runtimeOptions?.stroke ?? options?.stroke;
    return {
      type: 'brush',
      color: override?.color ?? shared.strokeColor ?? fallbackStroke.color,
      size: override?.size ?? shared.strokeWidth ?? fallbackStroke.size,
      brushId: override?.brushId ?? fallbackStroke.brushId,
    } satisfies StrokeStyle;
  };

  const beginDrawing = (
    runtime: ToolRuntime,
    point: Point,
    pressure?: number,
  ) => {
    const state = ensureState(runtime);
    if (state.drawing) {
      finishStroke(runtime);
    }
    const draftId = runtime.generateShapeId('pen-draft');
    const zIndex = runtime.getNextZIndex();
    state.drawing = {
      id: draftId,
      points: [{ ...point, pressure }],
      stroke: resolveStroke(runtime),
      zIndex,
    };
    updateDraft(runtime);
  };

  const appendPoint = (
    runtime: ToolRuntime,
    point: Point,
    pressure?: number,
  ) => {
    const state = runtimeState.get(runtime);
    if (!state?.drawing) return;
    state.drawing.points.push({ ...point, pressure });
    updateDraft(runtime);
  };

  const updateDraft = (runtime: ToolRuntime) => {
    const state = runtimeState.get(runtime);
    if (!state?.drawing) return;
    const draftShape = createStrokeShape(state.drawing);
    runtime.setDraft({
      ...draftShape,
      toolId: runtime.toolId,
      temporary: true,
    });
  };

  const finishStroke = (runtime: ToolRuntime) => {
    const state = runtimeState.get(runtime);
    if (!state?.drawing) {
      runtime.clearDraft();
      return;
    }
    if (state.drawing.points.length < 2) {
      runtime.clearDraft();
      state.drawing = null;
      return;
    }
    const shape = createStrokeShape(state.drawing);
    shape.id = runtime.generateShapeId('pen');
    runtime.commit(new AddShape(shape));
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

  const createPointerDownHandler = (
    runtime: ToolRuntime,
  ): ToolEventHandler => {
    return (event) => {
      if ((event.buttons ?? PRIMARY_BUTTON_MASK) & PRIMARY_BUTTON_MASK) {
        beginDrawing(runtime, event.point, event.pressure);
      }
    };
  };

  const createPointerMoveHandler = (
    runtime: ToolRuntime,
  ): ToolEventHandler => {
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
    id: 'pen',
    label: 'Pen',
    activate(runtime) {
      const state = ensureState(runtime);
      state.disposers.forEach((dispose) => dispose());
      state.disposers = [];
      state.drawing = null;
      state.disposers.push(
        attachPointerHandlers(runtime, {
          onPointerDown: createPointerDownHandler(runtime),
          onPointerMove: createPointerMoveHandler(runtime),
          onPointerUp: createPointerUpHandler(runtime),
          onPointerCancel: createPointerCancelHandler(runtime),
        }),
      );
      runtime.clearDraft();
    },
    deactivate(runtime) {
      const state = runtimeState.get(runtime);
      if (state) {
        state.disposers.forEach((dispose) => dispose());
        state.disposers = [];
        state.drawing = null;
      }
      runtime.clearDraft();
    },
  };
}
  const createStrokeShape = (draft: StrokeDraftState): Shape => {
    const bounds = calculateBounds(draft.points);
    const center = bounds
      ? {
          x: (bounds.minX + bounds.maxX) / 2,
          y: (bounds.minY + bounds.maxY) / 2,
        }
      : { x: 0, y: 0 };
    const localPoints = bounds
      ? draft.points.map((pt) => ({ x: pt.x - center.x, y: pt.y - center.y, pressure: pt.pressure }))
      : draft.points.map((pt) => ({ ...pt }));
    const geometry = {
      type: 'pen' as const,
      points: localPoints,
    };
    const shape: Shape = {
      id: draft.id,
      geometry,
      stroke: draft.stroke,
      zIndex: draft.zIndex,
      interactions: {
        resizable: true,
        rotatable: false,
      },
      transform: {
        translation: center,
        scale: { x: 1, y: 1 },
        rotation: 0,
      },
    };
    return shape;
  };

  const calculateBounds = (points: Point[]) => {
    if (!points.length) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const pt of points) {
      minX = Math.min(minX, pt.x);
      minY = Math.min(minY, pt.y);
      maxX = Math.max(maxX, pt.x);
      maxY = Math.max(maxY, pt.y);
    }
    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
      return null;
    }
    return { minX, minY, maxX, maxY };
  };
