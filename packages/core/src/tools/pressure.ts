export function isPressureSample(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
