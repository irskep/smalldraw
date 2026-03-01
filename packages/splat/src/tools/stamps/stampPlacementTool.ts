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
  scale: number;
  scaleDistance: number;
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
const STAMP_MIN_DRAG_DISTANCE = 4;
const STAMP_MIN_SCALE = 0.15;

export function createStampPlacementTool(
  options: CreateStampPlacementToolOptions,
): ToolDefinition {
  const stampAtPoint = (
    runtime: ToolRuntime,
    point: Vec2,
    rotation: number,
    scale: number,
    zIndex: string,
  ): void => {
    const stroke = options.resolveStroke(runtime);
    const shape = options.createShape({
      id: runtime.generateShapeId(options.shapeIdPrefix),
      point,
      zIndex,
      stroke,
      rotation,
      scale,
      runtime,
    });
    runtime.commit(new AddShape(shape));
  };

  const getScaleDistance = (shape: AnyShape): number => {
    const stampShape = shape as AnyShape & {
      geometry?: { type?: string; width?: number; height?: number };
    };
    if (
      stampShape.type === "stamp" &&
      stampShape.geometry?.type === "stamp" &&
      typeof stampShape.geometry.width === "number" &&
      typeof stampShape.geometry.height === "number"
    ) {
      return Math.max(
        12,
        Math.max(stampShape.geometry.width, stampShape.geometry.height) / 2,
      );
    }
    return 24;
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
              const scaleDistance = getScaleDistance(draftShape);

              active = {
                point: event.point,
                draftId,
                zIndex,
                rotation: 0,
                scale: 1,
                scaleDistance,
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
            if (distance >= STAMP_MIN_DRAG_DISTANCE) {
              active.rotation = Math.atan2(getY(dragDelta), getX(dragDelta));
              active.scale = Math.max(
                STAMP_MIN_SCALE,
                distance / active.scaleDistance,
              );
            } else {
              active.rotation = 0;
              active.scale = 1;
            }
            const stroke = options.resolveStroke(runtime);
            const draftShape = options.createShape({
              id: active.draftId,
              point: active.point,
              zIndex: active.zIndex,
              stroke,
              rotation: active.rotation,
              scale: active.scale,
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
            stampAtPoint(
              runtime,
              active.point,
              active.rotation,
              active.scale,
              active.zIndex,
            );
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
