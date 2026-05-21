import type { DocumentId } from "@automerge/automerge-repo";
import type { DrawingDocumentSize } from "@smalldraw/core";
import type { KidsDrawAppOptions } from "./types";
import {
  isMultiplayerApiAuthError,
  MultiplayerApiError,
  type MultiplayerApiClient,
} from "./createMultiplayerApiClient";
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

export class DocumentAccessError extends Error {
  readonly kind = "document_access";
  readonly reason:
    | "auth_required"
    | "invalid_share_link"
    | "local_document_missing"
    | "server_unavailable";
  readonly title: string;
  readonly userMessage: string;

  constructor(options: {
    reason:
      | "auth_required"
      | "invalid_share_link"
      | "local_document_missing"
      | "server_unavailable";
    title: string;
    userMessage: string;
    cause?: unknown;
  }) {
    super(options.userMessage, { cause: options.cause });
    this.name = "DocumentAccessError";
    this.reason = options.reason;
    this.title = options.title;
    this.userMessage = options.userMessage;
  }
}

export function isDocumentAccessError(
  error: unknown,
): error is DocumentAccessError {
  return error instanceof DocumentAccessError;
}

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
          throw new DocumentAccessError({
            reason: "local_document_missing",
            title: "This drawing is not available here",
            userMessage: "This drawing is not stored in this browser anymore.",
          });
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
        throw new DocumentAccessError({
          reason: "invalid_share_link",
          title: "This share link does not work",
          userMessage: "This share link is invalid or no longer available.",
        });
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
      const localSummary = await findLocalCollaborativeSummaryByDocumentId({
        documentBackend: options.documentBackend,
        documentId: options.startupIntent.documentId,
      });
      let resolved: Awaited<
        ReturnType<
          MultiplayerApiClient["resolveCollaborativeDocumentByAccountDocumentId"]
        >
      >;
      try {
        resolved =
          await options.multiplayerApiClient.resolveCollaborativeDocumentByAccountDocumentId(
            options.startupIntent.documentId,
            options.deviceTag,
          );
      } catch (error) {
        if (
          isMultiplayerApiAuthError(error) &&
          localSummary &&
          canUseLocalCollaborativeAccess(localSummary)
        ) {
          await options.documentBackend.setCurrentDocument(localSummary.docUrl);
          return startupPreImports;
        }
        if (isMultiplayerApiAuthError(error)) {
          throw new DocumentAccessError({
            reason: "auth_required",
            title: "You can't access this drawing",
            userMessage:
              "Log in or sign up to open this account-linked drawing.",
            cause: error,
          });
        }
        throw new DocumentAccessError({
          reason: "server_unavailable",
          title: "Could not open drawing",
          userMessage: resolveDocumentOpenFailureMessage(error),
          cause: error,
        });
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
  console.info("[kids-draw:documents] local-open collaborative resolve start", {
    summaryDocUrl: summary.docUrl,
    collabDocUrl: summary.collabDocUrl,
    documentId,
  });
  try {
    const resolved =
      await options.multiplayerApiClient.resolveCollaborativeDocumentByAccountDocumentId(
        documentId,
        options.deviceTag,
      );
    console.info(
      "[kids-draw:documents] local-open collaborative resolve complete",
      {
        summaryDocUrl: summary.docUrl,
        collabDocUrl: summary.collabDocUrl,
        documentId,
      },
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
    if (
      isMultiplayerApiAuthError(error) &&
      canUseLocalCollaborativeAccess(summary)
    ) {
      configureLocalCollaborativeAccess({
        localRepo: options.localRepo,
        summary,
      });
      return null;
    }
    console.warn("[kids-draw:documents] failed to resolve account document", {
      documentId,
      summaryDocUrl: summary.docUrl,
      collabDocUrl: summary.collabDocUrl,
      error,
    });
    throw new DocumentAccessError({
      reason: isMultiplayerApiAuthError(error)
        ? "auth_required"
        : "server_unavailable",
      title: isMultiplayerApiAuthError(error)
        ? "You can't access this drawing"
        : "Could not open drawing",
      userMessage: isMultiplayerApiAuthError(error)
        ? "Log in or sign up to open this account-linked drawing."
        : resolveDocumentOpenFailureMessage(error),
      cause: error,
    });
  }
}

function resolveDocumentOpenFailureMessage(error: unknown): string {
  if (
    error instanceof MultiplayerApiError &&
    error.code === "NOT_FOUND" &&
    error.message.trim().length > 0
  ) {
    return error.message;
  }
  return "The drawing could not be opened right now. Please try again.";
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

async function findLocalCollaborativeSummaryByDocumentId(options: {
  documentBackend: KidsDocumentBackend;
  documentId: string;
}): Promise<KidsDocumentSummary | null> {
  const collabDocUrl = `automerge:${options.documentId}`;
  const documents = await options.documentBackend.listDocuments();
  const match =
    documents.find((summary) => summary.collabDocUrl === collabDocUrl) ?? null;
  return match;
}

function canUseLocalCollaborativeAccess(
  summary: KidsDocumentSummary | null,
): summary is KidsDocumentSummary & {
  collaborative: true;
  collabDocUrl: string;
  accessToken: string;
} {
  return Boolean(
    isCollaborativeDocument(summary) &&
      summary.accessToken &&
      summary.accessToken.length > 0,
  );
}

function configureLocalCollaborativeAccess(options: {
  localRepo: LocalSmalldrawRepo | null;
  summary: KidsDocumentSummary & {
    collaborative: true;
    collabDocUrl: string;
    accessToken: string;
  };
}): void {
  if (!options.localRepo) {
    return;
  }
  options.localRepo.setWebsocketAuthorizedDocumentId(
    resolveCollaborativeDocumentId(options.summary.collabDocUrl),
  );
  options.localRepo.setWebsocketAuthToken(options.summary.accessToken);
}
