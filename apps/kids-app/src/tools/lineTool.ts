import {
  AddShape,
  attachPointerHandlers,
  createDisposerBucket,
  createPenJSONGeometry,
  type PenShape,
  type StrokeStyle,
  type ToolDefinition,
  type ToolRuntime,
} from "@smalldraw/core";
import { toVec2Like } from "@smalldraw/geometry";
import { Vec2 } from "gl-matrix";

interface ActiveLineDraft {
  id: string;
  start: Vec2;
  current: Vec2;
  stroke: StrokeStyle;
  zIndex: string;
}

interface LineToolState {
  draft: ActiveLineDraft | null;
}

const runtimeState = new WeakMap<ToolRuntime, LineToolState>();

export interface LineToolOptions {
  stroke?: StrokeStyle;
}

const DEFAULT_LINE_BRUSH_ID = "marker";

function ensureState(runtime: ToolRuntime): LineToolState {
  let state = runtimeState.get(runtime);
  if (!state) {
    state = { draft: null };
    runtimeState.set(runtime, state);
  }
  return state;
}

function resolveStroke(
  runtime: ToolRuntime,
  options?: LineToolOptions,
): StrokeStyle {
  const runtimeOptions = runtime.getOptions<LineToolOptions>();
  const shared = runtime.getSharedSettings();
  const override = runtimeOptions?.stroke ?? options?.stroke;
  return {
    type: "brush",
    color: override?.color ?? shared.strokeColor,
    size: override?.size ?? shared.strokeWidth,
    brushId: override?.brushId ?? DEFAULT_LINE_BRUSH_ID,
    compositeOp: override?.compositeOp ?? "source-over",
  } satisfies StrokeStyle;
}

function buildLineShape(params: {
  id: string;
  start: Vec2;
  end: Vec2;
  stroke: StrokeStyle;
  zIndex: string;
  draft: boolean;
}): PenShape | null {
  const start = new Vec2(params.start);
  const end = new Vec2(params.end);
  const distance = Vec2.distance(start, end);
  if (!params.draft && distance <= 0) {
    return null;
  }

  if (params.draft) {
    return {
      id: params.id,
      type: "pen",
      geometry: createPenJSONGeometry([toVec2Like(start), toVec2Like(end)]),
      style: { stroke: params.stroke },
      zIndex: params.zIndex,
      layerId: "default",
      temporalOrder: 0,
      interactions: {
        resizable: true,
        rotatable: true,
      },
      transform: {
        translation: [0, 0],
        scale: [1, 1],
        rotation: 0,
      },
    };
  }

  const center = new Vec2().add(start).add(end).mul([0.5, 0.5]);
  return {
    id: params.id,
    type: "pen",
    geometry: createPenJSONGeometry([
      toVec2Like(new Vec2(start).sub(center)),
      toVec2Like(new Vec2(end).sub(center)),
    ]),
    style: { stroke: params.stroke },
    zIndex: params.zIndex,
    layerId: "default",
    temporalOrder: 0,
    interactions: {
      resizable: true,
      rotatable: true,
    },
    transform: {
      translation: toVec2Like(center),
      scale: [1, 1],
      rotation: 0,
    },
  };
}

export function createLineTool(options?: LineToolOptions): ToolDefinition {
  return {
    id: "line",
    label: "Line",
    styleSupport: {
      strokeColor: true,
      strokeWidth: true,
      fillColor: false,
      transparentStrokeColor: false,
      transparentFillColor: false,
    },
    activate(runtime) {
      const state = ensureState(runtime);
      const disposers = createDisposerBucket();
      state.draft = null;

      disposers.add(
        attachPointerHandlers(runtime, {
          onPointerDown(event) {
            if ((event.buttons ?? 1) !== 1) {
              return;
            }
            const stroke = resolveStroke(runtime, options);
            const start = new Vec2(event.point);
            state.draft = {
              id: runtime.generateShapeId("line-draft"),
              start,
              current: start,
              stroke,
              zIndex: runtime.getNextZIndex(),
            };
            const draftShape = buildLineShape({
              id: state.draft.id,
              start,
              end: start,
              stroke,
              zIndex: state.draft.zIndex,
              draft: true,
            });
            if (draftShape) {
              runtime.setDraft({
                ...draftShape,
                toolId: runtime.toolId,
                temporary: true,
              });
            }
          },
          onPointerMove(event) {
            if (!state.draft) {
              return;
            }
            state.draft.current = new Vec2(event.point);
            const draftShape = buildLineShape({
              id: state.draft.id,
              start: state.draft.start,
              end: state.draft.current,
              stroke: state.draft.stroke,
              zIndex: state.draft.zIndex,
              draft: true,
            });
            if (!draftShape) {
              runtime.clearDraft();
              return;
            }
            runtime.setDraft({
              ...draftShape,
              toolId: runtime.toolId,
              temporary: true,
            });
          },
          onPointerUp() {
            if (!state.draft) {
              runtime.clearDraft();
              return;
            }
            const committed = buildLineShape({
              id: runtime.generateShapeId("line"),
              start: state.draft.start,
              end: state.draft.current,
              stroke: state.draft.stroke,
              zIndex: state.draft.zIndex,
              draft: false,
            });
            if (committed) {
              runtime.commit(new AddShape(committed));
            }
            state.draft = null;
            runtime.clearDraft();
          },
          onPointerCancel() {
            state.draft = null;
            runtime.clearDraft();
          },
        }),
      );

      return () => {
        state.draft = null;
        runtime.clearDraft();
        disposers.dispose();
      };
    },
  };
}
