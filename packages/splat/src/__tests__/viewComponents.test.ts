import { describe, expect, test } from "bun:test";
import { AlertTriangle } from "lucide";
import { KidsDrawStageView } from "../view/KidsDrawStage";
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

  test("KidsDrawStage shows switch-document loading copy", () => {
    const stage = new KidsDrawStageView({
      width: 640,
      height: 480,
      backgroundColor: "#ffffff",
      uiIntentStore: { publish: () => {} },
    });

    stage.setStartupStatus({
      visible: true,
      phase: "doc_loading",
      assetsLoaded: 0,
      assetsTotal: 0,
      assetsFailed: 0,
      blockingReason: "switch_document",
    });

    expect(stage.startupOverlayTitle.textContent).toBe("Opening drawing…");
    expect(stage.startupOverlayDetail.textContent).toContain(
      "Shared drawings can take a moment to respond.",
    );
  });

  test("KidsDrawStage shows degraded copy without hiding the current drawing", () => {
    const stage = new KidsDrawStageView({
      width: 640,
      height: 480,
      backgroundColor: "#ffffff",
      uiIntentStore: { publish: () => {} },
    });

    stage.setStartupStatus({
      visible: true,
      phase: "degraded",
      assetsLoaded: 0,
      assetsTotal: 0,
      assetsFailed: 0,
      blockingReason: "document_open_failed",
    });

    expect(stage.startupOverlayTitle.textContent).toBe(
      "Drawing could not be opened",
    );
    expect(stage.startupOverlayDetail.textContent).toContain(
      "The previous drawing is still available.",
    );
  });
});
