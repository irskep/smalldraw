import { describe, expect, test } from "bun:test";
import { Trash2 } from "lucide";
import { createKidsDrawCommandController } from "../controller/createKidsDrawCommandController";

describe("createKidsDrawCommandController share controls", () => {
  test("does not run share when sharing is hidden", async () => {
    const events: string[] = [];
    const controller = createController({
      isSharingAllowed: () => false,
      requestSharePermission: async () => {
        events.push("permission");
        return true;
      },
      shareCurrentDocument: async () => {
        events.push("share");
      },
      setSharePending: (pending) => {
        events.push(`pending:${pending}`);
      },
    });

    controller.shareAndClose();
    await Promise.resolve();

    expect(events).toEqual([]);
  });

  test("asks permission before sharing", async () => {
    const events: string[] = [];
    const controller = createController({
      isSharingAllowed: () => true,
      requestSharePermission: async () => {
        events.push("permission");
        return false;
      },
      shareCurrentDocument: async () => {
        events.push("share");
      },
      setSharePending: (pending) => {
        events.push(`pending:${pending}`);
      },
    });

    controller.shareAndClose();
    await Promise.resolve();

    expect(events).toEqual(["permission"]);
  });

  test("shares after permission when sharing stays allowed", async () => {
    const events: string[] = [];
    const controller = createController({
      isSharingAllowed: () => true,
      requestSharePermission: async () => {
        events.push("permission");
        return true;
      },
      shareCurrentDocument: async () => {
        events.push("share");
      },
      setSharePending: (pending) => {
        events.push(`pending:${pending}`);
      },
    });

    controller.shareAndClose();
    await Promise.resolve();
    await Promise.resolve();

    expect(events).toEqual([
      "permission",
      "pending:true",
      "share",
      "pending:false",
    ]);
  });
});

function createController(options: {
  isSharingAllowed: () => boolean;
  requestSharePermission: () => Promise<boolean>;
  shareCurrentDocument: () => Promise<void>;
  setSharePending: (pending: boolean) => void;
}) {
  return createKidsDrawCommandController({
    store: {
      undo() {},
      redo() {},
      applyAction() {},
      getDocument() {
        return { shapes: {}, rootShapeIds: [] };
      },
    } as never,
    toolbarUiStore: {
      setNewDrawingPending() {},
      setSharePending: options.setSharePending,
    },
    snapshotService: {
      async createPngExport() {
        return { blob: null, dataUrl: null };
      },
    },
    getSize: () => ({ width: 100, height: 100 }),
    openDocumentPicker: async () => {},
    openDocumentCreateDialog: () => {},
    shareCurrentDocument: options.shareCurrentDocument,
    isSharingAllowed: options.isSharingAllowed,
    requestSharePermission: options.requestSharePermission,
    confirmDestructiveAction: async () => true,
    clearConfirmationIcon: Trash2,
    loadedDocumentCommands: {
      run(command) {
        void command();
      },
    },
    isDestroyed: () => false,
    debugLifecycle: () => {},
  });
}
