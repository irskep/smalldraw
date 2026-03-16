import { describe, expect, test } from "bun:test";
import type { DocHandle } from "@automerge/automerge-repo";
import { createAutomergeStoreAdapter } from "../automerge/storeAdapter";
import { getDefaultShapeHandlerRegistry } from "../model/shapeHandlers";

function createMockHandle(doc: unknown): DocHandle<any> {
  return {
    url: "automerge:test-doc",
    isReady: () => true,
    whenReady: async () => {},
    doc: () => doc,
    change: () => {},
    on: () => {},
    off: () => {},
    heads: () => [],
  } as unknown as DocHandle<any>;
}

describe("createAutomergeStoreAdapter.getDoc", () => {
  test("falls back to a default document when loaded doc has invalid size", () => {
    const adapter = createAutomergeStoreAdapter({
      handle: createMockHandle({
        presentation: { documentType: "normal" },
        layers: [],
        shapes: {},
        temporalOrderCounter: 0,
      }),
      registry: getDefaultShapeHandlerRegistry(),
    });

    const doc = adapter.getDoc();
    expect(doc.size.width).toBeGreaterThan(0);
    expect(doc.size.height).toBeGreaterThan(0);
    expect(doc.presentation).toEqual({});
  });
});
