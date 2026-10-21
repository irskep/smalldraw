import {
  AddShape,
  type AnyShape,
  attachPointerHandlers,
  createDisposerBucket,
  type StrokeStyle,
  type ToolDefinition,
  type ToolRuntime,
} from "@smalldraw/core";
import { getX, getY } from "@smalldraw/geometry";
import { Vec2 } from "gl-matrix";

interface ActiveStampState {
  point: Vec2;
  draftId: string;
  zIndex: string;
  rotation: number;
  initialDragAngle: number | null;
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
    rotation: number;
    scale: number;
    runtime: ToolRuntime;
  }): AnyShape;
  resolveStroke(runtime: ToolRuntime): StrokeStyle;
}

const PRIMARY_BUTTON_MASK = 1;
const STAMP_MIN_DRAG_DISTANCE = 12;

export function createStampPlacementTool(
  options: CreateStampPlacementToolOptions,
): ToolDefinition {
  const stampAtPoint = (
    runtime: ToolRuntime,
    point: Vec2,
    rotation: number,
    zIndex: string,
  ): void => {
    const stroke = options.resolveStroke(runtime);
    const shape = options.createShape({
      id: runtime.generateShapeId(options.shapeIdPrefix),
      point,
      zIndex,
      stroke,
      rotation,
      scale: 1,
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
              const zIndex = runtime.getNextZIndexInLayer();
              const draftId = runtime.generateShapeId(
                `${options.shapeIdPrefix}-draft`,
              );
              const draftShape = options.createShape({
                id: draftId,
                point: event.point,
                zIndex,
                stroke,
                rotation: 0,
                scale: 1,
                runtime,
              });

              active = {
                point: event.point,
                draftId,
                zIndex,
                rotation: 0,
                initialDragAngle: null,
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
            const dragDelta = new Vec2().add(event.point).sub(active.point);
            const distance = Vec2.length(dragDelta);
            if (distance < STAMP_MIN_DRAG_DISTANCE) return;
            const angle = Math.atan2(getY(dragDelta), getX(dragDelta));
            // Let the first deliberate drag choose the handle direction.
            // A straight outward drag never rotates or resizes the stamp.
            active.initialDragAngle ??= angle;
            const rotation = angle - active.initialDragAngle;
            active.rotation = Math.atan2(
              Math.sin(rotation),
              Math.cos(rotation),
            );
            const stroke = options.resolveStroke(runtime);
            const draftShape = options.createShape({
              id: active.draftId,
              point: active.point,
              zIndex: active.zIndex,
              stroke,
              rotation: active.rotation,
              scale: 1,
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
            stampAtPoint(runtime, active.point, active.rotation, active.zIndex);
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
