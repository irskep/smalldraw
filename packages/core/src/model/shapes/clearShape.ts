import type { AnyShape, Shape } from "../shape";
import type { ShapeHandler } from "../shapeTypes";

export interface ClearGeometry {
  type: "clear";
}

export type ClearShape = Shape & { geometry: ClearGeometry };

export const ClearShapeHandler: ShapeHandler<ClearGeometry, unknown> = {
  geometry: {
    getBounds: () => null,
  },
  serialization: {
    toJSON(shape: ClearShape) {
      return {
        ...shape,
        geometry: {
          type: "clear",
        },
        ...(shape.transform
          ? {
              transform: shape.transform,
            }
          : {}),
      };
    },
    fromJSON(shape: AnyShape) {
      const clearShape = shape as ClearShape;
      return {
        ...clearShape,
        geometry: {
          type: "clear",
        },
        ...(clearShape.transform
          ? {
              transform: clearShape.transform,
            }
          : {}),
      };
    },
  },
};
