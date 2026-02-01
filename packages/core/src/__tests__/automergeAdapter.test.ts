import { describe, expect, test } from "bun:test";
import type { AnyGeometry } from "@smalldraw/geometry";
import { createDocument } from "../model/document";
import { getDefaultShapeHandlerRegistry, ShapeHandlerRegistry } from "../model/shapeHandlers";
import { fromJSON, toJSON } from "../automerge/adapter";

const v = (x = 0, y = x): [number, number] => [x, y];

describe("Automerge JSON adapter", () => {
  test("roundtrips JSON through Automerge using registry serialization", () => {
    const registry = getDefaultShapeHandlerRegistry();
    const shapes = [
      {
        id: "rect-1",
        type: "rect",
        geometry: { type: "rect", size: v(10, 20) },
        zIndex: "a0",
        transform: {
          translation: v(5, 5),
          scale: v(1, 1),
          rotation: 0,
        },
      },
      {
        id: "pen-1",
        type: "pen",
        geometry: {
          type: "pen",
          points: [
            v(0, 0),
            v(10, 5),
          ],
        },
        zIndex: "a1",
        transform: {
          translation: v(2, 3),
          scale: v(1, 1),
          rotation: 0,
        },
      },
    ];
    const doc = createDocument(shapes, registry);
    const json = toJSON(doc, registry);
    const restored = fromJSON(json, registry);
    expect(toJSON(restored, registry)).toEqual(json);
  });

  test("throws if serializer is missing", () => {
    const registry = new ShapeHandlerRegistry();
    registry.register("custom", {
      geometry: {
        getBounds: () => null,
      },
    });
    const doc = createDocument(
      [
        {
          id: "custom-1",
          type: "custom",
          geometry: { type: "custom" } as AnyGeometry,
          zIndex: "a0",
          transform: {
            translation: v(0, 0),
            scale: v(1, 1),
            rotation: 0,
          },
        },
      ],
      registry,
    );
    expect(() => toJSON(doc, registry)).toThrow(
      'Missing serializer for shape type "custom"',
    );
  });
});
