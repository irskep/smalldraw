import type { AnyShape } from "@smalldraw/core";
import type { ShapeRendererRegistry } from "../shapes";
import { renderBoxed } from "../shapes/boxed";
import { renderPen } from "../shapes/pen";

export function createTestShapeRendererRegistry(): ShapeRendererRegistry {
  const registry: ShapeRendererRegistry = new Map();
  registry.set("boxed", (ctx, shape) =>
    renderBoxed(
      ctx,
      shape as AnyShape & {
        geometry: {
          type: "boxed";
          kind: "rect" | "ellipse";
          size: [number, number];
        };
      },
    ),
  );
  registry.set("pen", (ctx, shape) =>
    renderPen(ctx, shape as AnyShape & { geometry: { type: "pen-json" } }),
  );
  return registry;
}
