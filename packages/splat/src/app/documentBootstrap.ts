import type { DocumentId } from "@automerge/automerge-repo";
import type { DrawingDocumentSize } from "@smalldraw/core";
import type { KidsDrawAppOptions } from "./types";
import type { MultiplayerApiClient } from "./createMultiplayerApiClient";
import type {
  KidsDocumentBackend,
  KidsDocumentSummary,
  LocalSmalldrawRepo,
} from "../documents";
import {
  automergeUrlToDocumentId,
  buildJoinedCatalogDocUrl,
  isCollaborativeDocument,
} from "../documents";

type StartupIntent = NonNullable<KidsDrawAppOptions["multiplayer"]>["startupIntent"];

export function resolveStartupWebsocketToken(
  initialCatalogSummary: Pick<KidsDocumentSummary, "accessToken"> | null,
): string | null {
  return initialCatalogSummary?.accessToken ?? null;
}

export function resolveCollaborativeDocumentId(documentId: string): string {
  return automergeUrlToDocumentId(documentId) ?? documentId;
}

export function resolveAuthorizedCollaborativeDocumentId(
  websocketToken: string | null,
  initialCatalogSummary: Pick<
    KidsDocumentSummary,
    "collabDocUrl" | "collaborative"
  > | null,
): string | null {
  if (!websocketToken) {
    return null;
  }
  if (
    !initialCatalogSummary?.collaborative ||
    !initialCatalogSummary.collabDocUrl
  ) {
    return null;
  }
  return resolveCollaborativeDocumentId(initialCatalogSummary.collabDocUrl);
}

export function resolveInitialDocumentSize(
  doc: { size?: { width?: unknown; height?: unknown } } | null | undefined,
  fallbackSize: DrawingDocumentSize,
): DrawingDocumentSize {
  const width = doc?.size?.width;
  const height = doc?.size?.height;
  if (
    typeof width === "number" &&
    Number.isFinite(width) &&
    width > 0 &&
    typeof height === "number" &&
    Number.isFinite(height) &&
    height > 0
  ) {
    return { width, height };
  }
  return {
    width: Math.max(1, Math.round(fallbackSize.width)),
    height: Math.max(1, Math.round(fallbackSize.height)),
  };
}

export async function syncAccountCatalog(options: {
  documentBackend: KidsDocumentBackend;
  multiplayerApiClient: MultiplayerApiClient | null;
  selectFirstIfNoCurrent: boolean;
}): Promise<KidsDocumentSummary | null> {
  if (!options.multiplayerApiClient) {
    return null;
  }
  const existingDocuments = await options.documentBackend.listDocuments();
  const existingCurrentDocUrl =
    await options.documentBackend.getCurrentDocument();
  const existingCurrentDocument = existingCurrentDocUrl
    ? await options.documentBackend.getDocument(existingCurrentDocUrl)
    : null;
  const existingByCollabDocUrl = new Map(
    existingDocuments
      .filter(isCollaborativeDocument)
      .map((document) => [document.collabDocUrl, document] as const),
  );

  let accountDocuments: Awaited<
    ReturnType<MultiplayerApiClient["listAccountCollaborativeDocuments"]>
  >;
  try {
    accountDocuments =
      await options.multiplayerApiClient.listAccountCollaborativeDocuments();
  } catch (error) {
    console.info("[kids-draw:documents] account catalog sync skipped", {
      reason: "account_unavailable",
      error,
    });
    return null;
  }

  let selectedDocument: KidsDocumentSummary | null = null;
  for (const accountDocument of accountDocuments) {
    const collabDocUrl = `automerge:${accountDocument.documentId}`;
    const catalogDocUrl =
      existingByCollabDocUrl.get(collabDocUrl)?.docUrl ??
      buildJoinedCatalogDocUrl(collabDocUrl);
    const summary = await options.documentBackend.createDocument({
      docUrl: catalogDocUrl,
      title: accountDocument.name,
      collaborative: true,
      collabDocUrl,
      accountAttached: true,
      remoteThumbnailUrl: accountDocument.thumbnailUrl ?? undefined,
    });
    selectedDocument ??= summary;
  }

  if (
    options.selectFirstIfNoCurrent &&
    !existingCurrentDocument &&
    selectedDocument
  ) {
    await options.documentBackend.setCurrentDocument(selectedDocument.docUrl);
  }
  if (existingCurrentDocument) {
    return existingCurrentDocument;
  }
  return selectedDocument;
}

export async function resolveStartupPreImportsAndCurrentDocument(options: {
  documentBackend: KidsDocumentBackend;
  multiplayerApiClient: MultiplayerApiClient | null;
  startupIntent: StartupIntent;
  deviceTag: string;
  syncedAccountDocument: KidsDocumentSummary | null;
}): Promise<Array<{ binary: Uint8Array; docId: string }>> {
  const startupPreImports: Array<{ binary: Uint8Array; docId: string }> = [];

  switch (options.startupIntent?.kind) {
    case "open-local-document": {
      const existing = await options.documentBackend.getDocument(
        options.startupIntent.docUrl,
      );
      if (!existing) {
        const resolved =
          options.syncedAccountDocument && options.multiplayerApiClient
            ? await resolveAccountDocumentForLocalOpen({
                documentBackend: options.documentBackend,
                multiplayerApiClient: options.multiplayerApiClient,
                localRepo: null,
                deviceTag: options.deviceTag,
                summary: options.syncedAccountDocument,
              })
            : null;
        if (!resolved) {
          throw new Error("This drawing is not stored in this browser.");
        }
        startupPreImports.push({
          binary: resolved.binary,
          docId: resolved.collabDocUrl,
        });
        return startupPreImports;
      }
      await options.documentBackend.setCurrentDocument(
        options.startupIntent.docUrl,
      );
      return startupPreImports;
    }
    case "open-share-link": {
      if (!options.multiplayerApiClient) {
        throw new Error("Multiplayer API is not configured.");
      }
      const resolved =
        await options.multiplayerApiClient.resolveCollaborativeDocumentByJoinSecret(
          options.startupIntent.joinSecret,
          options.deviceTag,
        );
      if (!resolved) {
        throw new Error("Invalid share link.");
      }
      startupPreImports.push({
        binary: base64ToUint8Array(resolved.content),
        docId: resolved.collabDocUrl,
      });
      await createOrSelectCollaborativeCatalogDocument({
        documentBackend: options.documentBackend,
        collabDocUrl: resolved.collabDocUrl,
        createDocumentOptions: {
          collaborative: true,
          collabDocUrl: resolved.collabDocUrl,
          joinSecret: resolved.joinSecret,
          accessToken: resolved.accessToken,
          accessTokenScope: resolved.accessTokenScope,
        },
      });
      return startupPreImports;
    }
    case "open-account-document": {
      if (!options.multiplayerApiClient) {
        throw new Error("Multiplayer API is not configured.");
      }
      const resolved =
        await options.multiplayerApiClient.resolveCollaborativeDocumentByAccountDocumentId(
          options.startupIntent.documentId,
          options.deviceTag,
        );
      startupPreImports.push({
        binary: base64ToUint8Array(resolved.content),
        docId: resolved.collabDocUrl,
      });
      await createOrSelectCollaborativeCatalogDocument({
        documentBackend: options.documentBackend,
        collabDocUrl: resolved.collabDocUrl,
        createDocumentOptions: {
          collaborative: true,
          collabDocUrl: resolved.collabDocUrl,
          accessToken: resolved.accessToken,
          accessTokenScope: resolved.accessTokenScope,
          accountAttached: true,
        },
      });
      return startupPreImports;
    }
    case "open-last-local":
    case undefined: {
      if (options.syncedAccountDocument && options.multiplayerApiClient) {
        const resolved = await resolveAccountDocumentForLocalOpen({
          documentBackend: options.documentBackend,
          multiplayerApiClient: options.multiplayerApiClient,
          localRepo: null,
          deviceTag: options.deviceTag,
          summary: options.syncedAccountDocument,
        });
        if (resolved) {
          startupPreImports.push({
            binary: resolved.binary,
            docId: resolved.collabDocUrl,
          });
        }
      }
      return startupPreImports;
    }
  }
}

export async function resolveAccountDocumentForLocalOpen(options: {
  documentBackend: KidsDocumentBackend;
  multiplayerApiClient: MultiplayerApiClient;
  localRepo: LocalSmalldrawRepo | null;
  deviceTag: string;
  summary: KidsDocumentSummary | null;
}): Promise<{ binary: Uint8Array; collabDocUrl: string } | null> {
  const summary = options.summary;
  if (!summary?.accountAttached || !isCollaborativeDocument(summary)) {
    return null;
  }

  const documentId = resolveCollaborativeDocumentId(summary.collabDocUrl);
  try {
    const resolved =
      await options.multiplayerApiClient.resolveCollaborativeDocumentByAccountDocumentId(
        documentId,
        options.deviceTag,
      );
    const binary = base64ToUint8Array(resolved.content);
    const automergeDocumentId = documentId as DocumentId;
    options.localRepo?.setWebsocketAuthorizedDocumentId(documentId);
    options.localRepo?.setWebsocketAuthToken(resolved.accessToken);
    if (options.localRepo && !options.localRepo.handles[automergeDocumentId]) {
      options.localRepo.import(binary, { docId: automergeDocumentId });
    }
    await options.documentBackend.createDocument({
      docUrl: summary.docUrl,
      title: summary.title,
      collaborative: true,
      collabDocUrl: resolved.collabDocUrl,
      accessToken: resolved.accessToken,
      accessTokenScope: resolved.accessTokenScope,
      accountAttached: true,
    });
    return { binary, collabDocUrl: resolved.collabDocUrl };
  } catch (error) {
    console.warn("[kids-draw:documents] failed to resolve account document", {
      documentId,
      error,
    });
    return null;
  }
}

export function updateRepoWebsocketAuthorization(
  localRepo: LocalSmalldrawRepo | null,
  summary: KidsDocumentSummary | null,
): void {
  if (!localRepo) {
    return;
  }
  if (!summary?.accessToken || !isCollaborativeDocument(summary)) {
    localRepo.setWebsocketAuthorizedDocumentId(null);
    localRepo.setWebsocketAuthToken(null);
    return;
  }
  localRepo.setWebsocketAuthorizedDocumentId(
    resolveCollaborativeDocumentId(summary.collabDocUrl),
  );
  localRepo.setWebsocketAuthToken(summary.accessToken);
}

async function createOrSelectCollaborativeCatalogDocument(options: {
  documentBackend: KidsDocumentBackend;
  collabDocUrl: string;
  createDocumentOptions: Omit<
    Parameters<KidsDocumentBackend["createDocument"]>[0],
    "docUrl"
  >;
}): Promise<void> {
  const existingSummaries = await options.documentBackend.listDocuments();
  const existingSummary = existingSummaries.find(
    (summary) => summary.collabDocUrl === options.collabDocUrl,
  );
  const catalogDocUrl =
    existingSummary?.docUrl ?? buildJoinedCatalogDocUrl(options.collabDocUrl);
  await options.documentBackend.createDocument({
    docUrl: catalogDocUrl,
    ...options.createDocumentOptions,
  });
  await options.documentBackend.setCurrentDocument(catalogDocUrl);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
