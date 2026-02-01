import { BoxOperations, type PenGeometry } from "@smalldraw/geometry";
import { Vec2 } from "gl-matrix";
import type { Shape } from "../shape";
import { getHitTestBounds } from "./hitTestUtils";
import { getPointFromLayout, type ShapeHandler } from "../shapeTypes";

export type PenShape = Shape & { geometry: PenGeometry };

export const PenShapeHandler: ShapeHandler<PenGeometry, unknown> = {
  geometry: {
    getBounds: (shape: PenShape) =>
      BoxOperations.fromPointArray(shape.geometry.points),
    canonicalize(shape: PenShape, center) {
      return {
        ...shape.geometry,
        points: shape.geometry.points.map((pt) =>
          new Vec2(0, 0).add(pt).sub(center),
        ),
      };
    },
  },
  shape: {
    hitTest(shape: PenShape, point: Vec2) {
      const localBounds = BoxOperations.fromPointArray(shape.geometry.points);
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
          points: g.points.map((p) => new Vec2(p)),
          pressures: g.pressures,
        },
      };
    },
    resize({ selectionScale, nextBounds, layout, transform }) {
      const translation = layout
        ? getPointFromLayout(layout, nextBounds)
        : transform.translation;
      return {
        transform: {
          ...transform,
          translation,
          scale: new Vec2(transform.scale).mul(selectionScale),
        },
      };
    },
    supportsAxisResize: () => false,
  },
};
