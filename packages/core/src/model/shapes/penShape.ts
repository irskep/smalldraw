import type { PenGeometry } from "@smalldraw/geometry";
import { getBoundsFromPoints, pointSubtract } from "../geometryUtils";
import type { Shape } from "../shape";
import { getPointFromLayout, type ShapeHandler } from "../shapeTypes";

export type PenShape = Shape & { geometry: PenGeometry };

export const PenShapeHandler: ShapeHandler<PenGeometry, unknown> = {
  geometry: {
    getBounds: (shape: PenShape) => getBoundsFromPoints(shape.geometry.points),
    canonicalize(shape: PenShape, center) {
      return {
        ...shape.geometry,
        points: shape.geometry.points.map((pt) => pointSubtract(pt, center)),
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
          points: g.points.map((pt) => ({ ...pt })),
          intensity: g.intensity,
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
          scale: {
            x: transform.scale.x * selectionScale.x,
            y: transform.scale.y * selectionScale.y,
          },
        },
      };
    },
    supportsAxisResize: () => false,
  },
};
