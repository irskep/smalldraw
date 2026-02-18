import type { AnyShape } from "@smalldraw/core";
import type { ShapeRendererRegistry } from "@smalldraw/renderer-canvas";
import { renderRasterFill } from "../shapes/rasterFillShapeRenderer";
import { renderBoxed } from "../shapes/renderers/boxed";
import { renderPen } from "../shapes/renderers/pen";
import { renderStamp } from "../shapes/stampShapeRenderer";

export function createKidsShapeRendererRegistry(): ShapeRendererRegistry {
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
  registry.set("stamp", (ctx, shape) => renderStamp(ctx, shape));
  registry.set("raster-fill", (ctx, shape) => renderRasterFill(ctx, shape));
  return registry;
}
