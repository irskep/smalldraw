import type {
  AnyShape,
  BoxedShape,
  Fill,
  GradientStop,
  PenShape,
  Shape,
  ShapeHandlerRegistry,
  StrokeStyle,
} from "@smalldraw/core";
import {
  createPenJSONGeometry,
  getGeometryLocalBounds,
  getPenGeometryPoints,
  getPenStrokeOutline,
  normalizeShapeTransform,
} from "@smalldraw/core";
import {
  type Box,
  BoxOperations,
  clamp,
  degToRad,
  getX,
  getY,
  radToDeg,
  toVec2,
  toVec2Like,
} from "@smalldraw/geometry";
import { Vec2 } from "gl-matrix";
import Konva from "konva";
import { outlineToPath } from "./stroke";

type RenderableNode = Konva.Shape | Konva.Group;

export type ShapeRenderer = (
  shape: Shape,
  geometryRegistry?: ShapeHandlerRegistry,
) => RenderableNode | RenderableNode[] | null;

export type ShapeRendererRegistry = Map<string, ShapeRenderer>;

function createDefaultShapeRendererRegistry(): ShapeRendererRegistry {
  const registry = new Map<string, ShapeRenderer>();
  registry.set("boxed", (shape, geometryRegistry) =>
    createBoxedNode(shape as BoxedShape, geometryRegistry),
  );
  registry.set("pen", (shape, geometryRegistry) =>
    createPenNode(shape as PenShape, geometryRegistry),
  );
  return registry;
}

export function createShapeRendererRegistry(
  overrides?: Map<string, ShapeRenderer>,
): ShapeRendererRegistry {
  const registry = new Map(createDefaultShapeRendererRegistry());
  if (overrides) {
    for (const [type, renderer] of overrides) {
      registry.set(type, renderer);
    }
  }
  return registry;
}

export const defaultShapeRendererRegistry =
  createDefaultShapeRendererRegistry();

export function renderShapeNode(
  shape: Shape,
  registry: ShapeRendererRegistry = defaultShapeRendererRegistry,
  geometryRegistry?: ShapeHandlerRegistry,
): Konva.Group | null {
  const renderer = registry.get(shape.type);
  if (!renderer) {
    if (shape.type === "clear") {
      // We avoid shape-specific special cases, but clear is uniquely non-renderable by design.
      return null;
    }
    console.warn(`No renderer for geometry type: ${shape.type}`);
    return null;
  }
  const nodes = renderer(shape, geometryRegistry);
  if (!nodes) {
    return null;
  }
  const group = createContainerForShape(shape);
  const list: RenderableNode[] = Array.isArray(nodes) ? nodes : [nodes];
  for (const node of list) {
    group.add(node);
  }
  return group;
}

function createContainerForShape(shape: Shape): Konva.Group {
  const transform = normalizeShapeTransform(shape.transform);
  const group = new Konva.Group({
    id: shape.id,
    name: "smalldraw-shape",
    x: getX(transform.translation),
    y: getY(transform.translation),
    rotation: radToDeg(transform.rotation),
    scaleX: getX(transform.scale),
    scaleY: getY(transform.scale),
    offsetX: getX(transform.origin),
    offsetY: getY(transform.origin),
    listening: false,
    opacity: shape.style.opacity ?? 1,
  });
  return group;
}

function createBoxedNode(
  shape: BoxedShape,
  geometryRegistry?: ShapeHandlerRegistry,
): Konva.Shape {
  const g = shape.geometry;
  if (g.kind === "ellipse") {
    return new Konva.Ellipse({
      ...buildShapeVisualConfig(shape, geometryRegistry),
      radiusX: getX(g.size) / 2,
      radiusY: getY(g.size) / 2,
    });
  }
  return new Konva.Rect({
    ...buildShapeVisualConfig(shape, geometryRegistry),
    x: -getX(g.size) / 2,
    y: -getY(g.size) / 2,
    width: getX(g.size),
    height: getY(g.size),
  });
}

function createPenNode(
  shape: PenShape,
  _geometryRegistry?: ShapeHandlerRegistry,
): Konva.Path | null {
  const stroke = shape.style.stroke;
  const color = stroke?.color ?? "#000000";
  // Normalize through Vec2 to stabilize float precision for stroke generation.
  const points = getPenGeometryPoints(shape.geometry).map((point) =>
    toVec2Like(toVec2(point)),
  );
  const outline = getPenStrokeOutline({
    ...shape,
    geometry: createPenJSONGeometry(points, shape.geometry.pressures),
  });
  if (!outline.length) {
    return null;
  }
  return new Konva.Path({
    data: outlineToPath(outline),
    fill: color,
    listening: false,
  });
}

function buildShapeVisualConfig(
  shape: AnyShape,
  geometryRegistry?: ShapeHandlerRegistry,
): Konva.ShapeConfig {
  const config: Konva.ShapeConfig = {
    listening: false,
  };
  applyStrokeConfig(config, shape.style.stroke);
  applyFillConfig(config, shape, geometryRegistry);
  return config;
}

function applyStrokeConfig(
  config: Konva.ShapeConfig,
  stroke?: StrokeStyle,
): void {
  if (!stroke) {
    return;
  }
  config.stroke = stroke.color;
  config.strokeWidth = stroke.size;
  config.lineCap = "round";
  config.lineJoin = "round";
}

function applyFillConfig(
  config: Konva.ShapeConfig,
  shape: AnyShape,
  geometryRegistry?: ShapeHandlerRegistry,
): void {
  const fill = shape.style.fill;
  if (!fill) {
    return;
  }
  if (fill.type === "solid") {
    config.fill = fill.color;
    return;
  }
  if (!geometryRegistry) {
    // Fallback: use solid color from first gradient stop if no registry available
    if (fill.type === "gradient" && fill.stops.length > 0) {
      config.fill = fill.stops[0].color;
    }
    return;
  }
  const bounds = getGeometryLocalBounds(shape, geometryRegistry);
  if (!bounds) {
    return;
  }
  const gradientConfig = createLinearGradientConfig(fill, bounds);
  Object.assign(config, gradientConfig);
}

function createLinearGradientConfig(
  fill: Extract<Fill, { type: "gradient" }>,
  bounds: Box,
) {
  const boundsOps = new BoxOperations(bounds);
  const angle = degToRad(fill.angle);
  const halfSize = new Vec2(boundsOps.size).div([2, 2]);
  const start = {
    x: -Math.cos(angle) * halfSize.x,
    y: -Math.sin(angle) * halfSize.y,
  };
  const end = { x: -start.x, y: -start.y };
  return {
    fillLinearGradientStartPoint: start,
    fillLinearGradientEndPoint: end,
    fillLinearGradientColorStops: fill.stops.flatMap((stop: GradientStop) => [
      stop.offset,
      applyStopColor(stop.color, stop.opacity),
    ]),
  } satisfies Pick<
    Konva.ShapeConfig,
    | "fillLinearGradientStartPoint"
    | "fillLinearGradientEndPoint"
    | "fillLinearGradientColorStops"
  >;
}

function applyStopColor(color: string, opacity?: number): string {
  if (opacity === undefined) {
    return color;
  }
  const clamped = clamp(opacity, 0, 1);
  const parsed = parseHexColor(color);
  if (!parsed) {
    return color;
  }
  const [r, g, b] = parsed;
  return `rgba(${r}, ${g}, ${b}, ${clamped})`;
}

function parseHexColor(color: string): [number, number, number] | null {
  const hex = color.trim().replace("#", "");
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return [r, g, b];
  }
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
      return null;
    }
    return [r, g, b];
  }
  return null;
}
