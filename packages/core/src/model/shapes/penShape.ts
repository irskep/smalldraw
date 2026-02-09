import {
  BoxOperations,
  getX,
  getY,
  toVec2,
  toVec2Like,
  type Vec2Tuple,
} from "@smalldraw/geometry";
import { Vec2 } from "gl-matrix";
import { getPenStrokeBounds } from "../penStroke";
import type { AnyShape, Shape } from "../shape";
import { getPointFromLayout, type ShapeHandler } from "../shapeTypes";
import { getHitTestBounds } from "./hitTestUtils";

export interface PenGeometry {
  type: "pen";
  points: Vec2Tuple[];
  pressures?: number[]; // same length as points
}

export type PenShape = Shape & { geometry: PenGeometry };

export const PenShapeHandler: ShapeHandler<PenGeometry, unknown> = {
  geometry: {
    getBounds: (shape: PenShape) =>
      getPenStrokeBounds(shape) ??
      BoxOperations.fromPointArray(shape.geometry.points),
    canonicalize(shape: PenShape, center) {
      return {
        ...shape.geometry,
        points: shape.geometry.points.map((pt) =>
          toVec2Like(new Vec2().add(toVec2(pt)).sub(center)),
        ),
      };
    },
  },
  shape: {
    hitTest(shape: PenShape, point: Vec2) {
      const localBounds =
        getPenStrokeBounds(shape) ??
        BoxOperations.fromPointArray(shape.geometry.points);
      const bounds = getHitTestBounds(shape, localBounds);
      return new BoxOperations(bounds).containsPoint(point);
    },
  },
  selection: {
    canResize: (shape) => shape.interactions?.resizable !== false,
    prepareResize: (shape: PenShape) => {
      const g = shape.geometry;
      return {
        geometry: {
          type: "pen",
          points: g.points,
          pressures: g.pressures,
        },
      };
    },
    resize({ selectionScale, nextBounds, layout, transform }) {
      const translation = layout
        ? toVec2Like(getPointFromLayout(layout, nextBounds))
        : transform.translation;
      return {
        transform: {
          ...transform,
          translation,
          scale: toVec2Like(
            new Vec2(getX(transform.scale), getY(transform.scale)).mul(
              selectionScale,
            ),
          ),
        },
      };
    },
    supportsAxisResize: () => false,
  },
  serialization: {
    toJSON(shape: PenShape) {
      return {
        ...shape,
        geometry: {
          type: "pen",
          points: shape.geometry.points,
          ...(shape.geometry.pressures
            ? { pressures: shape.geometry.pressures }
            : {}),
        },
        ...(shape.transform
          ? {
              transform: shape.transform,
            }
          : {}),
      };
    },
    fromJSON(shape: AnyShape) {
      const penShape = shape as PenShape;
      return {
        ...penShape,
        geometry: {
          type: "pen",
          points: penShape.geometry.points,
          ...(penShape.geometry.pressures
            ? { pressures: penShape.geometry.pressures }
            : {}),
        },
        ...(penShape.transform
          ? {
              transform: penShape.transform,
            }
          : {}),
      };
    },
  },
};
