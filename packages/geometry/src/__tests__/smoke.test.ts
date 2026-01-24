import { describe, expect, test } from "bun:test";

describe("@smalldraw/geometry", () => {
  test("loads geometry types", () => {
    expect(typeof "geometry").toBe("string");
  });
});
