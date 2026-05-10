import { describe, expect, test } from "bun:test";
import { AlertTriangle } from "lucide";
import { createSquareIconButton } from "../view/SquareIconButton";

describe("view components", () => {
  test("SquareIconButton reflects selected/disabled state", () => {
    const button = createSquareIconButton({
      className: "kids-draw-tool-button",
      label: "Pen",
      icon: AlertTriangle,
      attributes: {
        title: "Pen",
        "aria-label": "Pen",
      },
    });

    button.setSelected(true);
    button.setDisabled(true);

    expect(button.el.classList.contains("is-selected")).toBeTrue();
    expect(button.el.getAttribute("aria-pressed")).toBe("true");
    expect(button.el.disabled).toBeTrue();
  });

  test("SquareIconButton can expose radio semantics", () => {
    const button = createSquareIconButton({
      className: "kids-draw-tool-variant-button",
      label: "Marker",
      icon: AlertTriangle,
      attributes: {
        title: "Marker",
        "aria-label": "Marker",
      },
    });

    button.setRadioSelected(true);

    expect(button.el.classList.contains("is-selected")).toBeTrue();
    expect(button.el.getAttribute("role")).toBe("radio");
    expect(button.el.getAttribute("aria-checked")).toBe("true");
    expect(button.el.getAttribute("aria-pressed")).toBeNull();
    expect(button.el.tabIndex).toBe(0);
  });
});
