import { BoxOperations, type RectGeometry } from "@smalldraw/geometry";
import { Vec2 } from "gl-matrix";
import { AddShape } from "../actions";
import type { RectShape } from "../model/shapes/rectShape";
import type { Fill, StrokeStyle } from "../model/style";
import { createDisposerBucket, type DisposerBucket } from "./disposerBucket";
import { attachPointerHandlers } from "./pointerHandlers";
import type { ToolDefinition, ToolEventHandler, ToolRuntime } from "./types";

interface RectDraftState {
  id: string;
  start: Vec2;
  current: Vec2;
  pressures?: number[];
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

function computeSizeAndCenter(
  start: Vec2,
  current: Vec2,
): { center: Vec2; size: Vec2 } {
  const bounds = BoxOperations.fromPointPair(start, current);
  const boxOpts = new BoxOperations(bounds);
  return {
    center: boxOpts.center,
    size: boxOpts.translate(new Vec2(bounds.min).mul(new Vec2(-1))).max,
  };
}

export function createRectangleTool(
  options?: RectangleToolOptions,
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

  const beginRect = (runtime: ToolRuntime, point: Vec2, pressure?: number) => {
    const state = ensureState(runtime);
    const draft: RectDraftState = {
      id: runtime.generateShapeId("rect-draft"),
      start: point,
      current: point,
      pressures: pressure ? [pressure] : undefined,
      stroke: resolveStroke(runtime),
      fill: resolveFill(runtime),
      zIndex: runtime.getNextZIndex(),
    };
    state.draft = draft;
    updateDraft(runtime);
  };

  const updatePoint = (
    runtime: ToolRuntime,
    point: Vec2,
    pressure?: number,
  ) => {
    const state = runtimeState.get(runtime);
    if (!state?.draft) return;
    state.draft.current = point;
    if (state.draft.pressures && pressure) state.draft.pressures.push(pressure);
    updateDraft(runtime);
  };

  const updateDraft = (runtime: ToolRuntime) => {
    const state = runtimeState.get(runtime);
    if (!state?.draft) return;
    const { center, size } = computeSizeAndCenter(
      state.draft.start,
      state.draft.current,
    );
    const geometry: RectGeometry = {
      type: "rect",
      size,
    };
    runtime.setDraft({
      toolId: runtime.toolId,
      temporary: true,
      id: state.draft.id,
      type: "rect",
      geometry,
      stroke: state.draft.stroke,
      fill: state.draft.fill,
      zIndex: state.draft.zIndex,
      interactions: {
        resizable: true,
        rotatable: true,
      },
      transform: {
        translation: center,
        scale: new Vec2(1),
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
      state.draft.current,
    );
    if (size.x === 0 && size.y === 0) {
      runtime.clearDraft();
      state.draft = null;
      return;
    }
    const shape: RectShape = {
      id: runtime.generateShapeId("rect"),
      type: "rect",
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
        scale: new Vec2(1),
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
    runtime: ToolRuntime,
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
        }),
      );
      return () => {
        state.disposers.dispose();
        runtime.clearDraft();
      };
    },
  };
}
