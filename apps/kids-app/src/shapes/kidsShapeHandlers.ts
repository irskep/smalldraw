import { ClearShapeHandler, ShapeHandlerRegistry } from "@smalldraw/core";
import { KidsBoxedShapeHandler } from "./boxedShapeHandler";
import { KidsPenShapeHandler } from "./penShapeHandler";

export function createKidsShapeHandlerRegistry(): ShapeHandlerRegistry {
  const registry = new ShapeHandlerRegistry();
  registry.register("pen", KidsPenShapeHandler);
  registry.register("boxed", KidsBoxedShapeHandler);
  registry.register("clear", ClearShapeHandler);
  return registry;
}
