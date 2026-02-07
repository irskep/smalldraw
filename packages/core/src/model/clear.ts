import type { Shape } from "./shape";

export function getLatestClearTemporalOrder(
  shapes: Shape[],
): number | null {
  let latest: number | null = null;
  for (const shape of shapes) {
    if (shape.type !== "clear") continue;
    const order = shape.temporalOrder;
    if (typeof order !== "number") continue;
    if (latest === null || order > latest) {
      latest = order;
    }
  }
  return latest;
}

export function filterShapesAfterClear(shapes: Shape[]): Shape[] {
  const clearOrder = getLatestClearTemporalOrder(shapes);
  if (clearOrder === null) {
    return shapes.filter((shape) => shape.type !== "clear");
  }
  return shapes.filter((shape) => {
    if (shape.type === "clear") return false;
    if (shape.temporalOrder === undefined) return true;
    return shape.temporalOrder > clearOrder;
  });
}
