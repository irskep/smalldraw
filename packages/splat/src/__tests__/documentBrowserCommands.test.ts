import { describe, expect, test } from "bun:test";
import { DocumentAccessError } from "../app/documentBootstrap";
import { createDocumentBrowserCommands } from "../controller/createDocumentBrowserCommands";

function createPickerState() {
  let open = true;
  let createOpen = false;
  let documents: Array<{
    docUrl: string;
    collaborative?: boolean;
    collabDocUrl?: string;
    accessToken?: string;
    accessTokenScope?: "owner" | "device";
    accountAttached?: boolean;
    mode: "normal";
    createdAt: string;
    updatedAt: string;
    lastOpenedAt: string;
  }> = [];
  const busy: Array<string | null> = [];
  const removing: string[] = [];
  const claimableCalls: string[][] = [];
  return {
    busy,
    removing,
    claimableCalls,
    controller: {
      isOpen() {
        return open;
      },
      isCreateDialogOpen() {
        return createOpen;
      },
      getDocuments() {
        return documents;
      },
      setBusyDocument(docUrl: string | null) {
        busy.push(docUrl);
      },
      setClaimableDocuments(docUrls: Iterable<string>) {
        claimableCalls.push([...docUrls]);
      },
      setRemovingDocument(docUrl: string | null) {
        if (docUrl) {
          removing.push(docUrl);
        }
      },
      async waitForRemovingDocument(docUrl: string) {
        removing.push(`wait:${docUrl}`);
      },
      removeDocument(docUrl: string) {
        documents = documents.filter((document) => document.docUrl !== docUrl);
      },
      close() {
        open = false;
      },
      closeCreateDialog() {
        createOpen = false;
      },
      async open() {
        open = true;
        return documents;
      },
      async reload() {
        return documents;
      },
      _setDocuments(nextDocuments: typeof documents) {
        documents = nextDocuments;
      },
      _setOpen(nextOpen: boolean) {
        open = nextOpen;
      },
      _setCreateOpen(nextOpen: boolean) {
        createOpen = nextOpen;
      },
    },
  };
}

describe("createDocumentBrowserCommands", () => {
  test("createNewDocumentFromBrowser always clears busy state", async () => {
    const picker = createPickerState();
    picker.controller._setOpen(true);
    const commands = createDocumentBrowserCommands({
      documentPickerController: picker.controller,
      getCurrentDocUrl: () => "doc://current",
      switchToDocument: async () => {},
      createNewDocument: async () => {
        throw new Error("boom");
      },
      flushThumbnailSave: async () => {},
      listDocuments: async () => [],
      claimDocument: async () => {},
      isClaimableDocument: () => false,
      deleteDocument: async () => {},
      confirmDelete: async () => true,
      isDestroyed: () => false,
    });

    await expect(
      commands.createNewDocumentFromBrowser({ mode: "normal" }),
    ).rejects.toThrow("boom");
    expect(picker.busy).toEqual(["__new__", null]);
  });

  test("openDocumentFromBrowser closes immediately for current document", async () => {
    const picker = createPickerState();
    picker.controller._setOpen(true);
    let switchedDocUrl: string | null = null;
    const commands = createDocumentBrowserCommands({
      documentPickerController: picker.controller,
      getCurrentDocUrl: () => "doc://current",
      switchToDocument: async (docUrl) => {
        switchedDocUrl = docUrl;
      },
      createNewDocument: async () => {},
      flushThumbnailSave: async () => {},
      listDocuments: async () => [],
      claimDocument: async () => {},
      isClaimableDocument: () => false,
      deleteDocument: async () => {},
      confirmDelete: async () => true,
      isDestroyed: () => false,
    });

    await commands.openDocumentFromBrowser("doc://current");
    expect(switchedDocUrl).toBeNull();
    expect(picker.controller.isOpen()).toBeFalse();
    expect(picker.busy).toEqual([]);
  });

  test("deleteDocumentFromBrowser switches fallback or creates new and clears busy", async () => {
    const picker = createPickerState();
    picker.controller._setOpen(true);
    const switched: string[] = [];
    const created: string[] = [];

    const commands = createDocumentBrowserCommands({
      documentPickerController: picker.controller,
      getCurrentDocUrl: () => "doc://current",
      switchToDocument: async (docUrl) => {
        switched.push(docUrl);
      },
      createNewDocument: async (request) => {
        created.push(request.mode);
      },
      flushThumbnailSave: async () => {},
      listDocuments: async () => [],
      claimDocument: async () => {},
      isClaimableDocument: () => false,
      deleteDocument: async () => {},
      confirmDelete: async () => true,
      isDestroyed: () => false,
    });

    await commands.deleteDocumentFromBrowser("doc://current");

    expect(switched).toEqual([]);
    expect(created).toEqual(["normal"]);
    expect(picker.busy).toEqual(["doc://current", null]);
  });

  test("openDocumentPicker flushes thumbnail save before opening", async () => {
    const picker = createPickerState();
    const steps: string[] = [];
    picker.controller._setDocuments([]);
    picker.controller.open = async () => {
      steps.push("open");
      picker.controller._setOpen(true);
      return picker.controller.getDocuments();
    };
    const commands = createDocumentBrowserCommands({
      documentPickerController: picker.controller,
      getCurrentDocUrl: () => "doc://current",
      switchToDocument: async () => {},
      createNewDocument: async () => {},
      flushThumbnailSave: async () => {
        steps.push("flush");
      },
      listDocuments: async () => [],
      claimDocument: async () => {},
      isClaimableDocument: () => false,
      deleteDocument: async () => {},
      confirmDelete: async () => true,
      isDestroyed: () => false,
    });

    await commands.openDocumentPicker();

    expect(steps).toEqual(["flush", "open"]);
    expect(picker.claimableCalls).toEqual([[], []]);
  });

  test("claimDocumentFromBrowser reloads after claiming", async () => {
    const picker = createPickerState();
    picker.controller._setOpen(true);
    const claimCalls: string[] = [];
    const reloaded: string[] = [];
    const ownerDocument = {
      docUrl: "doc://owner",
      collaborative: true,
      accessToken: "owner-token",
      accessTokenScope: "owner" as const,
      mode: "normal" as const,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      lastOpenedAt: "2026-01-01T00:00:00.000Z",
    };
    picker.controller._setDocuments([ownerDocument]);
    picker.controller.reload = async () => {
      reloaded.push("reload");
      return picker.controller.getDocuments();
    };
    const commands = createDocumentBrowserCommands({
      documentPickerController: picker.controller,
      getCurrentDocUrl: () => "doc://current",
      switchToDocument: async () => {},
      createNewDocument: async () => {},
      flushThumbnailSave: async () => {},
      listDocuments: async () => picker.controller.getDocuments(),
      claimDocument: async (document) => {
        claimCalls.push(`${document.docUrl}:${document.accessTokenScope}`);
      },
      isClaimableDocument: (document) => document.accessTokenScope === "owner",
      deleteDocument: async () => {},
      confirmDelete: async () => true,
      isDestroyed: () => false,
    });

    await commands.openDocumentPicker();
    await commands.claimDocumentFromBrowser("doc://owner");

    expect(claimCalls).toEqual(["doc://owner:owner"]);
    expect(reloaded).toEqual(["reload"]);
    expect(picker.claimableCalls).toEqual([
      [],
      ["doc://owner"],
      [],
      ["doc://owner"],
    ]);
    expect(picker.busy).toEqual(["doc://owner", null]);
  });

  test("deleteDocumentFromBrowser marks non-current document as removing during delete", async () => {
    const picker = createPickerState();
    picker.controller._setOpen(true);
    picker.controller._setDocuments([
      {
        docUrl: "doc://other",
        mode: "normal",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        lastOpenedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    const commands = createDocumentBrowserCommands({
      documentPickerController: picker.controller,
      getCurrentDocUrl: () => "doc://current",
      switchToDocument: async () => {},
      createNewDocument: async () => {},
      flushThumbnailSave: async () => {},
      listDocuments: async () => picker.controller.getDocuments(),
      claimDocument: async () => {},
      isClaimableDocument: () => false,
      deleteDocument: async () => {},
      confirmDelete: async () => true,
      isDestroyed: () => false,
    });

    await commands.deleteDocumentFromBrowser("doc://other");

    expect(picker.removing).toEqual([
      "doc://other",
      "wait:doc://other",
    ]);
  });

  test("claimDocumentFromBrowser hides claim after successful attachment state update", async () => {
    const picker = createPickerState();
    picker.controller._setOpen(true);
    const ownerDocument = {
      docUrl: "doc://owner",
      collaborative: true,
      collabDocUrl: "automerge:owner",
      accessToken: "owner-token",
      accessTokenScope: "owner" as const,
      accountAttached: false,
      mode: "normal" as const,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      lastOpenedAt: "2026-01-01T00:00:00.000Z",
    };
    picker.controller._setDocuments([ownerDocument]);
    picker.controller.reload = async () => {
      picker.controller._setDocuments([
        {
          ...ownerDocument,
          accountAttached: true,
        },
      ]);
      return picker.controller.getDocuments();
    };
    const commands = createDocumentBrowserCommands({
      documentPickerController: picker.controller,
      getCurrentDocUrl: () => "doc://current",
      switchToDocument: async () => {},
      createNewDocument: async () => {},
      flushThumbnailSave: async () => {},
      listDocuments: async () => picker.controller.getDocuments(),
      claimDocument: async () => {},
      isClaimableDocument: (document) =>
        document.accessTokenScope === "owner" && !document.accountAttached,
      deleteDocument: async () => {},
      confirmDelete: async () => true,
      isDestroyed: () => false,
    });

    await commands.openDocumentPicker();
    await commands.claimDocumentFromBrowser("doc://owner");

    expect(picker.claimableCalls).toEqual([[], ["doc://owner"], [], []]);
  });

  test("claimDocumentFromBrowser surfaces local claim errors", async () => {
    const picker = createPickerState();
    picker.controller._setOpen(true);
    picker.controller._setDocuments([
      {
        docUrl: "doc://device",
        collaborative: true,
        accessToken: "device-token",
        accessTokenScope: "device",
        mode: "normal",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        lastOpenedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    const errors: string[] = [];
    const commands = createDocumentBrowserCommands({
      documentPickerController: picker.controller,
      getCurrentDocUrl: () => "doc://current",
      switchToDocument: async () => {},
      createNewDocument: async () => {},
      flushThumbnailSave: async () => {},
      listDocuments: async () => picker.controller.getDocuments(),
      claimDocument: async () => {
        throw new Error("This browser only has join access for this drawing.");
      },
      isClaimableDocument: () => false,
      deleteDocument: async () => {},
      confirmDelete: async () => true,
      onClaimError: (message) => {
        errors.push(message);
      },
      isDestroyed: () => false,
    });

    await commands.openDocumentPicker();
    await commands.claimDocumentFromBrowser("doc://device");

    expect(errors).toEqual([
      "This browser only has join access for this drawing.",
    ]);
    expect(picker.busy).toEqual(["doc://device", null]);
  });

  test("openDocumentFromBrowser surfaces document access errors", async () => {
    const picker = createPickerState();
    picker.controller._setOpen(true);
    const errors: string[] = [];
    const commands = createDocumentBrowserCommands({
      documentPickerController: picker.controller,
      getCurrentDocUrl: () => "doc://current",
      switchToDocument: async () => {
        throw new DocumentAccessError({
          reason: "auth_required",
          title: "You can't access this drawing",
          userMessage:
            "Log in or sign up to open this account-linked drawing.",
        });
      },
      createNewDocument: async () => {},
      flushThumbnailSave: async () => {},
      listDocuments: async () => picker.controller.getDocuments(),
      claimDocument: async () => {},
      isClaimableDocument: () => false,
      deleteDocument: async () => {},
      confirmDelete: async () => true,
      onOpenDocumentError: (message) => {
        errors.push(message);
      },
      isDestroyed: () => false,
    });

    await commands.openDocumentFromBrowser("doc://account");

    expect(errors).toEqual([
      "Log in or sign up to open this account-linked drawing.",
    ]);
    expect(picker.busy).toEqual(["doc://account", null]);
  });
});
