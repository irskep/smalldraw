import type { DrawingDocumentSize } from "@smalldraw/core";

export type KidsDocumentMode = "normal" | "coloring" | "markup";
export type KidsDocumentReferenceComposite = "under-drawing" | "over-drawing";

export type AccountCheckpoint = { documentUrl: string; heads: string[] };

export interface KidsDocumentSummary {
  accountCheckpoint?: AccountCheckpoint;
  docUrl: string;
  collaborative?: boolean;
  collabDocUrl?: string;
  joinSecret?: string;
  accessToken?: string;
  accessTokenScope?: "owner" | "device";
  accountAttached?: boolean;
  canDeleteFromServer?: boolean;
  accountSyncPending?: boolean;
  accountSyncLastAttemptAt?: string;
  title?: string;
  mode: KidsDocumentMode;
  coloringPageId?: string;
  referenceImageSrc?: string;
  referenceComposite?: KidsDocumentReferenceComposite;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
  thumbnailKey?: string;
  remoteThumbnailUrl?: string;
}

export interface KidsDocumentCreateInput {
  docUrl: string;
  collaborative?: boolean;
  collabDocUrl?: string;
  joinSecret?: string;
  accessToken?: string;
  accessTokenScope?: "owner" | "device";
  accountAttached?: boolean;
  canDeleteFromServer?: boolean;
  accountSyncPending?: boolean;
  accountSyncLastAttemptAt?: string;
  title?: string;
  mode?: KidsDocumentMode;
  coloringPageId?: string;
  referenceImageSrc?: string;
  referenceComposite?: KidsDocumentReferenceComposite;
  remoteThumbnailUrl?: string;
  documentSize?: DrawingDocumentSize;
}

export interface KidsDocumentBackend {
  readonly mode: "local";
  saveAccountCheckpoint(
    docUrl: string,
    checkpoint: AccountCheckpoint,
  ): Promise<void>;
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
