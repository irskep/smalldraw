import {
  BoxOperations,
  getX,
  getY,
  toVec2,
  toVec2Like,
  type Vec2Tuple,
} from "@smalldraw/geometry";
import { Vec2 } from "gl-matrix";
import { getPenStrokeBounds } from "../penStroke";
import type { AnyShape, Shape } from "../shape";
import { getPointFromLayout, type ShapeHandler } from "../shapeTypes";
import { getHitTestBounds } from "./hitTestUtils";

export interface PenGeometry {
  type: "pen-json";
  pointsJson: string;
  pointCount: number;
  pressures?: number[]; // same length as decoded points
}

export type PenShape = Shape & { geometry: PenGeometry };

const decodedPointCache = new WeakMap<PenGeometry, Vec2Tuple[]>();
const decodedPointsByJson = new Map<string, Vec2Tuple[]>();
const MAX_DECODED_JSON_CACHE_SIZE = 64;

export const PenShapeHandler: ShapeHandler<PenGeometry, unknown> = {
  geometry: {
    getBounds: (shape: PenShape) =>
      getPenStrokeBounds(shape) ??
      BoxOperations.fromPointArray(getPenGeometryPoints(shape.geometry)),
    canonicalize(shape: PenShape, center) {
      const points = getPenGeometryPoints(shape.geometry);
      const localPoints = points.map((pt) =>
        toVec2Like(new Vec2().add(toVec2(pt)).sub(center)),
      );
      return createPenJSONGeometry(localPoints, shape.geometry.pressures);
    },
  },
  shape: {
    hitTest(shape: PenShape, point: Vec2) {
      const points = getPenGeometryPoints(shape.geometry);
      const localBounds =
        getPenStrokeBounds(shape) ?? BoxOperations.fromPointArray(points);
      const bounds = getHitTestBounds(shape, localBounds);
      return new BoxOperations(bounds).containsPoint(point);
    },
  },
  selection: {
    canResize: (shape) => shape.interactions?.resizable !== false,
    prepareResize: (shape: PenShape) => {
      return {
        geometry: shape.geometry,
      };
    },
    resize({ selectionScale, nextBounds, layout, transform }) {
      const translation = layout
        ? toVec2Like(getPointFromLayout(layout, nextBounds))
        : transform.translation;
      return {
        transform: {
          ...transform,
          translation,
          scale: toVec2Like(
            new Vec2(getX(transform.scale), getY(transform.scale)).mul(
              selectionScale,
            ),
          ),
        },
      };
    },
    supportsAxisResize: () => false,
  },
  serialization: {
    toJSON(shape: PenShape) {
      return {
        ...shape,
        geometry: shape.geometry,
        ...(shape.transform
          ? {
              transform: shape.transform,
            }
          : {}),
      };
    },
    fromJSON(shape: AnyShape) {
      const penShape = shape as PenShape;
      if (penShape.geometry.type !== "pen-json") {
        throw new Error(
          `Invalid pen geometry type '${penShape.geometry.type}'. Expected 'pen-json'.`,
        );
      }
      return {
        ...penShape,
        geometry: penShape.geometry,
        ...(penShape.transform
          ? {
              transform: penShape.transform,
            }
          : {}),
      };
    },
  },
};

export function getPenGeometryPoints(geometry: PenGeometry): Vec2Tuple[] {
  const cachedByJson = decodedPointsByJson.get(geometry.pointsJson);
  if (cachedByJson) {
    decodedPointCache.set(geometry, cachedByJson);
    return cachedByJson;
  }
  const cached = decodedPointCache.get(geometry);
  if (cached) {
    return cached;
  }
  const decoded = decodePenPointsJson(geometry.pointsJson);
  decodedPointsByJson.set(geometry.pointsJson, decoded);
  if (decodedPointsByJson.size > MAX_DECODED_JSON_CACHE_SIZE) {
    const oldestKey = decodedPointsByJson.keys().next().value;
    if (typeof oldestKey === "string") {
      decodedPointsByJson.delete(oldestKey);
    }
  }
  decodedPointCache.set(geometry, decoded);
  return decoded;
}

export function encodePenPointsJson(points: Vec2Tuple[]): string {
  return JSON.stringify(points);
}

export function createPenJSONGeometry(
  points: Vec2Tuple[],
  pressures?: number[],
): PenGeometry {
  return {
    type: "pen-json",
    pointsJson: encodePenPointsJson(points),
    pointCount: points.length,
    ...(pressures ? { pressures } : {}),
  };
}

export function decodePenPointsJson(
  pointsJson: string | undefined,
): Vec2Tuple[] {
  if (!pointsJson) {
    return [];
  }
  try {
    const parsed = JSON.parse(pointsJson) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    const points: Vec2Tuple[] = [];
    for (const item of parsed) {
      if (!Array.isArray(item) || item.length < 2) {
        continue;
      }
      const x = item[0];
      const y = item[1];
      if (typeof x !== "number" || typeof y !== "number") {
        continue;
      }
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        continue;
      }
      points.push([x, y]);
    }
    return points;
  } catch {
    return [];
  }
}
