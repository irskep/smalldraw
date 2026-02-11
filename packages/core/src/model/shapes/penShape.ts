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

export interface PenPointsGeometry {
  type: "pen";
  points: Vec2Tuple[];
  pressures?: number[]; // same length as points
}

export interface PenJSONGeometry {
  type: "pen-json";
  pointsJson: string;
  pointCount: number;
}

export type PenGeometry = PenPointsGeometry | PenJSONGeometry;
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
      return {
        type: "pen",
        points: points.map((pt) =>
          toVec2Like(new Vec2().add(toVec2(pt)).sub(center)),
        ),
        ...(shape.geometry.type === "pen" && shape.geometry.pressures
          ? { pressures: shape.geometry.pressures }
          : {}),
      };
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
      const g = shape.geometry;
      return {
        geometry: {
          type: "pen",
          points: getPenGeometryPoints(g),
          ...(g.type === "pen" && g.pressures ? { pressures: g.pressures } : {}),
        },
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
      const geometry =
        shape.geometry.type === "pen-json"
          ? shape.geometry
          : createPenPointsGeometry(
              shape.geometry.points,
              shape.geometry.pressures,
            );
      return {
        ...shape,
        geometry,
        ...(shape.transform
          ? {
              transform: shape.transform,
            }
          : {}),
      };
    },
    fromJSON(shape: AnyShape) {
      const penShape = shape as PenShape;
      const geometry =
        penShape.geometry.type === "pen-json"
          ? penShape.geometry
          : createPenPointsGeometry(
              penShape.geometry.points,
              penShape.geometry.pressures,
            );
      return {
        ...penShape,
        geometry,
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
  if (geometry.type === "pen") {
    return geometry.points;
  }
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

export function createPenJSONGeometry(points: Vec2Tuple[]): PenJSONGeometry {
  return {
    type: "pen-json",
    pointsJson: encodePenPointsJson(points),
    pointCount: points.length,
  };
}

function createPenPointsGeometry(
  points: Vec2Tuple[],
  pressures?: number[],
): PenPointsGeometry {
  return {
    type: "pen",
    points,
    ...(pressures ? { pressures } : {}),
  };
}

function decodePenPointsJson(pointsJson: string | undefined): Vec2Tuple[] {
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
