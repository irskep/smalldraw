import { describe, expect, test } from "bun:test";
import { createInitialSmalldrawDocument } from "./createInitialSmalldrawDocument.js";

describe("createInitialSmalldrawDocument", () => {
  test("returns a valid default drawing document shape", () => {
    const doc = createInitialSmalldrawDocument();
    expect(doc.size).toEqual({ width: 960, height: 600 });
    expect(doc.presentation).toEqual({});
    expect(doc.layers.default).toEqual({
      id: "default",
      kind: "drawing",
      zIndex: "a0",
    });
    expect(doc.shapes).toEqual({});
    expect(doc.temporalOrderCounter).toBe(0);
  });
});
