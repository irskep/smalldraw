import {
  BoxOperations,
  makePoint,
  type Point,
  type RectGeometry,
} from "@smalldraw/geometry";
import type { Shape } from "../shape";
import { getPointFromLayout, type ShapeHandler } from "../shapeTypes";

export type RectShape = Shape & { geometry: RectGeometry };

function getRotatedRectAabbSize(size: Point, rotation: number): Point {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const absCos = Math.abs(cos);
  const absSin = Math.abs(sin);
  return makePoint(
    size.x * absCos + size.y * absSin,
    size.x * absSin + size.y * absCos,
  );
}

function solveRectSizeForAabb(
  targetSize: Point,
  rotation: number,
  baseSize: Point,
): { width: number; height: number } {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const absCos = Math.abs(cos);
  const absSin = Math.abs(sin);
  const det = absCos * absCos - absSin * absSin;
  if (det !== 0) {
    const width = (absCos * targetSize.x - absSin * targetSize.y) / det;
    const height = (absCos * targetSize.y - absSin * targetSize.x) / det;
    return {
      width: Math.max(0, width),
      height: Math.max(0, height),
    };
  }
  const sum = absCos === 0 ? 0 : (targetSize.x + targetSize.y) / (2 * absCos);
  if (baseSize.x === 0 && baseSize.y === 0) {
    return { width: 0, height: 0 };
  }
  if (baseSize.y === 0) {
    return { width: sum, height: 0 };
  }
  if (baseSize.x === 0) {
    return { width: 0, height: sum };
  }
  const ratio = baseSize.x / baseSize.y;
  const height = sum / (1 + ratio);
  const width = sum - height;
  return { width, height };
}

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
      transform,
    }) {
      if (!layout) return null;
      const g = snapshotGeometry as RectGeometry;
      const scale = makePoint(transform.scale.x, transform.scale.y);
      const baseSize = makePoint(g.size).mul(scale);
      const currentAabb = getRotatedRectAabbSize(baseSize, transform.rotation);
      const solved = solveRectSizeForAabb(
        makePoint(currentAabb).mul(selectionScale),
        transform.rotation,
        baseSize,
      );
      const geometry: RectGeometry = {
        type: "rect",
        size: makePoint(
          scale.x === 0 ? 0 : solved.width / scale.x,
          scale.y === 0 ? 0 : solved.height / scale.y,
        ),
      };
      const translation = getPointFromLayout(layout, nextBounds);
      return { geometry, translation };
    },
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
