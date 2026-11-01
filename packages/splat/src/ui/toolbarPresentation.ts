export interface ToolbarColorSwatch {
  value: string;
  label: string;
}

// Keep neighboring color pairs together in both four- and six-column layouts.
export const TOOLBAR_COLOR_SWATCHES: readonly ToolbarColorSwatch[] = [
  { value: "#000000", label: "Black" },
  { value: "#9ca3af", label: "Gray" },
  { value: "#ffffff", label: "White" },
  { value: "#fff1cf", label: "Cream" },
  { value: "#ffc2d8", label: "Pale pink" },
  { value: "#ff66c4", label: "Bubblegum" },
  { value: "#ff4d6d", label: "Strawberry" },
  { value: "#de3034", label: "Red" },
  { value: "#ffc19b", label: "Peach" },
  { value: "#ff8a00", label: "Orange Pop" },
  { value: "#ffdb4d", label: "Sunshine" },
  { value: "#dfc28c", label: "Sand" },
  { value: "#cb9766", label: "Tan" },
  { value: "#c36a45", label: "Terracotta" },
  { value: "#8b5a2b", label: "Brown" },
  { value: "#4b2b21", label: "Dark brown" },
  { value: "#63c132", label: "Lime" },
  { value: "#287847", label: "Forest green" },
  { value: "#00b894", label: "Mint" },
  { value: "#45cfe0", label: "Cyan" },
  { value: "#2e86ff", label: "Sky Blue" },
  { value: "#243e80", label: "Navy" },
  { value: "#bea9f2", label: "Lavender" },
  { value: "#6c5ce7", label: "Blueberry" },
] as const;

export { STROKE_WIDTH_OPTIONS as TOOLBAR_STROKE_WIDTH_OPTIONS } from "../tools/strokeWidthOptions";

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
