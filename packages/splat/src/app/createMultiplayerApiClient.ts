import * as cbor from "@automerge/automerge-repo/helpers/cbor.js";
import type {
  DrawingCheckpoint,
  DrawingCheckpointResult,
} from "@smalldraw/shared";
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

import { createThumbnailUploadQueue } from "./createThumbnailUploadQueue";

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
  getCurrentAccount(): Promise<{ id: string; username: string } | null>;
  signOut(): Promise<void>;
  checkpointAccountDrawing(
    documentId: string,
    checkpoint: DrawingCheckpoint,
    accountId: string,
  ): Promise<DrawingCheckpointResult>;
  acceptDocumentInvitation(token: string): Promise<void>;
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
    accountId: string,
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
  publishShareThumbnail(accessToken: string, thumbnail: Blob): Promise<void>;
  uploadDocumentThumbnail(documentId: string, thumbnail: Blob): Promise<void>;
}

class DrawingUploadTooLargeError extends Error {
  constructor() {
    super(
      "This drawing is too large to upload. Your drawing is still saved on this device.",
    );
  }
}

export function createMultiplayerApiClient(options: {
  apiUrl: string;
}): MultiplayerApiClient {
  const client = createTRPCUntypedClient({
    links: [
      httpBatchLink({
        url: options.apiUrl,
        async fetch(url, init) {
          const response = await fetch(url, {
            ...init,
            credentials: "include",
            signal: init?.signal
              ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)])
              : AbortSignal.timeout(15000),
          });
          if (response.status === 413) throw new DrawingUploadTooLargeError();
          return response;
        },
      }),
    ],
  });

  async function transfer(operation: string, input: unknown): Promise<unknown> {
    const response = await fetch(
      `${options.apiUrl.replace(/\/$/, "")}/documents/${operation}`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/cbor" },
        body: cbor.encode(input) as Uint8Array<ArrayBuffer>,
        signal: AbortSignal.timeout(15000),
      },
    );
    if (response.status === 413) throw new DrawingUploadTooLargeError();
    if (!response.headers.get("content-type")?.includes("application/cbor"))
      throw new Error(
        `Drawing transfer failed (${response.status}). Please try again.`,
      );
    const envelope = cbor.decode(
      new Uint8Array(await response.arrayBuffer()),
    ) as {
      result?: unknown;
      error?: {
        message: string;
        code: number;
        data: DefaultErrorShape["data"];
      };
    };
    if (envelope.error) throw TRPCClientError.from({ error: envelope.error });
    if (!response.ok || !("result" in envelope))
      throw new Error("Invalid drawing transfer response");
    return envelope.result;
  }

  const uploadDocumentThumbnail = createThumbnailUploadQueue(
    async (documentId, thumbnail) => {
      await client.mutation("uploadDocumentThumbnail", {
        documentId,
        contentType: thumbnail.type,
        content: uint8ArrayToBase64(
          new Uint8Array(await thumbnail.arrayBuffer()),
        ),
      });
    },
  );
  const publishShareThumbnail = createThumbnailUploadQueue(
    async (accessToken, thumbnail) => {
      await client.mutation("publishShareThumbnail", {
        accessToken,
        contentType: thumbnail.type,
        content: uint8ArrayToBase64(
          new Uint8Array(await thumbnail.arrayBuffer()),
        ),
      });
    },
  );
  return {
    async getCurrentAccount() {
      let result: unknown;
      try {
        result = await client.query("me");
      } catch (error) {
        if (isMultiplayerApiAuthError(error)) return null;
        throw normalizeMultiplayerApiError(
          error,
          "Could not check your sign-in status.",
        );
      }
      if (result === null) return null;
      if (
        !result ||
        typeof result !== "object" ||
        typeof (result as { id?: unknown }).id !== "string" ||
        typeof (result as { username?: unknown }).username !== "string"
      )
        throw new Error("Invalid account response");
      return result as { id: string; username: string };
    },
    async checkpointAccountDrawing(documentId, checkpoint, accountId) {
      try {
        return (await transfer("checkpointAccountDrawing", {
          accountId,
          documentId,
          ...checkpoint,
        })) as DrawingCheckpointResult;
      } catch (error) {
        throw normalizeMultiplayerApiError(error, "Failed to save drawing.");
      }
    },
    async acceptDocumentInvitation(token) {
      try {
        await client.mutation("acceptDocumentInvitation", { token });
      } catch (error) {
        throw normalizeMultiplayerApiError(
          error,
          "This drawing is unavailable.",
        );
      }
    },
    async signOut() {
      try {
        await client.mutation("logout");
      } catch (error) {
        if (!isMultiplayerApiAuthError(error))
          throw normalizeMultiplayerApiError(
            error,
            "Could not sign out. Please try again.",
          );
      }
    },
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
      let result: unknown;
      try {
        result = await transfer("registerCollaborativeDocument", {
          documentId,
          content,
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
    async registerAccountSyncedDocument(documentId, content, accountId) {
      let result: unknown;
      try {
        result = await transfer("registerAccountSyncedDocument", {
          accountId,
          documentId,
          content,
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
        result = await transfer("resolveAnonymousCollaborativeDocument", {
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
        result = await transfer("resolveAccountCollaborativeDocument", {
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
    publishShareThumbnail,
    uploadDocumentThumbnail,
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
    if (error.cause instanceof DrawingUploadTooLargeError) return error.cause;
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
    typeof (input as { hasPin?: unknown }).hasPin !== "boolean"
  ) {
    return null;
  }
  return {
    shareMode: (input as { shareMode: AccountSettings["shareMode"] }).shareMode,
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
    !((input as { content?: unknown }).content instanceof Uint8Array)
  ) {
    return null;
  }
  return {
    collabDocUrl: (input as { collabDocUrl: string }).collabDocUrl,
    joinSecret: (input as { joinSecret: string }).joinSecret,
    accessToken: (input as { accessToken: string }).accessToken,
    accessTokenScope: (input as { accessTokenScope: "device" })
      .accessTokenScope,
    content: (input as { content: Uint8Array }).content,
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
    !((input as { content?: unknown }).content instanceof Uint8Array)
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
    content: (input as { content: Uint8Array }).content,
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

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
