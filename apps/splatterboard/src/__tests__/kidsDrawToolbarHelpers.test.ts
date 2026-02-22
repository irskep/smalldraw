import { describe, expect, test } from "bun:test";
import {
  resolveNearestStrokeWidthOption,
  resolveSelectedColorSwatchIndex,
} from "../view/KidsDrawToolbar";

describe("KidsDrawToolbar helper projections", () => {
  test("resolveSelectedColorSwatchIndex matches case-insensitively", () => {
    const swatches = ["#000000", "#FF0000", "#00ff00"];
    expect(resolveSelectedColorSwatchIndex("#ff0000", swatches)).toBe(1);
  });

  test("resolveSelectedColorSwatchIndex falls back to first swatch", () => {
    const swatches = ["#000000", "#FF0000", "#00ff00"];
    expect(resolveSelectedColorSwatchIndex("#123456", swatches)).toBe(0);
  });

  test("resolveNearestStrokeWidthOption picks closest option", () => {
    const widths = [2, 4, 8, 16, 24] as const;
    expect(resolveNearestStrokeWidthOption(7, widths)).toBe(8);
    expect(resolveNearestStrokeWidthOption(20, widths)).toBe(16);
  });
});
