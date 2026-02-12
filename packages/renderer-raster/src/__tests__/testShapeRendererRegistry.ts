import type { PenGeometry } from "@smalldraw/core";
import { type AnyShape, getPenGeometryPoints } from "@smalldraw/core";
import type { ShapeRendererRegistry } from "@smalldraw/renderer-canvas";

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
  registry.set("pen", (ctx, shape) => {
    const geometry = (shape as AnyShape).geometry as PenGeometry;
    const points = getPenGeometryPoints(geometry);
    if (!points.length) return;
    const stroke = shape.style.stroke;
    ctx.save();
    ctx.globalCompositeOperation = stroke?.compositeOp ?? "source-over";
    ctx.strokeStyle = stroke?.color ?? "#000";
    ctx.lineWidth = stroke?.size ?? 1;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i][0], points[i][1]);
    }
    ctx.stroke();
    ctx.restore();
  });
  return registry;
}
