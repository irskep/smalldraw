export interface ToolbarColorSwatch {
  value: string;
  label: string;
}

export const TOOLBAR_COLOR_SWATCHES: readonly ToolbarColorSwatch[] = [
  { value: "#000000", label: "Black" },
  { value: "#ffffff", label: "White" },
  { value: "#8b5a2b", label: "Brown" },
  { value: "#ff4d6d", label: "Strawberry" },
  { value: "#ff8a00", label: "Orange Pop" },
  { value: "#ffdb4d", label: "Sunshine" },
  { value: "#63c132", label: "Lime" },
  { value: "#00b894", label: "Mint" },
  { value: "#2e86ff", label: "Sky Blue" },
  { value: "#6c5ce7", label: "Blueberry" },
  { value: "#ff66c4", label: "Bubblegum" },
  { value: "#9ca3af", label: "Gray" },
] as const;

export const TOOLBAR_STROKE_WIDTH_OPTIONS = [
  2, 4, 8, 16, 24, 48, 96, 200,
] as const;

export function resolveSelectedColorSwatchIndex(
  strokeColor: string,
  swatchColors: readonly string[],
): number {
  const normalizedStrokeColor = strokeColor.toLowerCase();
  const selectedSwatchIndex = swatchColors.findIndex(
    (swatchColor) => swatchColor.toLowerCase() === normalizedStrokeColor,
  );
  return Math.max(0, selectedSwatchIndex);
}

export function resolveNearestStrokeWidthOption(
  strokeWidth: number,
  strokeWidthOptions: readonly number[],
): number {
  let nearestStrokeWidth: number = strokeWidthOptions[0] ?? 1;
  let nearestDelta = Math.abs(strokeWidth - nearestStrokeWidth);
  for (const option of strokeWidthOptions) {
    const delta = Math.abs(strokeWidth - option);
    if (delta < nearestDelta) {
      nearestStrokeWidth = option;
      nearestDelta = delta;
    }
  }
  return nearestStrokeWidth;
}
