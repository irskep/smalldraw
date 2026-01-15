import type {
  BezierGeometry,
  Bounds,
  EllipseGeometry,
  Fill,
  GradientStop,
  PathGeometry,
  PenGeometry,
  Point,
  PolygonGeometry,
  RectGeometry,
  RegularPolygonGeometry,
  Shape,
  StrokeGeometry,
  StrokeStyle,
} from '@smalldraw/core';
import { getGeometryLocalBounds, normalizeShapeTransform } from '@smalldraw/core';
import Konva from 'konva';

import { createFreehandStroke } from './stroke.js';

type RenderableNode = Konva.Shape | Konva.Group;

export type GeometryType = Shape['geometry']['type'];

export type ShapeRenderer = (shape: Shape) => RenderableNode | RenderableNode[] | null;

export type ShapeRendererRegistry = Partial<Record<GeometryType, ShapeRenderer>>;

const baseRenderers: ShapeRendererRegistry = {
  rect: (shape) => createRectNode(shape as Shape & { geometry: RectGeometry }),
  ellipse: (shape) => createEllipseNode(shape as Shape & { geometry: EllipseGeometry }),
  regularPolygon: (shape) =>
    createRegularPolygonNode(shape as Shape & { geometry: RegularPolygonGeometry }),
  polygon: (shape) => createPolygonNode(shape as Shape & { geometry: PolygonGeometry }),
  pen: (shape) => createPenNode(shape as Shape & { geometry: PenGeometry }),
  stroke: (shape) => createStrokeNode(shape as Shape & { geometry: StrokeGeometry }),
  path: (shape) => createPathNode(shape as Shape & { geometry: PathGeometry }),
  bezier: (shape) => createBezierNode(shape as Shape & { geometry: BezierGeometry }),
};

export function createShapeRendererRegistry(
  overrides?: ShapeRendererRegistry,
): ShapeRendererRegistry {
  return { ...baseRenderers, ...(overrides ?? {}) };
}

export const defaultShapeRendererRegistry = createShapeRendererRegistry();

export function renderShapeNode(
  shape: Shape,
  registry: ShapeRendererRegistry = defaultShapeRendererRegistry,
): Konva.Group | null {
  const renderer = registry[shape.geometry.type];
  if (!renderer) {
    return null;
  }
  const nodes = renderer(shape);
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
    name: 'smalldraw-shape',
    x: transform.translation.x,
    y: transform.translation.y,
    rotation: radToDeg(transform.rotation),
    scaleX: transform.scale.x,
    scaleY: transform.scale.y,
    offsetX: transform.origin.x,
    offsetY: transform.origin.y,
    listening: false,
    opacity: shape.opacity ?? 1,
  });
  return group;
}

function createRectNode(shape: Shape & { geometry: RectGeometry }): Konva.Rect {
  const { width, height } = shape.geometry.size;
  return new Konva.Rect({
    ...buildShapeVisualConfig(shape),
    x: -width / 2,
    y: -height / 2,
    width,
    height,
  });
}

function createEllipseNode(shape: Shape & { geometry: EllipseGeometry }): Konva.Ellipse {
  return new Konva.Ellipse({
    ...buildShapeVisualConfig(shape),
    radiusX: shape.geometry.radiusX,
    radiusY: shape.geometry.radiusY,
  });
}

function createRegularPolygonNode(
  shape: Shape & { geometry: RegularPolygonGeometry },
): Konva.RegularPolygon {
  return new Konva.RegularPolygon({
    ...buildShapeVisualConfig(shape),
    radius: shape.geometry.radius,
    sides: shape.geometry.sides,
  });
}

function createPolygonNode(shape: Shape & { geometry: PolygonGeometry }): Konva.Line | null {
  const points = flattenPoints(shape.geometry.points);
  if (!points.length) {
    return null;
  }
  return new Konva.Line({
    ...buildShapeVisualConfig(shape),
    closed: shape.geometry.closed ?? true,
    points,
  });
}

function createStrokeNode(shape: Shape & { geometry: StrokeGeometry }): Konva.Line | null {
  const points = flattenPoints(shape.geometry.points);
  if (!points.length) {
    return null;
  }
  const strokeColor = shape.stroke?.color ?? '#000000';
  const strokeWidth = shape.stroke?.size ?? 1;
  return new Konva.Line({
    ...buildShapeVisualConfig(shape),
    stroke: strokeColor,
    strokeWidth,
    points,
    closed: false,
  });
}

function createPenNode(shape: Shape & { geometry: PenGeometry }): Konva.Line | null {
  const stroke = shape.stroke;
  const color = stroke?.color ?? '#000000';
  const size = stroke?.size ?? 4;
  const strokeResult = createFreehandStroke(shape.geometry.points, {
    size,
    simulatePressure: shape.geometry.simulatePressure ?? true,
    smoothing: 0.6,
    streamline: 0.4,
    thinning: 0.6,
  });
  if (!strokeResult) {
    return null;
  }
  return new Konva.Line({
    points: strokeResult.flatPoints,
    closed: true,
    fill: color,
    listening: false,
  });
}

function createPathNode(shape: Shape & { geometry: PathGeometry }): Konva.Path | null {
  const data = pathSegmentsToData(shape.geometry);
  if (!data) {
    return null;
  }
  return new Konva.Path({
    ...buildShapeVisualConfig(shape),
    data,
  });
}

function createBezierNode(shape: Shape & { geometry: BezierGeometry }): Konva.Path | null {
  const data = bezierToPathData(shape.geometry);
  if (!data) {
    return null;
  }
  return new Konva.Path({
    ...buildShapeVisualConfig(shape),
    data,
  });
}

function buildShapeVisualConfig(shape: Shape): Konva.ShapeConfig {
  const config: Konva.ShapeConfig = {
    listening: false,
  };
  applyStrokeConfig(config, shape.stroke);
  applyFillConfig(config, shape);
  return config;
}

function applyStrokeConfig(config: Konva.ShapeConfig, stroke?: StrokeStyle): void {
  if (!stroke) {
    return;
  }
  config.stroke = stroke.color;
  config.strokeWidth = stroke.size;
  config.lineCap = 'round';
  config.lineJoin = 'round';
}

function applyFillConfig(config: Konva.ShapeConfig, shape: Shape): void {
  const fill = shape.fill;
  if (!fill) {
    return;
  }
  if (fill.type === 'solid') {
    config.fill = fill.color;
    return;
  }
  const bounds = getGeometryLocalBounds(shape.geometry);
  if (!bounds) {
    return;
  }
  const gradientConfig = createLinearGradientConfig(fill, bounds);
  Object.assign(config, gradientConfig);
}

function createLinearGradientConfig(fill: Extract<Fill, { type: 'gradient' }>, bounds: Bounds) {
  const angle = degToRad(fill.angle);
  const halfWidth = bounds.width / 2;
  const halfHeight = bounds.height / 2;
  const start = {
    x: -Math.cos(angle) * halfWidth,
    y: -Math.sin(angle) * halfHeight,
  };
  const end = { x: -start.x, y: -start.y };
  return {
    fillLinearGradientStartPoint: start,
    fillLinearGradientEndPoint: end,
    fillLinearGradientColorStops: fill.stops.flatMap((stop: GradientStop) => [
      stop.offset,
      applyStopColor(stop.color, stop.opacity),
    ]),
  } satisfies Pick<Konva.ShapeConfig, 'fillLinearGradientStartPoint' | 'fillLinearGradientEndPoint' | 'fillLinearGradientColorStops'>;
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
  const hex = color.trim().replace('#', '');
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

function flattenPoints(points: Point[]): number[] {
  const flattened: number[] = [];
  for (const point of points) {
    flattened.push(point.x, point.y);
  }
  return flattened;
}

function pathSegmentsToData(geometry: PathGeometry): string {
  const commands: string[] = [];
  for (const segment of geometry.segments) {
    if (!segment.points.length) continue;
    if (segment.type === 'move') {
      const [pt] = segment.points;
      commands.push(`M${pt.x} ${pt.y}`);
      continue;
    }
    if (segment.type === 'line') {
      commands.push(`L${segment.points.map((pt: Point) => `${pt.x} ${pt.y}`).join(' ')}`);
      continue;
    }
    if (segment.type === 'bezier') {
      const bezierPoints = segment.points;
      for (let i = 0; i + 2 < bezierPoints.length; i += 3) {
        const [cp1, cp2, end] = bezierPoints.slice(i, i + 3);
        commands.push(`C${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${end.x} ${end.y}`);
      }
    }
  }
  return commands.join(' ');
}

function bezierToPathData(geometry: BezierGeometry): string {
  if (!geometry.nodes.length) {
    return '';
  }
  const commands: string[] = [];
  const first = geometry.nodes[0];
  commands.push(`M${first.anchor.x} ${first.anchor.y}`);
  for (let i = 0; i < geometry.nodes.length - 1; i += 1) {
    const current = geometry.nodes[i];
    const next = geometry.nodes[i + 1];
    const outHandle = current.handleOut ?? current.anchor;
    const inHandle = next.handleIn ?? next.anchor;
    commands.push(
      `C${outHandle.x} ${outHandle.y} ${inHandle.x} ${inHandle.y} ${next.anchor.x} ${next.anchor.y}`,
    );
  }
  if (geometry.closed && geometry.nodes.length > 1) {
    const last = geometry.nodes[geometry.nodes.length - 1];
    const outHandle = last.handleOut ?? last.anchor;
    const firstIn = first.handleIn ?? first.anchor;
    commands.push(`C${outHandle.x} ${outHandle.y} ${firstIn.x} ${firstIn.y} ${first.anchor.x} ${first.anchor.y}`);
    commands.push('Z');
  }
  return commands.join(' ');
}

function radToDeg(value: number): number {
  return (value * 180) / Math.PI;
}

function degToRad(value: number): number {
  return (value * Math.PI) / 180;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
