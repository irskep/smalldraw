import { ClearShapeHandler, ShapeHandlerRegistry } from "@smalldraw/core";
import { KidsBoxedShapeHandler } from "./boxedShapeHandler";
import { KidsPenShapeHandler } from "./penShapeHandler";
import { KidsRasterFillShapeHandler } from "./rasterFillShape";
import { KidsStampShapeHandler } from "./stampShape";

export function createKidsShapeHandlerRegistry(): ShapeHandlerRegistry {
  const registry = new ShapeHandlerRegistry();
  registry.register("pen", KidsPenShapeHandler);
  registry.register("stamp", KidsStampShapeHandler);
  registry.register("raster-fill", KidsRasterFillShapeHandler);
  registry.register("boxed", KidsBoxedShapeHandler);
  registry.register("clear", ClearShapeHandler);
  return registry;
}
