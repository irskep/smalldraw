import type { AnyGeometry } from "@smalldraw/geometry";
import { BoxedShapeHandler } from "./shapes/boxedShape";
import { ClearShapeHandler } from "./shapes/clearShape";
import { PenShapeHandler } from "./shapes/penShape";
import type { ShapeHandler } from "./shapeTypes";

export class ShapeHandlerRegistry {
  private handlers = new Map<string, unknown>();

  register<T extends AnyGeometry, TResizeData>(
    type: string,
    handler: ShapeHandler<T, TResizeData>,
  ): void {
    this.handlers.set(type, handler);
  }

  get<T extends AnyGeometry, TResizeData>(
    type: string,
  ): ShapeHandler<T, TResizeData> | undefined {
    return this.handlers.get(type) as ShapeHandler<T, TResizeData>;
  }

  has(type: string): boolean {
    return this.handlers.has(type);
  }

  clone(): ShapeHandlerRegistry {
    const registry = new ShapeHandlerRegistry();
    for (const [type, handler] of this.handlers) {
      registry.register(type, handler as ShapeHandler<AnyGeometry, unknown>);
    }
    return registry;
  }
}

// Create default registry with built-in handlers
const defaultRegistry = new ShapeHandlerRegistry();

defaultRegistry.register("pen", PenShapeHandler);
defaultRegistry.register("boxed", BoxedShapeHandler);
defaultRegistry.register("clear", ClearShapeHandler);

// Lazy singleton
let _defaultInstance: ShapeHandlerRegistry | null = null;

export function getDefaultShapeHandlerRegistry(): ShapeHandlerRegistry {
  if (!_defaultInstance) {
    _defaultInstance = defaultRegistry.clone();
  }
  return _defaultInstance;
}
