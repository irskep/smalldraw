import { AddShape } from "../actions";
import type { Point, Size } from "../model/primitives";
import type { Shape } from "../model/shape";
import type { Fill, StrokeStyle } from "../model/style";
import type { ToolDefinition, ToolEventHandler, ToolRuntime } from "./types";
import { attachPointerHandlers } from "./pointerHandlers";
import { createDisposerBucket, type DisposerBucket } from "./disposerBucket";

interface RectDraftState {
  id: string;
  start: Point;
  current: Point;
  stroke: StrokeStyle;
  fill: Fill;
  zIndex: string;
}

interface ActiveRectState {
  draft: RectDraftState | null;
  disposers: DisposerBucket;
}

const runtimeState = new WeakMap<ToolRuntime, ActiveRectState>();

export interface RectangleToolOptions {
  stroke?: StrokeStyle;
  fill?: Fill;
}

export function createRectangleTool(
  options?: RectangleToolOptions
): ToolDefinition {
  const ensureState = (runtime: ToolRuntime): ActiveRectState => {
    let state = runtimeState.get(runtime);
    if (!state) {
      state = { draft: null, disposers: createDisposerBucket() };
      runtimeState.set(runtime, state);
    }
    return state;
  };

  const resolveStroke = (runtime: ToolRuntime): StrokeStyle => {
    const runtimeOptions = runtime.getOptions<RectangleToolOptions>();
    const shared = runtime.getSharedSettings();
    const override = runtimeOptions?.stroke ?? options?.stroke;
    return {
      type: "brush",
      color: override?.color ?? shared.strokeColor,
      size: override?.size ?? shared.strokeWidth,
      brushId: override?.brushId,
    } satisfies StrokeStyle;
  };

  const resolveFill = (runtime: ToolRuntime): Fill => {
    const runtimeOptions = runtime.getOptions<RectangleToolOptions>();
    const override = runtimeOptions?.fill ?? options?.fill;
    return (
      override ?? {
        type: "solid",
        color: runtime.getSharedSettings().fillColor,
      }
    );
  };

  const beginRect = (runtime: ToolRuntime, point: Point, pressure?: number) => {
    const state = ensureState(runtime);
    const draft: RectDraftState = {
      id: runtime.generateShapeId("rect-draft"),
      start: { ...point, pressure },
      current: { ...point, pressure },
      stroke: resolveStroke(runtime),
      fill: resolveFill(runtime),
      zIndex: runtime.getNextZIndex(),
    };
    state.draft = draft;
    updateDraft(runtime);
  };

  const updatePoint = (
    runtime: ToolRuntime,
    point: Point,
    pressure?: number
  ) => {
    const state = runtimeState.get(runtime);
    if (!state?.draft) return;
    state.draft.current = { ...point, pressure };
    updateDraft(runtime);
  };

  const computeSizeAndCenter = (start: Point, current: Point) => {
    const x1 = start.x;
    const y1 = start.y;
    const x2 = current.x;
    const y2 = current.y;
    const size: Size = {
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
    };
    const center = {
      x: (x1 + x2) / 2,
      y: (y1 + y2) / 2,
    };
    return { center, size };
  };

  const updateDraft = (runtime: ToolRuntime) => {
    const state = runtimeState.get(runtime);
    if (!state?.draft) return;
    const { center, size } = computeSizeAndCenter(
      state.draft.start,
      state.draft.current
    );
    runtime.setDraft({
      toolId: runtime.toolId,
      temporary: true,
      id: state.draft.id,
      geometry: {
        type: "rect",
        size,
      },
      stroke: state.draft.stroke,
      fill: state.draft.fill,
      zIndex: state.draft.zIndex,
      interactions: {
        resizable: true,
        rotatable: true,
      },
      transform: {
        translation: center,
        scale: { x: 1, y: 1 },
        rotation: 0,
      },
    });
  };

  const commitRect = (runtime: ToolRuntime) => {
    const state = runtimeState.get(runtime);
    if (!state?.draft) {
      runtime.clearDraft();
      return;
    }
    const { center, size } = computeSizeAndCenter(
      state.draft.start,
      state.draft.current
    );
    if (size.width === 0 && size.height === 0) {
      runtime.clearDraft();
      state.draft = null;
      return;
    }
    const shape: Shape = {
      id: runtime.generateShapeId("rect"),
      geometry: {
        type: "rect",
        size,
      },
      stroke: state.draft.stroke,
      fill: state.draft.fill,
      zIndex: state.draft.zIndex,
      interactions: {
        resizable: true,
        rotatable: true,
      },
      transform: {
        translation: center,
        scale: { x: 1, y: 1 },
        rotation: 0,
      },
    };
    runtime.commit(new AddShape(shape));
    runtime.clearDraft();
    state.draft = null;
  };

  const cancelRect = (runtime: ToolRuntime) => {
    const state = runtimeState.get(runtime);
    if (state) {
      state.draft = null;
    }
    runtime.clearDraft();
  };

  const createPointerDownHandler = (runtime: ToolRuntime): ToolEventHandler => {
    return (event) => {
      if ((event.buttons ?? 1) & 1) {
        beginRect(runtime, event.point, event.pressure);
      }
    };
  };

  const createPointerMoveHandler = (runtime: ToolRuntime): ToolEventHandler => {
    return (event) => updatePoint(runtime, event.point, event.pressure);
  };

  const createPointerUpHandler = (runtime: ToolRuntime): ToolEventHandler => {
    return () => commitRect(runtime);
  };

  const createPointerCancelHandler = (
    runtime: ToolRuntime
  ): ToolEventHandler => {
    return () => cancelRect(runtime);
  };

  return {
    id: "rect",
    label: "Rectangle",
    activate(runtime) {
      const state = ensureState(runtime);
      state.disposers.dispose();
      state.draft = null;
      state.disposers.add(
        attachPointerHandlers(runtime, {
          onPointerDown: createPointerDownHandler(runtime),
          onPointerMove: createPointerMoveHandler(runtime),
          onPointerUp: createPointerUpHandler(runtime),
          onPointerCancel: createPointerCancelHandler(runtime),
        })
      );
      return () => {
        state.disposers.dispose();
        runtime.clearDraft();
      };
    },
  };
}
