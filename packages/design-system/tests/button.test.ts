import { describe, expect, test } from "bun:test";
import { createButton } from "../src";

describe("ButtonView", () => {
  test("applies tone and disabled state", () => {
    const button = createButton({ label: "Delete", tone: "danger" });
    button.setDisabled(true);

    expect(button.el.textContent).toBe("Delete");
    expect(button.el.dataset.tone).toBe("danger");
    expect(button.el.disabled).toBeTrue();
  });

  test("binds and unbinds click handlers", () => {
    const button = createButton({ label: "Tap me" });
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
