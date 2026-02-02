import {
  BoxOperations,
  getX,
  getY,
  toVec2Like,
  type Vec2Tuple,
} from "@smalldraw/geometry";
import { Mat2d, Vec2 } from "gl-matrix";
import { buildTransformMatrix } from "../geometryShapeUtils";
import type { AnyShape, Shape } from "../shape";
import { normalizeShapeTransform } from "../shape";
import { getPointFromLayout, type ShapeHandler } from "../shapeTypes";

export interface RectGeometry {
  type: "rect";
  size: Vec2Tuple;
}

export type RectShape = Shape & { geometry: RectGeometry };

// Rectangle - full featured with geometry, selection (including axis-resize)
export const RectShapeHandler: ShapeHandler<RectGeometry, unknown> = {
  geometry: {
    getBounds(shape: RectShape) {
      const g = shape.geometry;
      return BoxOperations.fromPointPair(
        new Vec2(-getX(g.size), -getY(g.size)).div(new Vec2(2)),
        new Vec2(getX(g.size), getY(g.size)).div(new Vec2(2)),
      );
    },
  },
  shape: {
    hitTest(shape: RectShape, point: Vec2) {
      const transform = normalizeShapeTransform(shape.transform);
      const matrix = buildTransformMatrix(transform);
      const inverse = Mat2d.invert(new Mat2d(), matrix);
      if (!inverse) {
        return false;
      }
      const localPoint = Vec2.transformMat2d(
        new Vec2(),
        point,
        inverse,
      ) as Vec2;
      const halfSize = new Vec2(
        getX(shape.geometry.size),
        getY(shape.geometry.size),
      ).div(new Vec2(2));
      const padding = (shape.stroke?.size ?? 0) / 2;
      const min = new Vec2(-halfSize.x - padding, -halfSize.y - padding);
      const max = new Vec2(halfSize.x + padding, halfSize.y + padding);
      return new BoxOperations({ min, max }).containsPoint(localPoint);
    },
  },
  selection: {
    canResize: (shape) => shape.interactions?.resizable !== false,
    prepareResize: (shape: RectShape) => {
      return {
        geometry: {
          type: "rect",
          size: toVec2Like(shape.geometry.size),
        },
      };
    },
    resize({ snapshotGeometry, selectionScale, nextBounds, layout }) {
      if (!layout) return null;
      const g = snapshotGeometry as RectGeometry;
      const geometry: RectGeometry = {
        type: "rect",
        size: toVec2Like(
          new Vec2(getX(g.size), getY(g.size)).mul(selectionScale),
        ),
      };
      const translation = getPointFromLayout(layout, nextBounds);
      return { geometry, translation };
    },
    allowNonUniformScaleWhileRotated: () => false,
    supportsAxisResize: () => true,
    getAxisExtent(geometry, transform, axis) {
      return axis === "x"
        ? getX(geometry.size) * Math.abs(getX(transform.scale))
        : getY(geometry.size) * Math.abs(getY(transform.scale));
    },
    axisResize({ snapshotGeometry, transform, axis, newExtent }) {
      const width =
        axis === "x"
          ? getX(transform.scale) === 0
            ? 0
            : newExtent / getX(transform.scale)
          : getX(snapshotGeometry.size);
      const height =
        axis === "y"
          ? getY(transform.scale) === 0
            ? 0
            : newExtent / getY(transform.scale)
          : getY(snapshotGeometry.size);
      return {
        geometry: {
          type: "rect" as const,
          size: toVec2Like(new Vec2(width, height)),
        },
      };
    },
  },
  serialization: {
    toJSON(shape: RectShape) {
      return {
        ...shape,
        geometry: {
          type: "rect",
          size: toVec2Like(shape.geometry.size),
        },
        ...(shape.transform
          ? {
              transform: shape.transform,
            }
          : {}),
      };
    },
    fromJSON(shape: AnyShape) {
      const rectShape = shape as RectShape;
      return {
        ...rectShape,
        geometry: {
          type: "rect",
          size: toVec2Like(rectShape.geometry.size),
        },
        ...(rectShape.transform
          ? {
              transform: rectShape.transform,
            }
          : {}),
      };
    },
  },
};
