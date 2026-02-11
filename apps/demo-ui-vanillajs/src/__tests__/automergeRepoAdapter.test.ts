import { describe, expect, test } from "bun:test";
import { automergeWasmBase64 } from "@automerge/automerge/automerge.wasm.base64";
import {
  initializeBase64Wasm,
  isWasmInitialized,
} from "@automerge/automerge/slim";
import type { DocHandle } from "@automerge/automerge-repo";
import { Repo } from "@automerge/automerge-repo/slim";
import {
  type ActionContext,
  AddShape,
  applyActionToDoc,
  DEFAULT_DOCUMENT_SIZE,
  type DrawingDocument,
  type DrawingDocumentData,
  DrawingStore,
  type DrawingStoreActionEvent,
  getDefaultShapeHandlerRegistry,
} from "@smalldraw/core";

const v = (x = 0, y = x): [number, number] => [x, y];

function createTestShape(id: string) {
  return {
    id,
    type: "boxed" as const,
    geometry: { type: "boxed" as const, kind: "rect", size: v(100, 50) },
    style: { fill: { type: "solid" as const, color: "#ff0000" } },
    zIndex: "a0",
    transform: {
      translation: v(0, 0),
      scale: v(1, 1),
      rotation: 0,
    },
  };
}

const registry = getDefaultShapeHandlerRegistry();

const draftChange: ActionContext["change"] = (doc, update) => {
  update(doc as DrawingDocumentData);
  return doc;
};

const actionContext: ActionContext = {
  registry,
  change: draftChange,
};

const createStoreAdapter = (handle: DocHandle<DrawingDocumentData>) => {
  return {
    applyAction: (event: DrawingStoreActionEvent) => {
      if (!handle.isReady()) return;
      handle.change((doc) => {
        if (event.type === "undo") {
          event.action.undo(doc as DrawingDocument, actionContext);
          return;
        }
        applyActionToDoc(
          doc as DrawingDocument,
          event.action,
          registry,
          draftChange,
        );
      });
    },
  };
};

describe("Automerge repo adapter", () => {
  test("store mutation does not throw outdated document error", async () => {
    if (!isWasmInitialized()) {
      await initializeBase64Wasm(automergeWasmBase64);
    }

    const repo = new Repo();
    const handle = repo.create<DrawingDocumentData>({
      size: DEFAULT_DOCUMENT_SIZE,
      shapes: {},
      temporalOrderCounter: 0,
    });
    await handle.whenReady();

    const adapter = createStoreAdapter(handle);
    const store = new DrawingStore({
      tools: [],
      document: handle.doc() as DrawingDocument,
      actionDispatcher: (event) => adapter.applyAction(event),
    });

    expect(() => {
      store.mutateDocument(new AddShape(createTestShape("shape-1")));
    }).not.toThrow();
  });
});
