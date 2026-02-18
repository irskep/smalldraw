import type { StrokeStyle, ToolDefinition, ToolRuntime } from "@smalldraw/core";
import { toVec2Like } from "@smalldraw/geometry";
import type { Vec2 } from "gl-matrix";
import type { LetterStampGeometry, StampShape } from "../../shapes/stampShape";
import type { StampGlyph, StampPoint } from "../stampGlyphs";
import { createStampPlacementTool } from "./stampPlacementTool";
import {
  resolveStampSize,
  resolveStampStroke,
  type StampToolOptions,
} from "./stampSizing";

export interface CreateLetterStampToolOptions {
  id: string;
  label: string;
  shapeIdPrefix: string;
  glyph: StampGlyph;
  letter: string;
  runtimeOptions?: StampToolOptions;
}

export const LETTER_STAMP_STYLE_SUPPORT: ToolDefinition["styleSupport"] = {
  strokeColor: true,
  strokeWidth: true,
  fillColor: false,
  transparentStrokeColor: false,
  transparentFillColor: false,
};

const toLocalPoint = (
  point: StampPoint,
  glyph: StampGlyph,
  stampSize: number,
): [number, number] => {
  const width = glyph.advance * stampSize;
  const height = stampSize;
  return [point[0] * stampSize - width / 2, point[1] * stampSize - height / 2];
};

export function buildLetterStampGeometry(params: {
  glyph: StampGlyph;
  letter: string;
  stampSize: number;
}): LetterStampGeometry {
  const { glyph, letter, stampSize } = params;
  const width = glyph.advance * stampSize;
  const height = stampSize;
  return {
    type: "stamp",
    stampType: "letter",
    letter,
    width,
    height,
    paths: glyph.strokes
      .filter((path) => path.commands.length > 0)
      .map((path) => ({
        start: toLocalPoint(path.start, glyph, stampSize),
        commands: path.commands.map((command) => {
          if (command.kind === "line") {
            return {
              kind: "line" as const,
              to: toLocalPoint(command.to, glyph, stampSize),
            };
          }
          return {
            kind: "quad" as const,
            control: toLocalPoint(command.control, glyph, stampSize),
            to: toLocalPoint(command.to, glyph, stampSize),
          };
        }),
      })),
  };
}

export function createLetterStampShape(params: {
  id: string;
  point: Vec2;
  zIndex: string;
  stroke: StrokeStyle;
  glyph: StampGlyph;
  letter: string;
  stampSize: number;
  rotation: number;
  scale: number;
}): StampShape {
  const geometry = buildLetterStampGeometry({
    glyph: params.glyph,
    letter: params.letter,
    stampSize: params.stampSize,
  });

  return {
    id: params.id,
    type: "stamp",
    geometry,
    style: {
      stroke: {
        ...params.stroke,
      },
    },
    zIndex: params.zIndex,
    layerId: "default",
    temporalOrder: 0,
    interactions: {
      resizable: false,
      rotatable: false,
    },
    transform: {
      translation: toVec2Like(params.point),
      scale: [params.scale, params.scale],
      rotation: params.rotation,
    },
  };
}

export function createLetterStampTool(
  options: CreateLetterStampToolOptions,
): ToolDefinition {
  return createStampPlacementTool({
    id: options.id,
    label: options.label,
    shapeIdPrefix: options.shapeIdPrefix,
    styleSupport: LETTER_STAMP_STYLE_SUPPORT,
    resolveStroke(runtime: ToolRuntime) {
      return resolveStampStroke(runtime, options.runtimeOptions);
    },
    createShape({ id, point, zIndex, stroke, rotation, scale, runtime }) {
      const stampSize = resolveStampSize(
        runtime,
        stroke.size,
        options.runtimeOptions,
      );
      return createLetterStampShape({
        id,
        point,
        zIndex,
        stroke,
        glyph: options.glyph,
        letter: options.letter,
        stampSize,
        rotation,
        scale,
      });
    },
  });
}

export function sampleStampStrokeLocalPoints(
  stroke: StampGlyph["strokes"][number],
): StampPoint[] {
  const points: StampPoint[] = [stroke.start];
  let current = stroke.start;
  for (const command of stroke.commands) {
    if (command.kind === "line") {
      points.push(command.to);
      current = command.to;
      continue;
    }
    for (let i = 1; i <= 8; i += 1) {
      const t = i / 8;
      const mt = 1 - t;
      const x =
        mt * mt * current[0] +
        2 * mt * t * command.control[0] +
        t * t * command.to[0];
      const y =
        mt * mt * current[1] +
        2 * mt * t * command.control[1] +
        t * t * command.to[1];
      points.push([x, y]);
    }
    current = command.to;
  }
  return points;
}
