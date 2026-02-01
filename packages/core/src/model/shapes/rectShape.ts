import {
  BoxOperations,
  makePoint,
  type Point,
  type RectGeometry,
} from "@smalldraw/geometry";
import type { Shape } from "../shape";
import { getPointFromLayout, type ShapeHandler } from "../shapeTypes";

export type RectShape = Shape & { geometry: RectGeometry };

// Rectangle - full featured with geometry, selection (including axis-resize)
export const RectShapeHandler: ShapeHandler<RectGeometry, unknown> = {
  geometry: {
    getBounds(shape: RectShape) {
      const g = shape.geometry;
      return BoxOperations.fromPointPair(
        makePoint().sub(g.size).div(makePoint(2)),
        makePoint().add(g.size).div(makePoint(2)),
      );
    },
  },
  selection: {
    canResize: (shape) => shape.interactions?.resizable !== false,
    prepareResize: (shape: RectShape) => {
      return {
        geometry: {
          type: "rect",
          size: makePoint(shape.geometry.size),
        },
      };
    },
    resize({
      snapshotGeometry,
      selectionScale,
      nextBounds,
      layout,
    }) {
      if (!layout) return null;
      const g = snapshotGeometry as RectGeometry;
      const geometry: RectGeometry = {
        type: "rect",
        size: makePoint(g.size).mul(selectionScale),
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
          size: makePoint(width, height),
        },
      };
    },
  },
};
