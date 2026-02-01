import { BoxOperations, type RectGeometry } from "@smalldraw/geometry";
import { Mat2d, Vec2 } from "gl-matrix";
import type { Shape } from "../shape";
import { buildTransformMatrix } from "../geometryShapeUtils";
import { normalizeShapeTransform } from "../shape";
import { getPointFromLayout, type ShapeHandler } from "../shapeTypes";

export type RectShape = Shape & { geometry: RectGeometry };

// Rectangle - full featured with geometry, selection (including axis-resize)
export const RectShapeHandler: ShapeHandler<RectGeometry, unknown> = {
  geometry: {
    getBounds(shape: RectShape) {
      const g = shape.geometry;
      return BoxOperations.fromPointPair(
        new Vec2().sub(g.size).div(new Vec2(2)),
        new Vec2().add(g.size).div(new Vec2(2)),
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
      const halfSize = new Vec2(shape.geometry.size).div(new Vec2(2));
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
          size: new Vec2(shape.geometry.size),
        },
      };
    },
    resize({ snapshotGeometry, selectionScale, nextBounds, layout }) {
      if (!layout) return null;
      const g = snapshotGeometry as RectGeometry;
      const geometry: RectGeometry = {
        type: "rect",
        size: new Vec2(g.size).mul(selectionScale),
      };
      const translation = getPointFromLayout(layout, nextBounds);
      return { geometry, translation };
    },
    allowNonUniformScaleWhileRotated: () => false,
    supportsAxisResize: () => true,
    getAxisExtent(geometry, transform, axis) {
      return axis === "x"
        ? geometry.size.x * Math.abs(transform.scale.x)
        : geometry.size.y * Math.abs(transform.scale.y);
    },
    axisResize({ snapshotGeometry, transform, axis, newExtent }) {
      const width =
        axis === "x"
          ? transform.scale.x === 0
            ? 0
            : newExtent / transform.scale.x
          : snapshotGeometry.size.x;
      const height =
        axis === "y"
          ? transform.scale.y === 0
            ? 0
            : newExtent / transform.scale.y
          : snapshotGeometry.size.y;
      return {
        geometry: {
          type: "rect" as const,
          size: new Vec2(width, height),
        },
      };
    },
  },
};
