import type { StrokeStyle, ToolRuntime } from "@smalldraw/core";

export const DEFAULT_MIN_STAMP_SIZE = 30;
export const DEFAULT_SIZE_MULTIPLIER = 10;
export const STAMP_STROKE_WEIGHT_MULTIPLIER = 1.5;

export interface StampToolOptions {
  stroke?: StrokeStyle;
  minStampSize?: number;
  sizeMultiplier?: number;
}

export function resolveStampStroke(
  runtime: ToolRuntime,
  fallbackOptions?: StampToolOptions,
): StrokeStyle {
  const runtimeOptions = runtime.getOptions<StampToolOptions>();
  const shared = runtime.getSharedSettings();
  const override = runtimeOptions?.stroke ?? fallbackOptions?.stroke;

  return {
    type: "brush",
    color: override?.color ?? shared.strokeColor,
    size: toStampStrokeSize(override?.size ?? shared.strokeWidth),
    brushId: override?.brushId ?? "marker",
    compositeOp: override?.compositeOp ?? "source-over",
  } satisfies StrokeStyle;
}

export function resolveStampSize(
  runtime: ToolRuntime,
  weightedStrokeSize: number,
  fallbackOptions?: StampToolOptions,
): number {
  const runtimeOptions = runtime.getOptions<StampToolOptions>();
  return computeStampSize(weightedStrokeSize, {
    minStampSize: runtimeOptions?.minStampSize ?? fallbackOptions?.minStampSize,
    sizeMultiplier:
      runtimeOptions?.sizeMultiplier ?? fallbackOptions?.sizeMultiplier,
  });
}

export function toStampStrokeSize(baseStrokeSize: number): number {
  return baseStrokeSize * STAMP_STROKE_WEIGHT_MULTIPLIER;
}

export function computeStampSize(
  weightedStrokeSize: number,
  options?: { minStampSize?: number; sizeMultiplier?: number },
): number {
  const minStampSize = options?.minStampSize ?? DEFAULT_MIN_STAMP_SIZE;
  const sizeMultiplier = options?.sizeMultiplier ?? DEFAULT_SIZE_MULTIPLIER;
  return Math.max(minStampSize, weightedStrokeSize * sizeMultiplier);
}
