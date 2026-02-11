import {
  type AnyShape,
  type BoxedGeometry,
  type BoxedShape,
  buildTransformMatrix,
  getPointFromLayout,
  normalizeShapeTransform,
  type Shape,
  type ShapeHandler,
} from "@smalldraw/core";
import { BoxOperations, getX, getY, toVec2Like } from "@smalldraw/geometry";
import { Mat2d, Vec2 } from "gl-matrix";

type ShapeWithBoxedGeometry = Shape & { geometry: BoxedGeometry };

function getHalfSize(geometry: BoxedGeometry): Vec2 {
  return new Vec2(getX(geometry.size), getY(geometry.size)).div(new Vec2(2));
}

function getStrokePadding(shape: Shape): number {
  return (shape.style?.stroke?.size ?? 0) / 2;
}

export const KidsBoxedShapeHandler: ShapeHandler<BoxedGeometry, unknown> = {
  geometry: {
    getBounds(shape: ShapeWithBoxedGeometry) {
      const halfSize = getHalfSize(shape.geometry);
      const padding = getStrokePadding(shape);
      const min = new Vec2(-halfSize.x, -halfSize.y).sub(new Vec2(padding));
      const max = new Vec2(halfSize.x, halfSize.y).add(new Vec2(padding));
      return BoxOperations.fromPointPair(min, max);
    },
  },
  shape: {
    hitTest(shape: ShapeWithBoxedGeometry, point: Vec2) {
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
      const halfSize = getHalfSize(shape.geometry);
      const padding = getStrokePadding(shape);
      if (shape.geometry.kind === "rect") {
        const min = new Vec2(-halfSize.x - padding, -halfSize.y - padding);
        const max = new Vec2(halfSize.x + padding, halfSize.y + padding);
        return new BoxOperations({ min, max }).containsPoint(localPoint);
      }

      const radiusX = halfSize.x + padding;
      const radiusY = halfSize.y + padding;
      if (radiusX <= 0 || radiusY <= 0) {
        return false;
      }
      const normalizedX = localPoint.x / radiusX;
      const normalizedY = localPoint.y / radiusY;
      return normalizedX * normalizedX + normalizedY * normalizedY <= 1;
    },
  },
  selection: {
    canResize: (shape) => shape.interactions?.resizable !== false,
    prepareResize: (shape: ShapeWithBoxedGeometry) => {
      return {
        geometry: {
          type: "boxed",
          kind: shape.geometry.kind,
          size: toVec2Like(shape.geometry.size),
        },
      };
    },
    resize({ snapshotGeometry, selectionScale, nextBounds, layout }) {
      if (!layout) return null;
      const geometry: BoxedGeometry = {
        type: "boxed",
        kind: snapshotGeometry.kind,
        size: toVec2Like(
          new Vec2(
            getX(snapshotGeometry.size),
            getY(snapshotGeometry.size),
          ).mul(selectionScale),
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
          type: "boxed",
          kind: snapshotGeometry.kind,
          size: toVec2Like(new Vec2(width, height)),
        },
      };
    },
  },
  serialization: {
    toJSON(shape: ShapeWithBoxedGeometry) {
      return {
        ...shape,
        geometry: {
          type: "boxed",
          kind: shape.geometry.kind,
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
      const boxedShape = shape as BoxedShape;
      return {
        ...boxedShape,
        geometry: {
          type: "boxed",
          kind: boxedShape.geometry.kind,
          size: toVec2Like(boxedShape.geometry.size),
        },
        ...(boxedShape.transform
          ? {
              transform: boxedShape.transform,
            }
          : {}),
      };
    },
  },
};

export type { BoxedGeometry, BoxedShape };
