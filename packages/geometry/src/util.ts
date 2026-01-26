export function allValuesAreFinite(values: number[]) {
  return values.every((n) => Number.isFinite(n));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function radToDeg(value: number): number {
  return (value * 180) / Math.PI;
}

export function degToRad(value: number): number {
  return (value * Math.PI) / 180;
}
