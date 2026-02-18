import {
  type AnyShape,
  buildTransformMatrix,
  normalizeShapeTransform,
  type Shape,
  type ShapeHandler,
} from "@smalldraw/core";
import {
  type Box,
  BoxOperations,
  getX,
  getY,
  toVec2Like,
} from "@smalldraw/geometry";
import { Vec2 } from "gl-matrix";

export interface RasterFillGeometry {
  type: "raster-fill";
  src: string;
  width: number;
  height: number;
}

export type RasterFillShape = Shape & {
  type: "raster-fill";
  geometry: RasterFillGeometry;
};

export function getRasterFillGeometryBounds(
  geometry: RasterFillGeometry,
): Box | null {
  const halfWidth = geometry.width / 2;
  const halfHeight = geometry.height / 2;
  return {
    min: [-halfWidth, -halfHeight],
    max: [halfWidth, halfHeight],
  };
}

function getHitTestBounds(shape: Shape, localBounds: Box | null): Box {
  const transform = normalizeShapeTransform(shape.transform);
  const matrix = buildTransformMatrix(transform);
  const corners: Vec2[] = localBounds
    ? [
        new Vec2(getX(localBounds.min), getY(localBounds.min)),
        new Vec2(getX(localBounds.max), getY(localBounds.min)),
        new Vec2(getX(localBounds.max), getY(localBounds.max)),
        new Vec2(getX(localBounds.min), getY(localBounds.max)),
      ]
    : [new Vec2()];
  const baseBounds = BoxOperations.fromPointArray(
    corners.map(
      (corner) => Vec2.transformMat2d(new Vec2(), corner, matrix) as Vec2,
    ),
  );
  return (
    baseBounds ?? {
      min: toVec2Like(transform.translation),
      max: toVec2Like(transform.translation),
    }
  );
}

export const KidsRasterFillShapeHandler: ShapeHandler<
  RasterFillGeometry,
  unknown
> = {
  geometry: {
    getBounds: (shape: Shape & { geometry: RasterFillGeometry }) =>
      getRasterFillGeometryBounds(shape.geometry),
    canonicalize(shape: Shape & { geometry: RasterFillGeometry }) {
      return shape.geometry;
    },
  },
  shape: {
    hitTest(shape: Shape & { geometry: RasterFillGeometry }, point: Vec2) {
      const localBounds = getRasterFillGeometryBounds(shape.geometry);
      const bounds = getHitTestBounds(shape, localBounds);
      return new BoxOperations(bounds).containsPoint(point);
    },
  },
  selection: {
    canResize: () => false,
    supportsAxisResize: () => false,
  },
  serialization: {
    toJSON(shape: Shape & { geometry: RasterFillGeometry }) {
      return {
        ...shape,
        geometry: shape.geometry,
        ...(shape.transform ? { transform: shape.transform } : {}),
      };
    },
    fromJSON(shape: AnyShape) {
      const rasterFillShape = shape as RasterFillShape;
      if (rasterFillShape.geometry.type !== "raster-fill") {
        throw new Error(
          `Invalid raster-fill geometry type '${rasterFillShape.geometry.type}'. Expected 'raster-fill'.`,
        );
      }
      return {
        ...rasterFillShape,
        geometry: rasterFillShape.geometry,
        ...(rasterFillShape.transform
          ? { transform: rasterFillShape.transform }
          : {}),
      };
    },
  },
};
