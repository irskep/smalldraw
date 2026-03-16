import { describe, expect, test } from "bun:test";
import {
  createDocument,
  DrawingStore,
  type SmalldrawCore,
} from "@smalldraw/core";
import { DocumentSessionController } from "../controller/createDocumentSessionController";
import { createKidsShapeHandlerRegistry } from "../shapes/kidsShapeHandlers";

function createTestStore(): DrawingStore {
  const shapeHandlers = createKidsShapeHandlerRegistry();
  const doc = createDocument(undefined, shapeHandlers, {
    width: 640,
    height: 480,
  });
  return new DrawingStore({
    tools: [],
    document: doc,
    shapeHandlers,
    actionDispatcher: () => {},
  });
}

describe("DocumentSessionController", () => {
  test("opens collaborative docs using collabDocUrl while preserving local metadata key", async () => {
    const store = createTestStore();
    const openedUrls: string[] = [];
    const touchedUrls: string[] = [];
    const createdUrls: string[] = [];

    const core: SmalldrawCore = {
      storeAdapter: {
        getDoc: () => store.getDocument(),
        applyAction: () => {},
        subscribe: () => () => {},
      },
      getCurrentDocUrl: () => "automerge:local-doc",
      open: async (url) => {
        openedUrls.push(url);
        return {
          getDoc: () => store.getDocument(),
          applyAction: () => {},
          subscribe: () => () => {},
        };
      },
      createNew: async () => {
        throw new Error("unused");
      },
      reset: async () => {
        throw new Error("unused");
      },
      createDocumentCopy: () => {
        throw new Error("unused");
      },
      destroy: () => {},
    };

    const controller = new DocumentSessionController({
      store,
      core,
      documentBackend: {
        mode: "local",
        listDocuments: async () => [],
        getDocument: async (docUrl) =>
          docUrl === "automerge:local-doc"
            ? {
                docUrl: "automerge:local-doc",
                collaborative: true,
                collabDocUrl: "automerge:collab-doc",
                joinSecret: "secret",
                mode: "normal",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                lastOpenedAt: new Date().toISOString(),
              }
            : null,
        createDocument: async (input) => {
          createdUrls.push(input.docUrl);
          return {
            docUrl: input.docUrl,
            mode: input.mode ?? "normal",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastOpenedAt: new Date().toISOString(),
          };
        },
        touchDocument: async (docUrl) => {
          touchedUrls.push(docUrl);
          return {
            docUrl,
            mode: "normal",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastOpenedAt: new Date().toISOString(),
          };
        },
        deleteDocument: async () => {},
        saveThumbnail: async () => {},
        getThumbnail: async () => null,
        setCurrentDocument: async () => {},
        getCurrentDocument: async () => null,
      },
      thumbnailSaveDebounceMs: 1,
      createThumbnailBlob: async () => null,
      getDocumentSizeForCreateRequest: () => ({ width: 640, height: 480 }),
    });

    await controller.switchToDocument("automerge:local-doc");
    await controller.flushDocumentTouch();

    expect(openedUrls).toEqual(["automerge:collab-doc"]);
    expect(createdUrls).toEqual(["automerge:local-doc"]);
    expect(touchedUrls).toEqual(["automerge:local-doc", "automerge:local-doc"]);
  });
});
