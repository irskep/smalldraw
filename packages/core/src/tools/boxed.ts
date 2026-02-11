import { BoxOperations, toVec2, toVec2Like } from "@smalldraw/geometry";
import { Vec2 } from "gl-matrix";
import { AddShape } from "../actions";
import type {
  BoxedGeometry,
  BoxedShape,
  BoxedShapeKind,
} from "../model/shapes/boxedShape";
import type { Fill, StrokeStyle } from "../model/style";
import { createDisposerBucket, type DisposerBucket } from "./disposerBucket";
import { attachPointerHandlers } from "./pointerHandlers";
import type { ToolDefinition, ToolEventHandler, ToolRuntime } from "./types";

interface BoxedDraftState {
  id: string;
  start: Vec2;
  current: Vec2;
  kind: BoxedShapeKind;
  style: {
    stroke: StrokeStyle;
    fill: Fill;
  };
  zIndex: string;
}

interface ActiveBoxedState {
  draft: BoxedDraftState | null;
  disposers: DisposerBucket;
}

const runtimeState = new WeakMap<ToolRuntime, ActiveBoxedState>();

export interface BoxedToolOptions {
  stroke?: StrokeStyle;
  fill?: Fill;
}

export interface CreateBoxedToolOptions {
  id: string;
  label: string;
  kind: BoxedShapeKind;
  draftIdPrefix: string;
  shapeIdPrefix: string;
  runtimeOptions?: BoxedToolOptions;
}

function computeSizeAndCenter(
  start: Vec2,
  current: Vec2,
): { center: Vec2; size: Vec2 } {
  const bounds = BoxOperations.fromPointPair(start, current);
  const boxOpts = new BoxOperations(bounds);
  return {
    center: boxOpts.center,
    size: toVec2(boxOpts.translate(new Vec2(bounds.min).mul(new Vec2(-1))).max),
  };
}

export function createBoxedTool(
  options: CreateBoxedToolOptions,
): ToolDefinition {
  const ensureState = (runtime: ToolRuntime): ActiveBoxedState => {
    let state = runtimeState.get(runtime);
    if (!state) {
      state = { draft: null, disposers: createDisposerBucket() };
      runtimeState.set(runtime, state);
    }
    return state;
  };

  const resolveStroke = (runtime: ToolRuntime): StrokeStyle => {
    const runtimeOptions = runtime.getOptions<BoxedToolOptions>();
    const shared = runtime.getSharedSettings();
    const override = runtimeOptions?.stroke ?? options.runtimeOptions?.stroke;
    return {
      type: "brush",
      color: override?.color ?? shared.strokeColor,
      size: override?.size ?? shared.strokeWidth,
      ...(override?.brushId ? { brushId: override.brushId } : {}),
      compositeOp: override?.compositeOp ?? "source-over",
    } satisfies StrokeStyle;
  };

  const resolveFill = (runtime: ToolRuntime): Fill => {
    const runtimeOptions = runtime.getOptions<BoxedToolOptions>();
    const override = runtimeOptions?.fill ?? options.runtimeOptions?.fill;
    return (
      override ?? {
        type: "solid",
        color: runtime.getSharedSettings().fillColor,
      }
    );
  };

  const updateDraft = (runtime: ToolRuntime) => {
    const state = runtimeState.get(runtime);
    if (!state?.draft) return;
    const { center, size } = computeSizeAndCenter(
      state.draft.start,
      state.draft.current,
    );
    const geometry: BoxedGeometry = {
      type: "boxed",
      kind: state.draft.kind,
      size: toVec2Like(size),
    };
    runtime.setDraft({
      toolId: runtime.toolId,
      temporary: true,
      id: state.draft.id,
      type: "boxed",
      geometry,
      style: {
        stroke: state.draft.style.stroke,
        fill: state.draft.style.fill,
      },
      zIndex: state.draft.zIndex,
      layerId: "default",
      temporalOrder: 0,
      interactions: {
        resizable: true,
        rotatable: true,
      },
      transform: {
        translation: toVec2Like(center),
        scale: toVec2Like(new Vec2(1, 1)),
        rotation: 0,
      },
    });
  };

  const beginShape = (runtime: ToolRuntime, point: Vec2, pressure?: number) => {
    const state = ensureState(runtime);
    const draft: BoxedDraftState = {
      id: runtime.generateShapeId(options.draftIdPrefix),
      start: point,
      current: point,
      kind: options.kind,
      style: {
        stroke: resolveStroke(runtime),
        fill: resolveFill(runtime),
      },
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
    updateDraft(runtime);
  };

  const commitShape = (runtime: ToolRuntime) => {
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
    const shape: BoxedShape = {
      id: runtime.generateShapeId(options.shapeIdPrefix),
      type: "boxed",
      geometry: {
        type: "boxed",
        kind: state.draft.kind,
        size: toVec2Like(size),
      },
      style: {
        stroke: state.draft.style.stroke,
        fill: state.draft.style.fill,
      },
      zIndex: state.draft.zIndex,
      layerId: "default",
      temporalOrder: 0,
      interactions: {
        resizable: true,
        rotatable: true,
      },
      transform: {
        translation: toVec2Like(center),
        scale: toVec2Like(new Vec2(1, 1)),
        rotation: 0,
      },
    };
    runtime.commit(new AddShape(shape));
    runtime.clearDraft();
    state.draft = null;
  };

  const cancelShape = (runtime: ToolRuntime) => {
    const state = runtimeState.get(runtime);
    if (state) {
      state.draft = null;
    }
    runtime.clearDraft();
  };

  const createPointerDownHandler = (runtime: ToolRuntime): ToolEventHandler => {
    return (event) => {
      if ((event.buttons ?? 1) & 1) {
        beginShape(runtime, event.point, event.pressure);
      }
    };
  };

  const createPointerMoveHandler = (runtime: ToolRuntime): ToolEventHandler => {
    return (event) => updatePoint(runtime, event.point, event.pressure);
  };

  const createPointerUpHandler = (runtime: ToolRuntime): ToolEventHandler => {
    return () => commitShape(runtime);
  };

  const createPointerCancelHandler = (
    runtime: ToolRuntime,
  ): ToolEventHandler => {
    return () => cancelShape(runtime);
  };

  return {
    id: options.id,
    label: options.label,
    styleSupport: {
      strokeColor: true,
      strokeWidth: true,
      fillColor: true,
    },
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
