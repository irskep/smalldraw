import {
  TRPCClientError,
  createTRPCUntypedClient,
  httpBatchLink,
} from "@trpc/client";
import {
  type AccountCollaborativeDocumentResolution,
  type AccountCollaborativeDocumentSummary,
  type AnonymousCollaborativeDocumentResolution,
  type AppError,
  type ClaimCollaborativeDocumentResult,
  createAppError,
  type RegisteredCollaborativeDocument,
  isAppError,
} from "@smalldraw/shared";

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

function extractAppError(error: TRPCClientError<any>): AppError | null {
  const appError = (error.data as { appError?: unknown } | undefined)?.appError;
  return isAppError(appError) ? appError : null;
}

function fallbackAppError(
  error: TRPCClientError<any>,
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
      typeof (item as { name?: unknown }).name !== "string"
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
    accessTokenScope: (input as { accessTokenScope: "owner" })
      .accessTokenScope,
  };
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
