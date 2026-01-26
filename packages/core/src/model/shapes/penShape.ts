import {
  BoxOperations,
  makePoint,
  type PenGeometry,
} from "@smalldraw/geometry";
import type { Shape } from "../shape";
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
          makePoint(0, 0).add(pt).sub(center),
        ),
      };
    },
  },
  selection: {
    canResize: (shape) => shape.interactions?.resizable !== false,
    prepareResize: (shape: PenShape) => {
      const g = shape.geometry;
      return {
        geometry: {
          type: "pen",
          points: g.points.map(makePoint),
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
          scale: makePoint(transform.scale).mul(selectionScale),
        },
      };
    },
    supportsAxisResize: () => false,
  },
};
