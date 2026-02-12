import {
  AddShape,
  type AnyShape,
  attachPointerHandlers,
  createDisposerBucket,
  type StrokeStyle,
  type ToolDefinition,
  type ToolRuntime,
} from "@smalldraw/core";
import type { Vec2 } from "gl-matrix";

interface ActiveStampState {
  point: Vec2;
  draftId: string;
}

export interface CreateStampPlacementToolOptions {
  id: string;
  label: string;
  shapeIdPrefix: string;
  styleSupport: ToolDefinition["styleSupport"];
  createShape(params: {
    id: string;
    point: Vec2;
    zIndex: string;
    stroke: StrokeStyle;
    runtime: ToolRuntime;
  }): AnyShape;
  resolveStroke(runtime: ToolRuntime): StrokeStyle;
}

const PRIMARY_BUTTON_MASK = 1;

export function createStampPlacementTool(
  options: CreateStampPlacementToolOptions,
): ToolDefinition {
  const stampAtPoint = (runtime: ToolRuntime, point: Vec2): void => {
    const stroke = options.resolveStroke(runtime);
    const shape = options.createShape({
      id: runtime.generateShapeId(options.shapeIdPrefix),
      point,
      zIndex: runtime.getNextZIndex(),
      stroke,
      runtime,
    });
    runtime.commit(new AddShape(shape));
  };

  return {
    id: options.id,
    label: options.label,
    styleSupport: options.styleSupport,
    activate(runtime) {
      const disposers = createDisposerBucket();
      let active: ActiveStampState | null = null;

      disposers.add(
        attachPointerHandlers(runtime, {
          onPointerDown(event) {
            if ((event.buttons ?? PRIMARY_BUTTON_MASK) & PRIMARY_BUTTON_MASK) {
              const stroke = options.resolveStroke(runtime);
              const draftId = runtime.generateShapeId(
                `${options.shapeIdPrefix}-draft`,
              );
              const draftShape = options.createShape({
                id: draftId,
                point: event.point,
                zIndex: runtime.getNextZIndex(),
                stroke,
                runtime,
              });

              active = {
                point: event.point,
                draftId,
              };
              runtime.setDraft({
                ...draftShape,
                toolId: runtime.toolId,
                temporary: true,
              });
            }
          },
          onPointerMove(event) {
            if (!active) {
              return;
            }
            active.point = event.point;
            const stroke = options.resolveStroke(runtime);
            const draftShape = options.createShape({
              id: active.draftId,
              point: event.point,
              zIndex: runtime.getNextZIndex(),
              stroke,
              runtime,
            });
            runtime.setDraft({
              ...draftShape,
              toolId: runtime.toolId,
              temporary: true,
            });
          },
          onPointerUp() {
            if (!active) {
              runtime.clearDraft();
              return;
            }
            stampAtPoint(runtime, active.point);
            active = null;
            runtime.clearDraft();
          },
          onPointerCancel() {
            active = null;
            runtime.clearDraft();
          },
        }),
      );

      return () => {
        active = null;
        runtime.clearDraft();
        disposers.dispose();
      };
    },
  };
}
