import { describe, expect, test } from "bun:test";
import { createDocumentBrowserCommands } from "../controller/createDocumentBrowserCommands";

function createPickerState() {
  let open = true;
  let createOpen = false;
  const busy: Array<string | null> = [];
  return {
    busy,
    controller: {
      isOpen() {
        return open;
      },
      isCreateDialogOpen() {
        return createOpen;
      },
      setBusyDocument(docUrl: string | null) {
        busy.push(docUrl);
      },
      close() {
        open = false;
      },
      closeCreateDialog() {
        createOpen = false;
      },
      async open() {
        open = true;
      },
      async reload() {},
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
      deleteDocument: async () => {},
      confirmDelete: async () => true,
      isDestroyed: () => false,
    });

    await commands.deleteDocumentFromBrowser("doc://current");

    expect(switched).toEqual([]);
    expect(created).toEqual(["normal"]);
    expect(picker.busy).toEqual(["doc://current", null]);
  });
});
