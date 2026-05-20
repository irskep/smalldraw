import {
  TRPCClientError,
  createTRPCUntypedClient,
  httpBatchLink,
} from "@trpc/client";

export class MultiplayerApiError extends Error {
  readonly code?: string;

  constructor(
    message: string,
    options?: {
      code?: string;
      cause?: unknown;
    },
  ) {
    super(message, { cause: options?.cause });
    this.name = "MultiplayerApiError";
    this.code = options?.code;
  }
}

export interface MultiplayerApiClient {
  listAccountCollaborativeDocuments(): Promise<
    Array<{
      documentId: string;
      name: string;
      thumbnailUrl: string | null;
    }>
  >;
  registerCollaborativeDocument(
    documentId: string,
    content: Uint8Array,
    deviceTag: string,
  ): Promise<{
    collabDocUrl: string;
    joinSecret: string;
    accessToken: string;
    accessTokenScope: "owner";
  }>;
  resolveCollaborativeDocumentByJoinSecret(
    joinSecret: string,
    deviceTag: string,
  ): Promise<{
    collabDocUrl: string;
    joinSecret: string;
    accessToken: string;
    accessTokenScope: "device";
    content: string;
  } | null>;
  resolveCollaborativeDocumentByAccountDocumentId(
    documentId: string,
    deviceTag: string,
  ): Promise<{
    collabDocUrl: string;
    accessToken: string;
    accessTokenScope: "owner" | "device";
    content: string;
  }>;
  claimCollaborativeDocument(accessToken: string): Promise<{
    documentId: string;
    attached: boolean;
    isAdmin: boolean;
  }>;
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
        throw normalizeMultiplayerApiError(
          error,
          "Failed to claim drawing.",
        );
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
    return error.code === "UNAUTHORIZED";
  }
  if (error instanceof TRPCClientError) {
    return error.data?.code === "UNAUTHORIZED" || error.message === "UNAUTHORIZED";
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
    return new MultiplayerApiError(error.message || fallbackMessage, {
      code: typeof error.data?.code === "string" ? error.data.code : undefined,
      cause: error,
    });
  }
  if (error instanceof Error) {
    return error;
  }
  return new Error(fallbackMessage);
}

function parseAccountDocumentListResult(input: unknown): Array<{
  documentId: string;
  name: string;
  thumbnailUrl: string | null;
}> | null {
  if (!Array.isArray(input)) {
    return null;
  }
  const documents: Array<{
    documentId: string;
    name: string;
    thumbnailUrl: string | null;
  }> = [];
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

function parseRegisterResult(input: unknown): {
  collabDocUrl: string;
  joinSecret: string;
  accessToken: string;
  accessTokenScope: "owner";
} | null {
  if (
    !input ||
    typeof input !== "object" ||
    typeof (input as { collabDocUrl?: unknown }).collabDocUrl !== "string" ||
    typeof (input as { joinSecret?: unknown }).joinSecret !== "string" ||
    typeof (input as { accessToken?: unknown }).accessToken !== "string"
  ) {
    return null;
  }
  return {
    collabDocUrl: (input as { collabDocUrl: string }).collabDocUrl,
    joinSecret: (input as { joinSecret: string }).joinSecret,
    accessToken: (input as { accessToken: string }).accessToken,
    accessTokenScope: "owner",
  };
}

function parseResolveResult(input: unknown): {
  collabDocUrl: string;
  joinSecret: string;
  accessToken: string;
  accessTokenScope: "device";
  content: string;
} | null {
  if (
    !input ||
    typeof input !== "object" ||
    typeof (input as { collabDocUrl?: unknown }).collabDocUrl !== "string" ||
    typeof (input as { joinSecret?: unknown }).joinSecret !== "string" ||
    typeof (input as { accessToken?: unknown }).accessToken !== "string" ||
    typeof (input as { content?: unknown }).content !== "string"
  ) {
    return null;
  }
  return {
    collabDocUrl: (input as { collabDocUrl: string }).collabDocUrl,
    joinSecret: (input as { joinSecret: string }).joinSecret,
    accessToken: (input as { accessToken: string }).accessToken,
    accessTokenScope: "device",
    content: (input as { content: string }).content,
  };
}

function parseAccountResolveResult(input: unknown): {
  collabDocUrl: string;
  accessToken: string;
  accessTokenScope: "owner" | "device";
  content: string;
} | null {
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
): { documentId: string; attached: boolean; isAdmin: boolean } | null {
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
