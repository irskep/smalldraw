import { describe, expect, test } from "bun:test";
import { CloudAlert } from "lucide";
import { createSyncIndicator, createText, createTypographicIcon } from "../src";

describe("Text", () => {
  test("renders kind, tone, and text content", () => {
    const text = createText({
      tag: "p",
      text: "Helper copy",
      kind: "body",
      tone: "secondary",
      className: "custom-text",
      attributes: {
        "data-test-id": "helper-copy",
      },
    });

    expect(text.el.tagName).toBe("P");
    expect(text.el.textContent).toBe("Helper copy");
    expect(text.el.classList.contains("ds-text")).toBeTrue();
    expect(text.el.classList.contains("custom-text")).toBeTrue();
    expect(text.el.dataset.kind).toBe("body");
    expect(text.el.dataset.tone).toBe("secondary");
    expect(text.el.getAttribute("data-test-id")).toBe("helper-copy");
  });

  test("can update text kind and tone", () => {
    const text = createText({
      tag: "span",
      text: "Draft",
      kind: "caption",
    });

    text.setText("Online");
    text.setKind("label");
    text.setTone("secondary");

    expect(text.el.textContent).toBe("Online");
    expect(text.el.dataset.kind).toBe("label");
    expect(text.el.dataset.tone).toBe("secondary");
  });
});

describe("SyncIndicator", () => {
  test("is hidden by default for unknown state", () => {
    const indicator = createSyncIndicator();

    expect(indicator.el.hidden).toBeTrue();
    expect(indicator.el.dataset.state).toBe("unknown");
    expect(indicator.el.textContent).toBe("");
  });

  test("renders labels for visible sync states", () => {
    const indicator = createSyncIndicator({ state: "local-only" });

    expect(indicator.el.hidden).toBeFalse();
    expect(indicator.el.textContent).toBe("Local only");
    expect(indicator.el.querySelector("svg")).not.toBeNull();

    indicator.setState("synced-to-server-but-offline");
    expect(indicator.el.textContent).toBe("Offline");

    indicator.setState("online");
    expect(indicator.el.textContent).toBe("Online");
  });

  test("uses secondary body text by default", () => {
    const indicator = createSyncIndicator({ state: "online" });
    const text = indicator.el.querySelector<HTMLSpanElement>(".ds-text");

    expect(text?.dataset.kind).toBe("body");
    expect(text?.dataset.tone).toBe("secondary");
  });
});

describe("TypographicIcon", () => {
  test("renders the icon with text-like kind and tone metadata", () => {
    const icon = createTypographicIcon({
      icon: CloudAlert,
      kind: "caption",
      tone: "secondary",
      className: "custom-icon",
      attributes: {
        "data-test-id": "sync-icon",
      },
    });

    expect(icon.el.classList.contains("ds-typographic-icon")).toBeTrue();
    expect(icon.el.classList.contains("custom-icon")).toBeTrue();
    expect(icon.el.dataset.kind).toBe("caption");
    expect(icon.el.dataset.tone).toBe("secondary");
    expect(icon.el.getAttribute("data-test-id")).toBe("sync-icon");
    expect(icon.el.querySelector("svg")).not.toBeNull();
  });
});
