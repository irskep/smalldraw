import { describe, expect, test } from "bun:test";
import type { KidsDocumentSummary } from "../documents";
import { createDocumentBrowserOverlay } from "../view/DocumentBrowserOverlay";

function createDocument(docUrl: string): KidsDocumentSummary {
  return {
    docUrl,
    mode: "normal",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    lastOpenedAt: "2026-01-01T00:00:00.000Z",
  };
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("DocumentBrowserOverlay long-press behavior", () => {
  test("new drawing nested flow: back returns from volume page picker to root choices", () => {
    const overlay = createDocumentBrowserOverlay({
      onClose: () => {},
      onNewDocument: () => {},
      onOpenDocument: () => {},
      onDeleteDocument: () => {},
    });
    document.body.appendChild(overlay.el);

    const doc = createDocument("doc://nested");
    overlay.setOpen(true);
    overlay.setDocuments([doc], doc.docUrl, new Map());

    const newButton = overlay.el.querySelector(
      ".kids-draw-document-browser__new",
    ) as HTMLButtonElement | null;
    expect(newButton).not.toBeNull();
    newButton!.click();

    const volumeButton = overlay.el.querySelector(
      '[data-doc-create-volume="pdr-v1"]',
    ) as HTMLButtonElement | null;
    expect(volumeButton).not.toBeNull();
    volumeButton!.click();

    const backButton = overlay.el.querySelector(
      '[data-doc-create-back="true"]',
    ) as HTMLButtonElement | null;
    expect(backButton).not.toBeNull();
    expect(backButton!.hidden).toBeFalse();

    backButton!.click();

    const rootChoices = overlay.el.querySelector(
      ".kids-draw-new-document__choices",
    ) as HTMLElement | null;
    const pageView = overlay.el.querySelector(
      ".kids-draw-new-document-pages",
    ) as HTMLElement | null;
    expect(rootChoices).not.toBeNull();
    expect(pageView).not.toBeNull();
    expect(rootChoices!.hidden).toBeFalse();
    expect(pageView!.hidden).toBeTrue();
  });

  test("touch long-press opens preview", async () => {
    const overlay = createDocumentBrowserOverlay({
      onClose: () => {},
      onNewDocument: () => {},
      onOpenDocument: () => {},
      onDeleteDocument: () => {},
    });
    document.body.appendChild(overlay.el);

    const doc = createDocument("doc://1");
    overlay.setOpen(true);
    overlay.setDocuments([doc], doc.docUrl, new Map([[doc.docUrl, "blob://thumb"]]));

    const openButton = overlay.el.querySelector(
      `[data-doc-browser-open="${doc.docUrl}"]`,
    ) as HTMLElement | null;
    expect(openButton).not.toBeNull();

    openButton!.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerType: "touch",
        pointerId: 1,
      }),
    );

    await waitMs(360);

    const preview = overlay.el.querySelector(
      ".kids-draw-document-preview",
    ) as HTMLElement | null;
    expect(preview).not.toBeNull();
    expect(preview!.hidden).toBeFalse();
  });

  test("pointerup after preview suppresses next open once", async () => {
    const opened: string[] = [];
    const overlay = createDocumentBrowserOverlay({
      onClose: () => {},
      onNewDocument: () => {},
      onOpenDocument: (docUrl) => {
        opened.push(docUrl);
      },
      onDeleteDocument: () => {},
    });
    document.body.appendChild(overlay.el);

    const doc = createDocument("doc://2");
    overlay.setOpen(true);
    overlay.setDocuments([doc], doc.docUrl, new Map([[doc.docUrl, "blob://thumb"]]));

    const openButton = overlay.el.querySelector(
      `[data-doc-browser-open="${doc.docUrl}"]`,
    ) as HTMLElement | null;
    expect(openButton).not.toBeNull();

    openButton!.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerType: "touch",
        pointerId: 2,
      }),
    );
    await waitMs(360);
    openButton!.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        pointerType: "touch",
        pointerId: 2,
      }),
    );

    openButton!.click();
    expect(opened).toEqual([]);

    openButton!.click();
    expect(opened).toEqual([doc.docUrl]);
  });

  test("closing overlay clears pending long-press timer", async () => {
    const overlay = createDocumentBrowserOverlay({
      onClose: () => {},
      onNewDocument: () => {},
      onOpenDocument: () => {},
      onDeleteDocument: () => {},
    });
    document.body.appendChild(overlay.el);

    const doc = createDocument("doc://3");
    overlay.setOpen(true);
    overlay.setDocuments([doc], doc.docUrl, new Map([[doc.docUrl, "blob://thumb"]]));

    const openButton = overlay.el.querySelector(
      `[data-doc-browser-open="${doc.docUrl}"]`,
    ) as HTMLElement | null;
    expect(openButton).not.toBeNull();

    openButton!.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerType: "touch",
        pointerId: 3,
      }),
    );
    overlay.setOpen(false);
    await waitMs(360);

    const preview = overlay.el.querySelector(
      ".kids-draw-document-preview",
    ) as HTMLElement | null;
    expect(preview).not.toBeNull();
    expect(preview!.hidden).toBeTrue();
  });
});
