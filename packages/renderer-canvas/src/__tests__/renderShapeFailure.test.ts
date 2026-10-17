import { expect, test } from "bun:test";
import type { Shape } from "@smalldraw/core";
import { createCanvas } from "canvas";
import { renderShape } from "../shapes";

test("failed shape renderer restores canvas state for the next bake", () => {
  const ctx = createCanvas(10, 10).getContext(
    "2d",
  ) as unknown as CanvasRenderingContext2D;
  const shape = {
    type: "broken",
    transform: { translation: [5, 5] },
    style: { opacity: 0.5 },
  } as Shape;
  expect(() =>
    renderShape(
      ctx,
      shape,
      new Map([
        [
          "broken",
          () => {
            throw new Error("failure");
          },
        ],
      ]),
    ),
  ).toThrow("failure");
  expect(ctx.globalAlpha).toBe(1);
  expect(ctx.getTransform().e).toBe(0);
  expect(ctx.getTransform().f).toBe(0);
});
