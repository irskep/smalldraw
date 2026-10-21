import type { StrokeStyle, ToolRuntime } from "@smalldraw/core";

import { STROKE_WIDTH_OPTIONS } from "../strokeWidthOptions";

const MIN_STAMP_SIZE = 30;
const STAMP_SIZE_TO_STROKE_RATIO = 10;

export interface StampToolOptions {
  stroke?: StrokeStyle;
}

/** Map the full brush range onto this drawing, preserving distinct size choices. */
export function computeStampSize(
  brushSize: number,
  drawingHeight: number,
): number {
  const smallestBrush = STROKE_WIDTH_OPTIONS[0];
  const largestBrush = STROKE_WIDTH_OPTIONS[STROKE_WIDTH_OPTIONS.length - 1];
  const minimum = Math.min(MIN_STAMP_SIZE, drawingHeight / 4);
  const fraction = Math.max(
    0,
    Math.min(
      1,
      Math.log(brushSize / smallestBrush) /
        Math.log(largestBrush / smallestBrush),
    ),
  );
  // Geometric interpolation keeps the small choices useful on large drawings.
  return minimum * (drawingHeight / minimum) ** fraction;
}

export function toStampStrokeSize(
  brushSize: number,
  drawingHeight: number,
): number {
  return (
    computeStampSize(brushSize, drawingHeight) / STAMP_SIZE_TO_STROKE_RATIO
  );
}

export function resolveStampSize(
  runtime: ToolRuntime,
  fallbackOptions?: StampToolOptions,
): number {
  const override =
    runtime.getOptions<StampToolOptions>()?.stroke ?? fallbackOptions?.stroke;
  return computeStampSize(
    override?.size ?? runtime.getSharedSettings().strokeWidth,
    runtime.getDocument().size.height,
  );
}

export function resolveStampStroke(
  runtime: ToolRuntime,
  fallbackOptions?: StampToolOptions,
): StrokeStyle {
  const shared = runtime.getSharedSettings();
  const override =
    runtime.getOptions<StampToolOptions>()?.stroke ?? fallbackOptions?.stroke;
  return {
    type: "brush",
    color: override?.color ?? shared.strokeColor,
    size:
      resolveStampSize(runtime, fallbackOptions) / STAMP_SIZE_TO_STROKE_RATIO,
    brushId: override?.brushId ?? "marker",
    compositeOp: override?.compositeOp ?? "source-over",
  };
}
