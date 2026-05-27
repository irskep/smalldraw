import { describe, expect, test } from "bun:test";
import {
  createColorPicker,
  createColorSwatchGrid,
  createStrokePicker,
  createStrokeWidthGrid,
} from "../src";

describe("ColorPicker", () => {
  test("accepts a custom color set and updates selection", () => {
    const picker = createColorPicker({
      colors: [
        { color: "#112233", label: "Ink" },
        { color: "#abcdef", label: "Sky" },
      ],
      selectedColor: "#abcdef",
    });

    const swatches = picker.el.querySelectorAll(".ds-color-picker__swatch");
    expect(swatches.length).toBe(2);
    expect(
      (swatches[0] as HTMLElement).classList.contains("ds-control-tile"),
    ).toBeTrue();
    expect((swatches[0] as HTMLElement).dataset.selected).toBe("false");
    expect((swatches[1] as HTMLElement).dataset.selected).toBe("true");
    expect(picker.triggerButton.el.getAttribute("aria-label")).toBe("Colors");

    picker.setSelectedColor("#112233");
    expect((swatches[0] as HTMLElement).dataset.selected).toBe("true");
    expect((swatches[1] as HTMLElement).dataset.selected).toBe("false");
  });
});

describe("ColorSwatchGrid", () => {
  test("renders arbitrary swatches and emits selection", () => {
    const grid = createColorSwatchGrid({
      colors: [
        { color: "#ff0000", label: "Red" },
        { color: "#00ff00", label: "Green" },
        { color: "#0000ff", label: "Blue" },
      ],
      selectedColor: "#00ff00",
    });

    let selected = "";
    grid.setOnSelect((color) => {
      selected = color;
    });

    const swatches = grid.el.querySelectorAll(".ds-color-picker__swatch");
    expect(swatches.length).toBe(3);
    expect(
      (swatches[0] as HTMLElement).querySelector(
        ".ds-color-picker__swatch-fill",
      ),
    ).not.toBeNull();
    (swatches[2] as HTMLButtonElement).click();

    expect(selected).toBe("#0000ff");
    expect((swatches[2] as HTMLElement).dataset.selected).toBe("true");
  });
});

describe("StrokePicker", () => {
  test("accepts custom stroke widths and updates selection", () => {
    const picker = createStrokePicker({
      strokeWidths: [3, 9, 27],
      selectedStrokeWidth: 9,
    });

    const buttons = picker.el.querySelectorAll(".ds-stroke-picker__button");
    expect(buttons.length).toBe(3);
    expect(
      (buttons[0] as HTMLElement).classList.contains("ds-control-tile"),
    ).toBeTrue();
    expect((buttons[1] as HTMLElement).dataset.selected).toBe("true");

    picker.setSelectedStrokeWidth(27);
    expect((buttons[2] as HTMLElement).dataset.selected).toBe("true");
  });
});

describe("StrokeWidthGrid", () => {
  test("renders arbitrary stroke widths and emits selection", () => {
    const grid = createStrokeWidthGrid({
      strokeWidths: [1, 5, 25, 100],
      selectedStrokeWidth: 5,
    });

    let selected = 0;
    grid.setOnSelect((strokeWidth) => {
      selected = strokeWidth;
    });

    const buttons = grid.el.querySelectorAll(".ds-stroke-picker__button");
    expect(buttons.length).toBe(4);
    (buttons[3] as HTMLButtonElement).click();

    expect(selected).toBe(100);
    expect((buttons[3] as HTMLElement).dataset.selected).toBe("true");
  });
});
