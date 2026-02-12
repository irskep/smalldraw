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
  toVec2,
  toVec2Like,
  type Vec2Tuple,
} from "@smalldraw/geometry";
import { Vec2 } from "gl-matrix";

export type StampPathCommand =
  | { kind: "line"; to: Vec2Tuple }
  | { kind: "quad"; control: Vec2Tuple; to: Vec2Tuple };

export interface StampPath {
  start: Vec2Tuple;
  commands: StampPathCommand[];
}

export interface StampGeometry {
  type: "stamp";
  stampType: "letter";
  letter: string;
  width: number;
  height: number;
  paths: StampPath[];
}

export type StampShape = Shape & { type: "stamp"; geometry: StampGeometry };

export function getStampGeometryBounds(geometry: StampGeometry): Box | null {
  const points: Vec2Tuple[] = [];

  const addQuadraticPoint = (
    from: Vec2Tuple,
    control: Vec2Tuple,
    to: Vec2Tuple,
    t: number,
  ) => {
    const mt = 1 - t;
    const point = Vec2.scale(new Vec2(), toVec2(from), mt * mt) as Vec2;
    Vec2.scaleAndAdd(point, point, toVec2(control), 2 * mt * t);
    Vec2.scaleAndAdd(point, point, toVec2(to), t * t);
    points.push(toVec2Like(point));
  };

  const getQuadAxisExtremaT = (
    from: Vec2Tuple,
    control: Vec2Tuple,
    to: Vec2Tuple,
    axis: 0 | 1,
  ): number | undefined => {
    const p0 = from[axis];
    const p1 = control[axis];
    const p2 = to[axis];
    const denom = p0 - 2 * p1 + p2;
    if (Math.abs(denom) < 1e-8) {
      return undefined;
    }
    const t = (p0 - p1) / denom;
    if (t > 0 && t < 1) {
      return t;
    }
    return undefined;
  };

  if (geometry.paths.length === 0) {
    return null;
  }

  for (const path of geometry.paths) {
    let current = path.start;
    points.push(current);
    for (const command of path.commands) {
      if (command.kind === "line") {
        points.push(command.to);
        current = command.to;
        continue;
      }

      points.push(command.to);

      const tx = getQuadAxisExtremaT(current, command.control, command.to, 0);
      if (tx !== undefined) {
        addQuadraticPoint(current, command.control, command.to, tx);
      }

      const ty = getQuadAxisExtremaT(current, command.control, command.to, 1);
      if (ty !== undefined) {
        addQuadraticPoint(current, command.control, command.to, ty);
      }

      current = command.to;
    }
  }

  return BoxOperations.fromPointArray(points);
}

export const KidsStampShapeHandler: ShapeHandler<StampGeometry, unknown> = {
  geometry: {
    getBounds: (shape: Shape & { geometry: StampGeometry }) =>
      getStampGeometryBounds(shape.geometry),
    canonicalize(shape: Shape & { geometry: StampGeometry }, center) {
      const toLocal = (point: Vec2Tuple): Vec2Tuple =>
        toVec2Like(new Vec2().add(toVec2(point)).sub(center));
      return {
        ...shape.geometry,
        paths: shape.geometry.paths.map((path) => ({
          start: toLocal(path.start),
          commands: path.commands.map((command) => {
            if (command.kind === "line") {
              return { kind: "line", to: toLocal(command.to) };
            }
            return {
              kind: "quad",
              control: toLocal(command.control),
              to: toLocal(command.to),
            };
          }),
        })),
      };
    },
  },
  shape: {
    hitTest(shape: Shape & { geometry: StampGeometry }, point: Vec2) {
      const localBounds = getStampGeometryBounds(shape.geometry);
      const bounds = getHitTestBounds(shape, localBounds);
      return new BoxOperations(bounds).containsPoint(point);
    },
  },
  selection: {
    canResize: () => false,
    supportsAxisResize: () => false,
  },
  serialization: {
    toJSON(shape: Shape & { geometry: StampGeometry }) {
      return {
        ...shape,
        geometry: shape.geometry,
        ...(shape.transform ? { transform: shape.transform } : {}),
      };
    },
    fromJSON(shape: AnyShape) {
      const stampShape = shape as StampShape;
      if (stampShape.geometry.type !== "stamp") {
        throw new Error(
          `Invalid stamp geometry type '${stampShape.geometry.type}'. Expected 'stamp'.`,
        );
      }
      return {
        ...stampShape,
        geometry: stampShape.geometry,
        ...(stampShape.transform ? { transform: stampShape.transform } : {}),
      };
    },
  },
};

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
