import type { StrokeStyle, ToolDefinition, ToolRuntime } from "@smalldraw/core";
import { toVec2Like } from "@smalldraw/geometry";
import type { Vec2 } from "gl-matrix";
import type { ImageStampGeometry, StampShape } from "../../shapes/stampShape";
import { createStampPlacementTool } from "./stampPlacementTool";
import {
  resolveStampSize,
  resolveStampStroke,
  type StampToolOptions,
} from "./stampSizing";

export interface ImageStampAssetDescriptor {
  id: string;
  src: string;
  width: number;
  height: number;
}

export interface CreateImageStampToolOptions {
  id: string;
  label: string;
  shapeIdPrefix: string;
  asset: ImageStampAssetDescriptor;
  runtimeOptions?: StampToolOptions;
}

export const IMAGE_STAMP_STYLE_SUPPORT: ToolDefinition["styleSupport"] = {
  strokeColor: false,
  strokeWidth: true,
  fillColor: false,
  transparentStrokeColor: false,
  transparentFillColor: false,
};

export function computeImageStampSize(
  asset: ImageStampAssetDescriptor,
  stampSize: number,
): { width: number; height: number } {
  const safeHeight = Math.max(1, asset.height);
  const aspect = Math.max(1e-6, asset.width / safeHeight);
  if (aspect >= 1) {
    return {
      width: stampSize,
      height: stampSize / aspect,
    };
  }

  return {
    width: stampSize * aspect,
    height: stampSize,
  };
}

export function createImageStampShape(params: {
  id: string;
  point: Vec2;
  zIndex: string;
  stroke: StrokeStyle;
  asset: ImageStampAssetDescriptor;
  stampSize: number;
}): StampShape {
  const size = computeImageStampSize(params.asset, params.stampSize);
  const geometry: ImageStampGeometry = {
    type: "stamp",
    stampType: "image",
    assetId: params.asset.id,
    src: params.asset.src,
    width: size.width,
    height: size.height,
  };

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
      scale: [1, 1],
      rotation: 0,
    },
  };
}

export function createImageStampTool(
  options: CreateImageStampToolOptions,
): ToolDefinition {
  return createStampPlacementTool({
    id: options.id,
    label: options.label,
    shapeIdPrefix: options.shapeIdPrefix,
    styleSupport: IMAGE_STAMP_STYLE_SUPPORT,
    resolveStroke(runtime: ToolRuntime) {
      return resolveStampStroke(runtime, options.runtimeOptions);
    },
    createShape({ id, point, zIndex, stroke, runtime }) {
      const stampSize = resolveStampSize(
        runtime,
        stroke.size,
        options.runtimeOptions,
      );
      return createImageStampShape({
        id,
        point,
        zIndex,
        stroke,
        asset: options.asset,
        stampSize,
      });
    },
  });
}
