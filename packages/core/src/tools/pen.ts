import { AddShape } from '../actions';
import type { Point } from '../model/primitives';
import type { Shape } from '../model/shape';
import type { StrokeStyle } from '../model/style';
import type {
  ToolDefinition,
  ToolEventHandler,
  ToolRuntime,
} from './types';

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
    runtime.setDraft({
      toolId: runtime.toolId,
      temporary: true,
      id: state.drawing.id,
      geometry: {
        type: 'pen',
        points: state.drawing.points.map((pt) => ({ ...pt })),
      },
      stroke: state.drawing.stroke,
      zIndex: state.drawing.zIndex,
    });
  };

  const finishStroke = (runtime: ToolRuntime) => {
    const state = runtimeState.get(runtime);
    if (!state?.drawing) {
      runtime.clearDraft();
      return;
    }
    const { points, stroke, zIndex } = state.drawing;
    if (points.length < 2) {
      runtime.clearDraft();
      state.drawing = null;
      return;
    }
    const shape: Shape = {
      id: runtime.generateShapeId('pen'),
      geometry: {
        type: 'pen',
        points: points.map((pt) => ({ ...pt })),
      },
      stroke,
      zIndex,
      interactions: {
        resizable: false,
        rotatable: false,
      },
      transform: {
        translation: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
        rotation: 0,
      },
    };
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
      state.disposers.push(runtime.on('pointerDown', createPointerDownHandler(runtime)));
      state.disposers.push(runtime.on('pointerMove', createPointerMoveHandler(runtime)));
      state.disposers.push(runtime.on('pointerUp', createPointerUpHandler(runtime)));
      state.disposers.push(runtime.on('pointerCancel', createPointerCancelHandler(runtime)));
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
