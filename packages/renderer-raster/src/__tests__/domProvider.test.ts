import { describe, expect, test } from "bun:test";
import { createDomTileProvider } from "../dom";

describe("createDomTileProvider", () => {
  test("does not override non-static computed position", () => {
    const container = {
      style: { position: "" },
      appendChild: () => {},
    } as unknown as HTMLElement;
    const originalGetComputedStyle = globalThis.getComputedStyle;
    Object.defineProperty(globalThis, "getComputedStyle", {
      configurable: true,
      value: () => ({ position: "absolute" }),
    });

    try {
      createDomTileProvider(container);
      expect(container.style.position).toBe("");
    } finally {
      Object.defineProperty(globalThis, "getComputedStyle", {
        configurable: true,
        value: originalGetComputedStyle,
      });
    }
  });

  test("sets relative when computed position is static", () => {
    const container = {
      style: { position: "" },
      appendChild: () => {},
    } as unknown as HTMLElement;
    const originalGetComputedStyle = globalThis.getComputedStyle;
    Object.defineProperty(globalThis, "getComputedStyle", {
      configurable: true,
      value: () => ({ position: "static" }),
    });

    try {
      createDomTileProvider(container);
      expect(container.style.position).toBe("relative");
    } finally {
      Object.defineProperty(globalThis, "getComputedStyle", {
        configurable: true,
        value: originalGetComputedStyle,
      });
    }
  });
});
