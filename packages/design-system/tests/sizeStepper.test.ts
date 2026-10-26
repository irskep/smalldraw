import { expect, test } from "bun:test";

import { SizeStepper } from "../src/view/SizeStepper";

test("steps through sizes, handles intermediate values, and respects limits and disabling", () => {
  const view = new SizeStepper({
    strokeWidths: [2, 4, 8],
    selectedStrokeWidth: 2,
  });
  const [smaller, bigger] = view.el.querySelectorAll("button");
  const values: number[] = [];
  view.setOnSelect((value) => values.push(value));
  expect(smaller!.disabled).toBeTrue();
  bigger!.click();
  bigger!.click();
  expect(values).toEqual([4, 8]);
  expect(bigger!.disabled).toBeTrue();
  view.setSelectedStrokeWidth(6);
  smaller!.click();
  expect(values.at(-1)).toBe(4);
  view.setSelectedStrokeWidth(6);
  bigger!.click();
  expect(values.at(-1)).toBe(8);
  view.setDisabled(true);
  expect(view.el.getAttribute("aria-disabled")).toBe("true");
  expect(smaller!.disabled).toBeTrue();
  expect(bigger!.disabled).toBeTrue();
  view.setDisabled(false);
  expect(view.el.getAttribute("aria-disabled")).toBe("false");
  smaller!.click();
  expect(values.at(-1)).toBe(4);
});
