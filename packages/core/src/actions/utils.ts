import type { DrawingDocument } from "../model/document";
import type { AnyShape } from "../model/shape";

export function requireShape(doc: DrawingDocument, shapeId: string): AnyShape {
  const shape = doc.shapes[shapeId];
  if (!shape) {
    throw new Error(`Shape ${shapeId} not found`);
  }
  return shape;
}

export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as T;
  }
  if (value && typeof value === "object") {
    if (ArrayBuffer.isView(value)) {
      return value;
    }
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (entry === undefined) continue;
      result[key] = stripUndefined(entry);
    }
    return result as T;
  }
  return value;
}
