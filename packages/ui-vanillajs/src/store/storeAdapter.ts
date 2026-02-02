import type { DrawingDocument, DrawingStoreActionEvent } from "@smalldraw/core";

export interface DrawingStoreAdapter {
  getDoc: () => DrawingDocument;
  applyAction: (event: DrawingStoreActionEvent) => void;
  subscribe: (listener: (doc: DrawingDocument) => void) => () => void;
}
