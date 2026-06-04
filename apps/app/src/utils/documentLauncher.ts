import type { AccountDocumentSummary } from "@smalldraw/shared";
import type { KidsDocumentSummary } from "@smalldraw/splat/documents";
import {
  buildDrawingDocumentUrl,
  buildLocalDrawingUrl,
  type AccountWebRuntimeConfig,
} from "./drawingAppLinks";

export type LauncherDocumentTile = {
  key: string;
  title: string;
  href: string;
  badge: "Local" | "Shared";
  thumbnailUrl?: string;
  deleteAction?: LauncherDocumentDeleteAction;
};

export type LocalLauncherDocument = KidsDocumentSummary & {
  thumbnailUrl?: string;
};

export type LauncherDocumentDeleteAction =
  | { type: "local"; docUrl: string }
  | { type: "shared"; documentId: string; localDocUrl?: string }
  | { type: "remove-shared"; documentId: string; localDocUrl?: string };

export function buildLauncherDocumentTiles(options: {
  localDocuments: LocalLauncherDocument[];
  accountDocuments: AccountDocumentSummary[];
  config: AccountWebRuntimeConfig;
}): LauncherDocumentTile[] {
  const localAccountDocumentIds = new Set(
    options.localDocuments.flatMap((document) => {
      const documentId = resolveAccountDocumentId(document);
      return documentId ? [documentId] : [];
    }),
  );

  const localTiles = options.localDocuments.map((document) => ({
    key: `local:${document.docUrl}`,
    title: resolveLocalDocumentTitle(document),
    href: buildLocalDrawingUrl(document.docUrl, options.config),
    badge: document.collaborative ? ("Shared" as const) : ("Local" as const),
    thumbnailUrl: document.thumbnailUrl ?? document.remoteThumbnailUrl,
    deleteAction: resolveLocalDocumentDeleteAction(document),
  }));

  const accountTiles = options.accountDocuments
    .filter((document) => !localAccountDocumentIds.has(document.id))
    .map((document) => ({
      key: `account:${document.id}`,
      title: document.name,
      href: buildDrawingDocumentUrl(document.id, options.config),
      badge: "Shared" as const,
      thumbnailUrl: document.thumbnailUrl ?? undefined,
      deleteAction: document.isAdmin
        ? { type: "shared" as const, documentId: document.id }
        : { type: "remove-shared" as const, documentId: document.id },
    }));

  return [...localTiles, ...accountTiles];
}

function resolveLocalDocumentDeleteAction(
  document: LocalLauncherDocument,
): LauncherDocumentDeleteAction | undefined {
  const accountDocumentId = resolveAccountDocumentId(document);
  if (document.canDeleteFromServer && accountDocumentId) {
    return {
      type: "shared",
      documentId: accountDocumentId,
      localDocUrl: document.docUrl,
    };
  }
  if (document.accountAttached && accountDocumentId) {
    return {
      type: "remove-shared",
      documentId: accountDocumentId,
      localDocUrl: document.docUrl,
    };
  }
  return { type: "local", docUrl: document.docUrl };
}

function resolveAccountDocumentId(
  document: KidsDocumentSummary,
): string | null {
  if (!document.accountAttached || !document.collabDocUrl) {
    return null;
  }
  return document.collabDocUrl.startsWith("automerge:")
    ? document.collabDocUrl.slice("automerge:".length)
    : document.collabDocUrl;
}

function resolveLocalDocumentTitle(document: KidsDocumentSummary): string {
  const title = document.title?.trim();
  if (title) {
    return title;
  }
  return `Drawing ${document.docUrl.slice(-8)}`;
}
