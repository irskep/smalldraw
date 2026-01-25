export function allValuesAreFinite(a: number, b: number, c: number, d: number) {
  return (
    Number.isFinite(a) &&
    Number.isFinite(b) &&
    Number.isFinite(c) &&
    Number.isFinite(d)
  );
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
