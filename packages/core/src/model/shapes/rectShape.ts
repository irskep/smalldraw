import type { RectGeometry } from "@smalldraw/geometry";
import { createBounds } from "../geometryUtils";
import type { Shape } from "../shape";
import { getPointFromLayout, type ShapeHandler } from "../shapeTypes";

export type RectShape = Shape & { geometry: RectGeometry };

function getRotatedRectAabbSize(
  width: number,
  height: number,
  rotation: number,
): { width: number; height: number } {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const absCos = Math.abs(cos);
  const absSin = Math.abs(sin);
  return {
    width: width * absCos + height * absSin,
    height: width * absSin + height * absCos,
  };
}

function solveRectSizeForAabb(
  targetWidth: number,
  targetHeight: number,
  rotation: number,
  baseSize: { width: number; height: number },
): { width: number; height: number } {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const absCos = Math.abs(cos);
  const absSin = Math.abs(sin);
  const det = absCos * absCos - absSin * absSin;
  if (det !== 0) {
    const width = (absCos * targetWidth - absSin * targetHeight) / det;
    const height = (absCos * targetHeight - absSin * targetWidth) / det;
    return {
      width: Math.max(0, width),
      height: Math.max(0, height),
    };
  }
  const sum = absCos === 0 ? 0 : (targetWidth + targetHeight) / (2 * absCos);
  const baseWidth = baseSize.width;
  const baseHeight = baseSize.height;
  if (baseWidth === 0 && baseHeight === 0) {
    return { width: 0, height: 0 };
  }
  if (baseHeight === 0) {
    return { width: sum, height: 0 };
  }
  if (baseWidth === 0) {
    return { width: 0, height: sum };
  }
  const ratio = baseWidth / baseHeight;
  const height = sum / (1 + ratio);
  const width = sum - height;
  return { width, height };
}

// Rectangle - full featured with geometry, selection (including axis-resize)
export const RectShapeHandler: ShapeHandler<RectGeometry, unknown> = {
  geometry: {
    getBounds(shape: RectShape) {
      const g = shape.geometry;
      const halfWidth = g.size.width / 2;
      const halfHeight = g.size.height / 2;
      return createBounds(-halfWidth, -halfHeight, halfWidth, halfHeight);
    },
  },
  selection: {
    canResize: (shape) => shape.interactions?.resizable !== false,
    prepareResize: (shape: RectShape) => {
      return {
        geometry: {
          type: "rect",
          size: { ...shape.geometry.size },
        },
      };
    },
    resize({
      snapshotGeometry,
      selectionScale,
      nextBounds,
      layout,
      transform,
    }) {
      if (!layout) return null;
      const g = snapshotGeometry as RectGeometry;
      const scaleX = Math.abs(transform.scale.x);
      const scaleY = Math.abs(transform.scale.y);
      const baseWidth = g.size.width * scaleX;
      const baseHeight = g.size.height * scaleY;
      const currentAabb = getRotatedRectAabbSize(
        baseWidth,
        baseHeight,
        transform.rotation,
      );
      const targetAabbWidth = currentAabb.width * selectionScale.x;
      const targetAabbHeight = currentAabb.height * selectionScale.y;
      const solved = solveRectSizeForAabb(
        targetAabbWidth,
        targetAabbHeight,
        transform.rotation,
        { width: baseWidth, height: baseHeight },
      );
      const geometry: RectGeometry = {
        type: "rect",
        size: {
          width: scaleX === 0 ? 0 : solved.width / scaleX,
          height: scaleY === 0 ? 0 : solved.height / scaleY,
        },
      };
      const translation = getPointFromLayout(layout, nextBounds);
      return { geometry, translation };
    },
    supportsAxisResize: () => true,
    getAxisExtent(geometry, transform, axis) {
      return axis === "x"
        ? geometry.size.width * Math.abs(transform.scale.x)
        : geometry.size.height * Math.abs(transform.scale.y);
    },
    axisResize({ snapshotGeometry, transform, axis, newExtent }) {
      const scaleX = Math.abs(transform.scale.x);
      const scaleY = Math.abs(transform.scale.y);
      const width =
        axis === "x"
          ? scaleX === 0
            ? 0
            : newExtent / scaleX
          : snapshotGeometry.size.width;
      const height =
        axis === "y"
          ? scaleY === 0
            ? 0
            : newExtent / scaleY
          : snapshotGeometry.size.height;
      return {
        geometry: {
          type: "rect" as const,
          size: { width, height },
        },
      };
    },
  },
};
