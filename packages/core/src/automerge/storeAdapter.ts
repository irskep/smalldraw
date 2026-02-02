import type { DocHandle } from "@automerge/automerge-repo";
import type { ActionContext } from "../actions";
import type { DrawingDocument, DrawingDocumentData } from "../model/document";
import { applyActionToDoc, createDocument } from "../model/document";
import type { ShapeHandlerRegistry } from "../model/shapeHandlers";
import type { DrawingStoreAdapter } from "../store/drawingStore";

export interface AutomergeStoreAdapterOptions {
  handle: DocHandle<DrawingDocumentData>;
  registry: ShapeHandlerRegistry;
  debug?: boolean;
}

export function createAutomergeStoreAdapter(
  options: AutomergeStoreAdapterOptions,
): DrawingStoreAdapter {
  const { handle, registry, debug = false } = options;

  const draftChange: ActionContext["change"] = (doc, update) => {
    update(doc as DrawingDocumentData);
    return doc;
  };

  const actionContext: ActionContext = {
    registry,
    change: draftChange,
  };

  return {
    getDoc: () => {
      try {
        return handle.doc() as DrawingDocument;
      } catch {
        return createDocument(undefined, registry);
      }
    },

    applyAction: (event) => {
      if (!handle.isReady()) return;
      if (debug) {
        console.debug("[automerge-store] dispatch action", event.type);
      }
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

    subscribe: (listener) => {
      const onChange = (payload: { doc: DrawingDocument }) => {
        if (debug) {
          console.debug("[automerge-store] handle change", {
            url: handle.url,
            heads: handle.heads(),
          });
        }
        listener(payload.doc);
      };
      const onDelete = () => {
        if (debug) {
          console.debug("[automerge-store] handle delete", handle.url);
        }
        listener(createDocument(undefined, registry));
      };
      handle.on("change", onChange);
      handle.on("delete", onDelete);
      return () => {
        handle.off("change", onChange);
        handle.off("delete", onDelete);
      };
    },
  };
}
