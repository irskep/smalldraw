import {
  type AccountCollaborativeDocumentResolution,
  type AccountCollaborativeDocumentSummary,
  type AccountSettings,
  type AccountSettingsInput,
  type AnonymousCollaborativeDocumentResolution,
  type AppError,
  type ClaimCollaborativeDocumentResult,
  createAppError,
  type DeletedAccountDocument,
  type DocumentInvitationToken,
  isAppError,
  type RegisteredCollaborativeDocument,
  type RemovedAccountDocument,
  type SyncedAccountDocument,
} from "@smalldraw/shared";
import {
  createTRPCUntypedClient,
  httpBatchLink,
  TRPCClientError,
  type TRPCClientErrorBase,
} from "@trpc/client";
import type { DefaultErrorShape } from "@trpc/server/unstable-core-do-not-import";

export class MultiplayerApiError extends Error {
  readonly appError: AppError;

  constructor(
    appError: AppError,
    options?: {
      cause?: unknown;
    },
  ) {
    super(appError.message, { cause: options?.cause });
    this.name = "MultiplayerApiError";
    this.appError = appError;
  }
}

export interface MultiplayerApiClient {
  listAccountCollaborativeDocuments(): Promise<
    AccountCollaborativeDocumentSummary[]
  >;
  registerCollaborativeDocument(
    documentId: string,
    content: Uint8Array,
    deviceTag: string,
  ): Promise<RegisteredCollaborativeDocument>;
  registerAccountSyncedDocument(
    documentId: string,
    content: Uint8Array,
  ): Promise<SyncedAccountDocument>;
  createShareInvitation(documentId: string): Promise<DocumentInvitationToken>;
  getAccountSettings(): Promise<AccountSettings>;
  saveAccountSettings(input: AccountSettingsInput): Promise<AccountSettings>;
  verifyAccountSettingsPin(pin: string): Promise<boolean>;
  resolveCollaborativeDocumentByJoinSecret(
    joinSecret: string,
    deviceTag: string,
  ): Promise<AnonymousCollaborativeDocumentResolution | null>;
  resolveCollaborativeDocumentByAccountDocumentId(
    documentId: string,
    deviceTag: string,
  ): Promise<AccountCollaborativeDocumentResolution>;
  claimCollaborativeDocument(
    accessToken: string,
  ): Promise<ClaimCollaborativeDocumentResult>;
  deleteCollaborativeDocument(
    documentId: string,
  ): Promise<DeletedAccountDocument>;
  removeCollaborativeDocumentFromAccount(
    documentId: string,
  ): Promise<RemovedAccountDocument>;
  uploadDocumentThumbnail(documentId: string, thumbnail: Blob): Promise<void>;
}

export function createMultiplayerApiClient(options: {
  apiUrl: string;
}): MultiplayerApiClient {
  const client = createTRPCUntypedClient({
    links: [
      httpBatchLink({
        url: options.apiUrl,
        fetch(url, init) {
          return fetch(url, {
            ...init,
            credentials: "include",
          });
        },
      }),
    ],
  });

  return {
    async listAccountCollaborativeDocuments() {
      let result: unknown;
      try {
        result = await client.query("listAccountCollaborativeDocuments");
      } catch (error) {
        throw normalizeMultiplayerApiError(
          error,
          "Failed to list account drawings.",
        );
      }
      const parsed = parseAccountDocumentListResult(result);
      if (!parsed) {
        throw new Error(
          "Invalid response from listAccountCollaborativeDocuments",
        );
      }
      return parsed;
    },
    async registerCollaborativeDocument(documentId, content, deviceTag) {
      const contentBase64 = uint8ArrayToBase64(content);
      let result: unknown;
      try {
        result = await client.mutation("registerCollaborativeDocument", {
          documentId,
          content: contentBase64,
          deviceTag,
        });
      } catch (error) {
        throw normalizeMultiplayerApiError(
          error,
          "Failed to register collaborative drawing.",
        );
      }
      const parsed = parseRegisterResult(result);
      if (!parsed) {
        throw new Error("Invalid response from registerCollaborativeDocument");
      }
      return parsed;
    },
    async registerAccountSyncedDocument(documentId, content) {
      const contentBase64 = uint8ArrayToBase64(content);
      let result: unknown;
      try {
        result = await client.mutation("registerAccountSyncedDocument", {
          documentId,
          content: contentBase64,
        });
      } catch (error) {
        throw normalizeMultiplayerApiError(
          error,
          "Failed to sync drawing to your account.",
        );
      }
      const parsed = parseAccountSyncResult(result);
      if (!parsed) {
        throw new Error("Invalid response from registerAccountSyncedDocument");
      }
      return parsed;
    },
    async createShareInvitation(documentId) {
      let result: unknown;
      try {
        result = await client.mutation("createOrRefreshDocumentInvitation", {
          documentId,
        });
      } catch (error) {
        throw normalizeMultiplayerApiError(
          error,
          "Failed to create share link.",
        );
      }
      if (
        !result ||
        typeof result !== "object" ||
        typeof (result as { token?: unknown }).token !== "string"
      ) {
        throw new Error(
          "Invalid response from createOrRefreshDocumentInvitation",
        );
      }
      return { token: (result as { token: string }).token };
    },
    async getAccountSettings() {
      let result: unknown;
      try {
        result = await client.query("accountSettings");
      } catch (error) {
        throw normalizeMultiplayerApiError(
          error,
          "Failed to load account settings.",
        );
      }
      const parsed = parseAccountSettings(result);
      if (!parsed) {
        throw new Error("Invalid response from accountSettings");
      }
      return parsed;
    },
    async saveAccountSettings(input) {
      let result: unknown;
      try {
        result = await client.mutation("saveAccountSettings", input);
      } catch (error) {
        throw normalizeMultiplayerApiError(
          error,
          "Failed to save account settings.",
        );
      }
      const parsed = parseAccountSettings(result);
      if (!parsed) {
        throw new Error("Invalid response from saveAccountSettings");
      }
      return parsed;
    },
    async verifyAccountSettingsPin(pin) {
      let result: unknown;
      try {
        result = await client.mutation("verifyAccountSettingsPin", { pin });
      } catch (error) {
        throw normalizeMultiplayerApiError(
          error,
          "Failed to verify account settings PIN.",
        );
      }
      if (
        !result ||
        typeof result !== "object" ||
        typeof (result as { valid?: unknown }).valid !== "boolean"
      ) {
        throw new Error("Invalid response from verifyAccountSettingsPin");
      }
      return (result as { valid: boolean }).valid;
    },
    async resolveCollaborativeDocumentByJoinSecret(joinSecret, deviceTag) {
      let result: unknown;
      console.info("[kids-draw:documents] anonymous resolve start", {
        joinSecret,
        deviceTag,
      });
      try {
        result = await client.query("resolveAnonymousCollaborativeDocument", {
          joinSecret,
          deviceTag,
        });
      } catch (error) {
        console.warn("[kids-draw:documents] anonymous resolve failed", {
          joinSecret,
          deviceTag,
          error,
        });
        throw normalizeMultiplayerApiError(
          error,
          "Failed to resolve shared drawing.",
        );
      }
      console.info("[kids-draw:documents] anonymous resolve complete", {
        joinSecret,
        deviceTag,
      });
      if (result == null) {
        return null;
      }
      const parsed = parseResolveResult(result);
      if (!parsed) {
        throw new Error(
          "Invalid response from resolveAnonymousCollaborativeDocument",
        );
      }
      return parsed;
    },
    async resolveCollaborativeDocumentByAccountDocumentId(
      documentId,
      deviceTag,
    ) {
      let result: unknown;
      console.info("[kids-draw:documents] account resolve start", {
        documentId,
        deviceTag,
      });
      try {
        result = await client.query("resolveAccountCollaborativeDocument", {
          documentId,
          deviceTag,
        });
      } catch (error) {
        console.warn("[kids-draw:documents] account resolve failed", {
          documentId,
          deviceTag,
          error,
        });
        throw normalizeMultiplayerApiError(
          error,
          "Failed to resolve account drawing.",
        );
      }
      console.info("[kids-draw:documents] account resolve complete", {
        documentId,
        deviceTag,
      });
      const parsed = parseAccountResolveResult(result);
      if (!parsed) {
        throw new Error(
          "Invalid response from resolveAccountCollaborativeDocument",
        );
      }
      return parsed;
    },
    async claimCollaborativeDocument(accessToken) {
      let result: unknown;
      try {
        result = await client.mutation("claimCollaborativeDocument", {
          accessToken,
        });
      } catch (error) {
        throw normalizeMultiplayerApiError(error, "Failed to claim drawing.");
      }
      const parsed = parseClaimResult(result);
      if (!parsed) {
        throw new Error("Invalid response from claimCollaborativeDocument");
      }
      return parsed;
    },
    async deleteCollaborativeDocument(documentId) {
      let result: unknown;
      try {
        result = await client.mutation("deleteDocument", { id: documentId });
      } catch (error) {
        throw normalizeMultiplayerApiError(error, "Failed to delete drawing.");
      }
      const parsed = parseDeleteResult(result);
      if (!parsed) {
        throw new Error("Invalid response from deleteDocument");
      }
      return parsed;
    },
    async removeCollaborativeDocumentFromAccount(documentId) {
      let result: unknown;
      try {
        result = await client.mutation("removeDocumentFromAccount", {
          id: documentId,
        });
      } catch (error) {
        throw normalizeMultiplayerApiError(error, "Failed to remove drawing.");
      }
      const parsed = parseRemoveResult(result);
      if (!parsed) {
        throw new Error("Invalid response from removeDocumentFromAccount");
      }
      return parsed;
    },
    async uploadDocumentThumbnail(documentId, thumbnail) {
      const contentType = thumbnail.type || "application/octet-stream";
      const result = await client.mutation("uploadDocumentThumbnail", {
        documentId,
        contentType,
      });
      const parsed = parseUploadThumbnailResult(result);
      if (!parsed) {
        throw new Error("Invalid response from uploadDocumentThumbnail");
      }
      const response = await fetch(parsed.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: thumbnail,
      });
      if (!response.ok) {
        throw new Error(
          `Thumbnail upload to storage failed: ${response.status}`,
        );
      }
    },
  };
}

export function isMultiplayerApiAuthError(error: unknown): boolean {
  if (error instanceof MultiplayerApiError) {
    return error.appError.code === "DOCUMENT_AUTH_REQUIRED";
  }
  if (error instanceof TRPCClientError) {
    return (
      error.data?.code === "UNAUTHORIZED" || error.message === "UNAUTHORIZED"
    );
  }
  return error instanceof Error && error.message === "UNAUTHORIZED";
}

function normalizeMultiplayerApiError(
  error: unknown,
  fallbackMessage: string,
): Error {
  if (error instanceof MultiplayerApiError) {
    return error;
  }
  if (error instanceof TRPCClientError) {
    return new MultiplayerApiError(
      extractAppError(error) ?? fallbackAppError(error, fallbackMessage),
      { cause: error },
    );
  }
  if (error instanceof Error) {
    return error;
  }
  return new Error(fallbackMessage);
}

type SmalldrawTrpcClientError = TRPCClientErrorBase<DefaultErrorShape> & Error;

function extractAppError(error: SmalldrawTrpcClientError): AppError | null {
  const appError = (error.data as { appError?: unknown } | undefined)?.appError;
  return isAppError(appError) ? appError : null;
}

function fallbackAppError(
  error: SmalldrawTrpcClientError,
  fallbackMessage: string,
): AppError {
  if (error.data?.code === "UNAUTHORIZED" || error.message === "UNAUTHORIZED") {
    return createAppError({
      code: "DOCUMENT_AUTH_REQUIRED",
      title: "You can't access this drawing",
      message: "Log in or sign up to open this account-linked drawing.",
      severity: "recoverable",
      retryable: false,
    });
  }
  if (error.data?.code === "NOT_FOUND") {
    return createAppError({
      code: "DOCUMENT_NOT_FOUND",
      title: "Could not open drawing",
      message: "This drawing is no longer available.",
      severity: "recoverable",
      retryable: false,
    });
  }
  return createAppError({
    code: "NETWORK_UNAVAILABLE",
    title: "Could not open drawing",
    message: fallbackMessage,
    severity: "recoverable",
    retryable: true,
  });
}

function parseAccountDocumentListResult(
  input: unknown,
): AccountCollaborativeDocumentSummary[] | null {
  if (!Array.isArray(input)) {
    return null;
  }
  const documents: AccountCollaborativeDocumentSummary[] = [];
  for (const item of input) {
    if (
      !item ||
      typeof item !== "object" ||
      typeof (item as { documentId?: unknown }).documentId !== "string" ||
      typeof (item as { name?: unknown }).name !== "string" ||
      typeof (item as { isAdmin?: unknown }).isAdmin !== "boolean"
    ) {
      return null;
    }
    const thumbnailUrl = (item as { thumbnailUrl?: unknown }).thumbnailUrl;
    if (thumbnailUrl != null && typeof thumbnailUrl !== "string") {
      return null;
    }
    documents.push({
      documentId: (item as { documentId: string }).documentId,
      name: (item as { name: string }).name,
      isAdmin: (item as { isAdmin: boolean }).isAdmin,
      thumbnailUrl: thumbnailUrl ?? null,
    });
  }
  return documents;
}

function parseRegisterResult(
  input: unknown,
): RegisteredCollaborativeDocument | null {
  if (
    !input ||
    typeof input !== "object" ||
    typeof (input as { collabDocUrl?: unknown }).collabDocUrl !== "string" ||
    typeof (input as { joinSecret?: unknown }).joinSecret !== "string" ||
    typeof (input as { accessToken?: unknown }).accessToken !== "string" ||
    (input as { accessTokenScope?: unknown }).accessTokenScope !== "owner"
  ) {
    return null;
  }
  return {
    collabDocUrl: (input as { collabDocUrl: string }).collabDocUrl,
    joinSecret: (input as { joinSecret: string }).joinSecret,
    accessToken: (input as { accessToken: string }).accessToken,
    accessTokenScope: (input as { accessTokenScope: "owner" }).accessTokenScope,
  };
}

function parseAccountSyncResult(input: unknown): SyncedAccountDocument | null {
  if (
    !input ||
    typeof input !== "object" ||
    typeof (input as { collabDocUrl?: unknown }).collabDocUrl !== "string" ||
    typeof (input as { accessToken?: unknown }).accessToken !== "string" ||
    (input as { accessTokenScope?: unknown }).accessTokenScope !== "owner"
  ) {
    return null;
  }
  return {
    collabDocUrl: (input as { collabDocUrl: string }).collabDocUrl,
    accessToken: (input as { accessToken: string }).accessToken,
    accessTokenScope: "owner",
  };
}

function parseAccountSettings(input: unknown): AccountSettings | null {
  if (
    !input ||
    typeof input !== "object" ||
    !isAccountShareMode((input as { shareMode?: unknown }).shareMode) ||
    typeof (input as { syncNewDrawingsByDefault?: unknown })
      .syncNewDrawingsByDefault !== "boolean" ||
    typeof (input as { hasPin?: unknown }).hasPin !== "boolean"
  ) {
    return null;
  }
  return {
    shareMode: (input as { shareMode: AccountSettings["shareMode"] }).shareMode,
    syncNewDrawingsByDefault: (input as { syncNewDrawingsByDefault: boolean })
      .syncNewDrawingsByDefault,
    hasPin: (input as { hasPin: boolean }).hasPin,
  };
}

function isAccountShareMode(
  input: unknown,
): input is AccountSettings["shareMode"] {
  return (
    input === "private_sync" || input === "pin_required" || input === "allowed"
  );
}

function parseResolveResult(
  input: unknown,
): AnonymousCollaborativeDocumentResolution | null {
  if (
    !input ||
    typeof input !== "object" ||
    typeof (input as { collabDocUrl?: unknown }).collabDocUrl !== "string" ||
    typeof (input as { joinSecret?: unknown }).joinSecret !== "string" ||
    typeof (input as { accessToken?: unknown }).accessToken !== "string" ||
    (input as { accessTokenScope?: unknown }).accessTokenScope !== "device" ||
    typeof (input as { content?: unknown }).content !== "string"
  ) {
    return null;
  }
  return {
    collabDocUrl: (input as { collabDocUrl: string }).collabDocUrl,
    joinSecret: (input as { joinSecret: string }).joinSecret,
    accessToken: (input as { accessToken: string }).accessToken,
    accessTokenScope: (input as { accessTokenScope: "device" })
      .accessTokenScope,
    content: (input as { content: string }).content,
  };
}

function parseAccountResolveResult(
  input: unknown,
): AccountCollaborativeDocumentResolution | null {
  if (
    !input ||
    typeof input !== "object" ||
    typeof (input as { collabDocUrl?: unknown }).collabDocUrl !== "string" ||
    typeof (input as { accessToken?: unknown }).accessToken !== "string" ||
    typeof (input as { accessTokenScope?: unknown }).accessTokenScope !==
      "string" ||
    typeof (input as { content?: unknown }).content !== "string"
  ) {
    return null;
  }
  const accessTokenScope = (input as { accessTokenScope: string })
    .accessTokenScope;
  if (accessTokenScope !== "owner" && accessTokenScope !== "device") {
    return null;
  }
  return {
    collabDocUrl: (input as { collabDocUrl: string }).collabDocUrl,
    accessToken: (input as { accessToken: string }).accessToken,
    accessTokenScope,
    content: (input as { content: string }).content,
  };
}

function parseClaimResult(
  input: unknown,
): ClaimCollaborativeDocumentResult | null {
  if (
    !input ||
    typeof input !== "object" ||
    typeof (input as { documentId?: unknown }).documentId !== "string" ||
    typeof (input as { attached?: unknown }).attached !== "boolean" ||
    typeof (input as { isAdmin?: unknown }).isAdmin !== "boolean"
  ) {
    return null;
  }
  return {
    documentId: (input as { documentId: string }).documentId,
    attached: (input as { attached: boolean }).attached,
    isAdmin: (input as { isAdmin: boolean }).isAdmin,
  };
}

function parseDeleteResult(input: unknown): DeletedAccountDocument | null {
  if (
    !input ||
    typeof input !== "object" ||
    typeof (input as { id?: unknown }).id !== "string"
  ) {
    return null;
  }
  const deletedAt = (input as { deletedAt?: unknown }).deletedAt;
  if (!(deletedAt instanceof Date) && typeof deletedAt !== "string") {
    return null;
  }
  return {
    id: (input as { id: string }).id,
    deletedAt: deletedAt instanceof Date ? deletedAt : new Date(deletedAt),
  };
}

function parseRemoveResult(input: unknown): RemovedAccountDocument | null {
  if (
    !input ||
    typeof input !== "object" ||
    typeof (input as { id?: unknown }).id !== "string"
  ) {
    return null;
  }
  return {
    id: (input as { id: string }).id,
  };
}

function parseUploadThumbnailResult(
  input: unknown,
): { uploadUrl: string } | null {
  if (
    !input ||
    typeof input !== "object" ||
    typeof (input as { uploadUrl?: unknown }).uploadUrl !== "string"
  ) {
    return null;
  }
  return {
    uploadUrl: (input as { uploadUrl: string }).uploadUrl,
  };
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
