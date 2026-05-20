import { describe, expect, test } from "bun:test";
import type { KidsDocumentSummary } from "../documents";
import { createDocumentBrowserDialogView } from "../view/DocumentBrowserDialogView";
import { createNewDocumentDialogView } from "../view/NewDocumentDialogView";

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

describe("NewDocumentDialogView", () => {
  test("back returns from volume page picker to root choices", () => {
    const created: Array<unknown> = [];
    const dialog = createNewDocumentDialogView({
      onClose: () => {},
      onCreate: (request) => {
        created.push(request);
      },
    });
    document.body.appendChild(dialog.el);

    dialog.setOpen(true);

    const volumeButton = dialog.el.querySelector(
      '[data-new-document-volume="pdr-v1"]',
    ) as HTMLButtonElement | null;
    expect(volumeButton).not.toBeNull();
    volumeButton!.click();

    const backButton = dialog.el.querySelector(
      ".ds-dialog-scaffold__leading .ds-button",
    ) as HTMLButtonElement | null;
    expect(backButton).not.toBeNull();
    backButton!.click();

    const rootChoices = dialog.el.querySelector(
      ".kids-draw-new-document-dialog__choices",
    ) as HTMLElement | null;
    const pageView = dialog.el.querySelector(
      ".kids-draw-new-document-dialog__page-section",
    ) as HTMLElement | null;
    expect(rootChoices).not.toBeNull();
    expect(pageView).not.toBeNull();
    expect(rootChoices!.hidden).toBeFalse();
    expect(pageView!.hidden).toBeTrue();
    expect(created).toEqual([]);
  });

  test("selecting a book shows its summary and page choices", () => {
    const dialog = createNewDocumentDialogView({
      onClose: () => {},
      onCreate: () => {},
    });
    document.body.appendChild(dialog.el);

    dialog.setOpen(true);

    const volumeButton = dialog.el.querySelector(
      '[data-new-document-volume="pdr-v1"]',
    ) as HTMLButtonElement | null;
    expect(volumeButton).not.toBeNull();
    volumeButton!.click();

    const summaryTitle = dialog.el.querySelector(
      ".kids-draw-new-document-dialog__book-summary-title",
    ) as HTMLElement | null;
    const pageButton = dialog.el.querySelector(
      '[data-new-document-page="coloring/pdr-v1/page-001.png"]',
    ) as HTMLButtonElement | null;

    expect(summaryTitle?.textContent).toBe("PDR Volume 1");
    expect(pageButton).not.toBeNull();
  });
});

describe("DocumentBrowserDialogView", () => {
  test("touch long-press opens preview", async () => {
    const dialog = createDocumentBrowserDialogView({
      onClose: () => {},
      onOpenCreateDialog: () => {},
      onOpenDocument: () => {},
      onClaimDocument: () => {},
      onDeleteDocument: () => {},
    });
    document.body.appendChild(dialog.el);

    const doc = createDocument("doc://1");
    dialog.setOpen(true);
    dialog.setDocuments([doc]);
    dialog.setCurrentDocument(doc.docUrl);
    dialog.setThumbnailUrls(new Map([[doc.docUrl, "blob://thumb"]]));
    dialog.setClaimableDocuments(new Set());

    const openButton = dialog.el.querySelector(
      `[data-document-browser-open="${doc.docUrl}"]`,
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

    const preview = dialog.el.querySelector(
      ".kids-draw-document-browser-dialog__preview",
    ) as HTMLElement | null;
    expect(preview).not.toBeNull();
    expect(preview!.hidden).toBeFalse();
  });

  test("pointerup after preview suppresses next open once", async () => {
    const opened: string[] = [];
    const dialog = createDocumentBrowserDialogView({
      onClose: () => {},
      onOpenCreateDialog: () => {},
      onOpenDocument: (docUrl) => {
        opened.push(docUrl);
      },
      onClaimDocument: () => {},
      onDeleteDocument: () => {},
    });
    document.body.appendChild(dialog.el);

    const doc = createDocument("doc://2");
    dialog.setOpen(true);
    dialog.setDocuments([doc]);
    dialog.setCurrentDocument(doc.docUrl);
    dialog.setThumbnailUrls(new Map([[doc.docUrl, "blob://thumb"]]));
    dialog.setClaimableDocuments(new Set());

    const openButton = dialog.el.querySelector(
      `[data-document-browser-open="${doc.docUrl}"]`,
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

  test("closing dialog clears pending long-press timer", async () => {
    const dialog = createDocumentBrowserDialogView({
      onClose: () => {},
      onOpenCreateDialog: () => {},
      onOpenDocument: () => {},
      onClaimDocument: () => {},
      onDeleteDocument: () => {},
    });
    document.body.appendChild(dialog.el);

    const doc = createDocument("doc://3");
    dialog.setOpen(true);
    dialog.setDocuments([doc]);
    dialog.setCurrentDocument(doc.docUrl);
    dialog.setThumbnailUrls(new Map([[doc.docUrl, "blob://thumb"]]));
    dialog.setClaimableDocuments(new Set());

    const openButton = dialog.el.querySelector(
      `[data-document-browser-open="${doc.docUrl}"]`,
    ) as HTMLElement | null;
    expect(openButton).not.toBeNull();

    openButton!.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerType: "touch",
        pointerId: 3,
      }),
    );
    dialog.setOpen(false);
    await waitMs(360);

    const preview = dialog.el.querySelector(
      ".kids-draw-document-browser-dialog__preview",
    ) as HTMLElement | null;
    expect(preview).not.toBeNull();
    expect(preview!.hidden).toBeTrue();
  });

  test("claim button is shown for claimable drawings and dispatches callback", () => {
    const claimed: string[] = [];
    const dialog = createDocumentBrowserDialogView({
      onClose: () => {},
      onOpenCreateDialog: () => {},
      onOpenDocument: () => {},
      onClaimDocument: (docUrl) => {
        claimed.push(docUrl);
      },
      onDeleteDocument: () => {},
    });
    document.body.appendChild(dialog.el);

    const doc = createDocument("doc://claimable");
    dialog.setOpen(true);
    dialog.setDocuments([doc]);
    dialog.setCurrentDocument(doc.docUrl);
    dialog.setThumbnailUrls(new Map());
    dialog.setClaimableDocuments(new Set([doc.docUrl]));

    const claimButton = dialog.el.querySelector(
      `[data-document-browser-claim="${doc.docUrl}"]`,
    ) as HTMLButtonElement | null;
    expect(claimButton).not.toBeNull();
    expect(claimButton?.hidden).toBeFalse();

    claimButton?.click();
    expect(claimed).toEqual([doc.docUrl]);
  });

  test("document tiles show shared vs local status", () => {
    const dialog = createDocumentBrowserDialogView({
      onClose: () => {},
      onOpenCreateDialog: () => {},
      onOpenDocument: () => {},
      onClaimDocument: () => {},
      onDeleteDocument: () => {},
    });
    document.body.appendChild(dialog.el);

    const localDoc = createDocument("doc://local");
    const sharedDoc = {
      ...createDocument("doc://shared"),
      collaborative: true,
      collabDocUrl: "automerge:shared-1",
    };
    dialog.setOpen(true);
    dialog.setDocuments([localDoc, sharedDoc]);
    dialog.setCurrentDocument(localDoc.docUrl);
    dialog.setThumbnailUrls(new Map());
    dialog.setClaimableDocuments(new Set());

    const statuses = Array.from(
      dialog.el.querySelectorAll(".ds-thumbnail-tile__badge"),
    ).map((element) => ({
      text: element.textContent,
      shared: element.getAttribute("data-tone") === "positive",
    }));

    expect(statuses).toEqual([
      { text: "Local", shared: false },
      { text: "Shared", shared: true },
    ]);
  });

  test("initial loading shows loading state before any documents exist", () => {
    const dialog = createDocumentBrowserDialogView({
      onClose: () => {},
      onOpenCreateDialog: () => {},
      onOpenDocument: () => {},
      onClaimDocument: () => {},
      onDeleteDocument: () => {},
    });
    document.body.appendChild(dialog.el);

    dialog.setOpen(true);

    dialog.setLoading(true);

    const loading = dialog.el.querySelector(
      ".kids-draw-document-browser-dialog__loading",
    ) as HTMLElement | null;
    const grid = dialog.el.querySelector(
      ".kids-draw-document-browser-dialog__grid",
    ) as HTMLElement | null;
    expect(loading).not.toBeNull();
    expect(loading?.hidden).toBeFalse();
    expect(grid).not.toBeNull();
    expect(grid?.hidden).toBeTrue();

    dialog.setLoading(false);

    expect(loading?.hidden).toBeTrue();
  });

  test("reload loading keeps existing grid visible", () => {
    const dialog = createDocumentBrowserDialogView({
      onClose: () => {},
      onOpenCreateDialog: () => {},
      onOpenDocument: () => {},
      onClaimDocument: () => {},
      onDeleteDocument: () => {},
    });
    document.body.appendChild(dialog.el);

    const doc = createDocument("doc://visible");
    dialog.setOpen(true);
    dialog.setDocuments([doc]);
    dialog.setCurrentDocument(doc.docUrl);
    dialog.setThumbnailUrls(new Map());
    dialog.setClaimableDocuments(new Set());

    const grid = dialog.el.querySelector(
      ".kids-draw-document-browser-dialog__grid",
    ) as HTMLElement | null;
    const loading = dialog.el.querySelector(
      ".kids-draw-document-browser-dialog__loading",
    ) as HTMLElement | null;
    expect(grid).not.toBeNull();
    expect(loading).not.toBeNull();

    dialog.setLoading(true);

    expect(grid?.hidden).toBeFalse();
    expect(loading?.hidden).toBeTrue();
  });

});
