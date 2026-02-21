import type { DrawingDocumentSize } from "@smalldraw/core";

export type KidsDocumentMode = "normal" | "coloring";

export interface KidsDocumentSummary {
  docUrl: string;
  title?: string;
  mode: KidsDocumentMode;
  coloringPageId?: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
  thumbnailKey?: string;
}

export interface KidsDocumentCreateInput {
  docUrl: string;
  title?: string;
  mode?: KidsDocumentMode;
  coloringPageId?: string;
  documentSize?: DrawingDocumentSize;
}

export interface KidsDocumentBackend {
  readonly mode: "local";
  listDocuments(): Promise<KidsDocumentSummary[]>;
  getDocument(docUrl: string): Promise<KidsDocumentSummary | null>;
  createDocument(input: KidsDocumentCreateInput): Promise<KidsDocumentSummary>;
  touchDocument(docUrl: string): Promise<KidsDocumentSummary | null>;
  deleteDocument(docUrl: string): Promise<void>;
  saveThumbnail(docUrl: string, blob: Blob): Promise<void>;
  getThumbnail(docUrl: string): Promise<Blob | null>;
  setCurrentDocument(docUrl: string): Promise<void>;
  getCurrentDocument(): Promise<string | null>;
}
