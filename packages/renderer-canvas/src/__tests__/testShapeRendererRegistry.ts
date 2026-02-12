import type { AnyShape } from "@smalldraw/core";
import type { ShapeRendererRegistry } from "../shapes";

export function createTestShapeRendererRegistry(): ShapeRendererRegistry {
  const registry: ShapeRendererRegistry = new Map();
  registry.set("boxed", (ctx, shape) => {
    const { size } = (shape as AnyShape).geometry as unknown as {
      size: [number, number];
    };
    const [w, h] = size;
    if (shape.style.fill?.type === "solid") {
      ctx.fillStyle = shape.style.fill.color;
      ctx.fillRect(-w / 2, -h / 2, w, h);
    }
    const stroke = shape.style.stroke;
    if (stroke?.type === "brush") {
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
      ctx.strokeRect(-w / 2, -h / 2, w, h);
    }
  });
  return registry;
}
