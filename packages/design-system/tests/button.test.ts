import { describe, expect, test } from "bun:test";
import { Pencil, Rows2 } from "lucide";
import { createButton, createIconButton } from "../src";

describe("IconButton", () => {
  test("renders label, pressed state, and disabled state", () => {
    const button = createIconButton({ label: "Draw", icon: Pencil });
    button.setPressed(true);
    button.setDisabled(true);

    expect(button.el.textContent).toContain("Draw");
    expect(button.el.getAttribute("aria-pressed")).toBe("true");
    expect(button.el.disabled).toBeTrue();
    expect(button.el.querySelector("svg")).not.toBeNull();
  });

  test("can expose radio semantics", () => {
    const button = createIconButton({ label: "Option", icon: Rows2 });
    button.setChecked(true);

    expect(button.el.getAttribute("role")).toBe("radio");
    expect(button.el.getAttribute("aria-checked")).toBe("true");
    expect(button.el.getAttribute("aria-pressed")).toBeNull();
    expect(button.el.tabIndex).toBe(0);
  });

  test("binds and unbinds click handlers", () => {
    const button = createIconButton({ label: "Tap me", icon: Pencil });
    let presses = 0;

    button.setOnPress(() => {
      presses += 1;
    });
    button.el.click();
    button.setOnPress(null);
    button.el.click();

    expect(presses).toBe(1);
  });
});

describe("Button", () => {
  test("applies additional classes without dropping base button styling", () => {
    const button = createButton({
      label: "Share",
      className: "extra-button-class another-class",
    });

    expect(button.el.classList.contains("ds-button")).toBeTrue();
    expect(button.el.classList.contains("extra-button-class")).toBeTrue();
    expect(button.el.classList.contains("another-class")).toBeTrue();
  });

  test("can opt into autofocus semantics", () => {
    const button = createButton({
      label: "Primary action",
      autofocus: true,
    });

    expect(button.el.hasAttribute("autofocus")).toBeTrue();

    button.setAutofocus(false);

    expect(button.el.hasAttribute("autofocus")).toBeFalse();
  });

  test("can reserve width for a set of possible labels", () => {
    const button = createButton({
      label: "Copy",
      possibleLabels: ["Copy", "Copied"],
    });

    const reservedLabels = button.el.querySelector(".ds-button__reserved-labels");
    const reservedLabelNodes = button.el.querySelectorAll(
      ".ds-button__reserved-label",
    );

    expect(reservedLabels).not.toBeNull();
    expect(reservedLabels?.getAttribute("aria-hidden")).toBe("true");
    expect(reservedLabels?.hasAttribute("hidden")).toBeFalse();
    expect([...reservedLabelNodes].map((node) => node.textContent)).toEqual([
      "Copy",
      "Copied",
    ]);
  });

  test("can update reserved labels without changing the visible label", () => {
    const button = createButton({
      label: "Copy",
      possibleLabels: ["Copy", "Copied"],
    });

    button.setPossibleLabels(["Copy", "Copy manually"]);
    button.setLabel("Copied");

    const reservedLabelNodes = button.el.querySelectorAll(
      ".ds-button__reserved-label",
    );
    const visibleLabel = button.el.querySelector(".ds-button__label");

    expect([...reservedLabelNodes].map((node) => node.textContent)).toEqual([
      "Copy",
      "Copy manually",
    ]);
    expect(visibleLabel?.textContent).toBe("Copied");
  });
});
