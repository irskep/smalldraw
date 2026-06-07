import type { DocumentId } from "@automerge/automerge-repo";
import * as opaque from "@serenity-kit/opaque";
import type {
  AcceptedDocumentInvitation,
  AccountCollaborativeDocumentResolution,
  AccountCollaborativeDocumentSummary,
  AccountDocumentDetails,
  AccountDocumentMutationResult,
  AccountDocumentSummary,
  AdminUserDocumentDetails,
  AdminUserDocumentSummary,
  AdminUserSession,
  AdminUserSessionMutationResult,
  AnonymousCollaborativeDocumentResolution,
  ClaimCollaborativeDocumentResult,
  CreatedAccountDocument,
  DeletedAccountDocument,
  DeletedAccountDocumentSummary,
  DocumentAccessToken,
  DocumentInvitationToken,
  DocumentMember,
  DocumentThumbnailUploadTarget,
  RegisteredCollaborativeDocument,
  RemovedAccountDocument,
  RestoredAccountDocument,
  RevokeDocumentAccessTokenResult,
} from "@smalldraw/shared";
import { isDocumentAccessTokenScope } from "@smalldraw/shared";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  appendSetCookieHeader,
  buildClearedSessionCookie,
  buildSessionCookie,
} from "../auth/sessionCookie.js";
import { repo, repoStorage } from "../automergeRepo/automergeRepo.js";
import { toAutomergeUrl } from "../automergeRepo/automergeUrl.js";
import { addUserToDocument } from "../db/addUserToDocument.js";
import { claimAnonymousCollaborativeDocument } from "../db/claimAnonymousCollaborativeDocument.js";
import { createAnonymousCollaborativeDocument } from "../db/createAnonymousCollaborativeDocument.js";
import { createDocument } from "../db/createDocument.js";
import { createLoginAttempt } from "../db/createLoginAttempt.js";
import { createOrRefreshDocumentInvitation } from "../db/createOrRefreshDocumentInvitation.js";
import { createSession } from "../db/createSession.js";
import { createUser } from "../db/createUser.js";
import { deleteDocument } from "../db/deleteDocument.js";
import { deleteLoginAttempt } from "../db/deleteLoginAttempt.js";
import { deleteSession } from "../db/deleteSession.js";
import { deleteSessionForUser } from "../db/deleteSessionForUser.js";
import { deleteSessionsForUser } from "../db/deleteSessionsForUser.js";
import { findOrCreateDocumentToken } from "../db/documentTokens.js";
import { getDeletedDocumentsByUserId } from "../db/getDeletedDocumentsByUserId.js";
import { getDocument } from "../db/getDocument.js";
import { getDocumentInvitation } from "../db/getDocumentInvitation.js";
import { getDocumentInvitationByToken } from "../db/getDocumentInvitationByToken.js";
import { getDocumentMembers } from "../db/getDocumentMembers.js";
import { getDocumentsByUserId } from "../db/getDocumentsByUserId.js";
import { getLoginAttempt } from "../db/getLoginAttempt.js";
import { getUser } from "../db/getUser.js";
import { getUserByUsername } from "../db/getUserByUsername.js";
import { getUserHasAccessToDocument } from "../db/getUserHasAccessToDocument.js";
import { listDocumentAccessTokensForAdmin } from "../db/listDocumentAccessTokensForAdmin.js";
import { listDocumentAccessTokensForServerAdmin } from "../db/listDocumentAccessTokensForServerAdmin.js";
import { listDocumentMembersForServerAdmin } from "../db/listDocumentMembersForServerAdmin.js";
import { listSessionsForUser } from "../db/listSessionsForUser.js";
import { removeDocumentFromAccount } from "../db/removeDocumentFromAccount.js";
import { restoreDocument } from "../db/restoreDocument.js";
import { revokeDocumentAccessTokenForAdmin } from "../db/revokeDocumentAccessTokenForAdmin.js";
import { rotateAnonymousCollaborativeDocumentShareToken } from "../db/rotateAnonymousCollaborativeDocumentShareToken.js";
import {
  buildDocumentThumbnailStorageKey,
  buildDocumentThumbnailUrl,
} from "../db/thumbnailStorage.js";
import { updateDocument } from "../db/updateDocument.js";
import { updateUserRegistrationRecord } from "../db/updateUserRegistrationRecord.js";
import { upsertDocumentThumbnail } from "../db/upsertDocumentThumbnail.js";
import {
  LoginFinishParams,
  LoginStartParams,
  RegisterFinishParams,
  RegisterStartParams,
} from "../schema.js";
import { getDocumentThumbnailStore } from "../storage/documentThumbnailStore.js";
import { createOpaqueRegistrationRecord } from "../utils/createOpaqueRegistrationRecord.js";
import { getOpaqueServerSetup } from "../utils/getOpaqueServerSetup.js";
import {
  appTrpcError,
  protectedProcedure,
  publicProcedure,
  router,
  serverAdminProcedure,
} from "./trpc.js";

const resolveThumbnailUrl = (
  storageKey: string | null | undefined,
): string | null =>
  storageKey
    ? buildDocumentThumbnailUrl(storageKey, process.env.R2_PUBLIC_BASE_URL)
    : null;

const listAccountDocumentSummaries = async (
  userId: string,
): Promise<AccountDocumentSummary[]> => {
  const documents = await getDocumentsByUserId(userId);
  return documents.map((doc) => ({
    id: doc.id,
    name: doc.name,
    isAdmin: doc.isAdmin,
    thumbnailUrl: resolveThumbnailUrl(doc.thumbnailStorageKey),
  })) satisfies AccountDocumentSummary[];
};

const listAdminUserDocumentSummaries = async ({
  currentAdminUserId,
  targetUserId,
}: {
  currentAdminUserId: string;
  targetUserId: string;
}): Promise<AdminUserDocumentSummary[]> => {
  const documents = await listAccountDocumentSummaries(targetUserId);
  return await Promise.all(
    documents.map(async (doc) => ({
      ...doc,
      currentAdminHasAccess: await getUserHasAccessToDocument({
        userId: currentAdminUserId,
        documentId: doc.id,
      }),
    })),
  );
};

const getAdminUserDocumentSummary = async ({
  currentAdminUserId,
  documentId,
  targetUserId,
}: {
  currentAdminUserId: string;
  documentId: string;
  targetUserId: string;
}): Promise<AdminUserDocumentSummary | null> => {
  const documents = await listAdminUserDocumentSummaries({
    currentAdminUserId,
    targetUserId,
  });
  return documents.find((doc) => doc.id === documentId) ?? null;
};

const listDocumentAccessTokensForAdminSupport = async (
  documentId: string,
): Promise<DocumentAccessToken[]> => {
  const tokens = await listDocumentAccessTokensForServerAdmin({
    documentId,
  });
  return tokens.map((token) => {
    if (!isDocumentAccessTokenScope(token.scope)) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Invalid document access token scope",
      });
    }
    return {
      ...token,
      scope: token.scope,
    } satisfies DocumentAccessToken;
  });
};

const getPublicSessionId = async (sessionKey: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(sessionKey),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
};

const findSessionKeyByPublicId = async ({
  publicSessionId,
  userId,
}: {
  publicSessionId: string;
  userId: string;
}): Promise<string | null> => {
  const sessions = await listSessionsForUser(userId);
  for (const session of sessions) {
    if ((await getPublicSessionId(session.sessionKey)) === publicSessionId) {
      return session.sessionKey;
    }
  }
  return null;
};

const listDeletedAccountDocumentSummaries = async (
  userId: string,
): Promise<DeletedAccountDocumentSummary[]> => {
  const documents = await getDeletedDocumentsByUserId(userId);
  return documents
    .filter(
      (doc): doc is typeof doc & { deletedAt: Date } =>
        doc.deletedAt instanceof Date,
    )
    .map((doc) => ({
      id: doc.id,
      name: doc.name,
      isAdmin: doc.isAdmin,
      thumbnailUrl: resolveThumbnailUrl(doc.thumbnailStorageKey),
      deletedAt: doc.deletedAt,
    })) satisfies DeletedAccountDocumentSummary[];
};

const hasInMemoryRepoHandle = (documentId: string): boolean => {
  const handleMap = (repo as unknown as { handles?: Record<string, unknown> })
    .handles;
  return Boolean(handleMap?.[documentId]);
};

const serializeRepoDocument = async (documentId: string): Promise<string> => {
  console.info("[server:documents] serialize start", {
    documentId,
  });
  if (
    !repoStorage.hasDocumentContent(documentId) &&
    !hasInMemoryRepoHandle(documentId)
  ) {
    console.warn("[server:documents] serialize missing repo content", {
      documentId,
    });
    throw appTrpcError(
      {
        code: "DOCUMENT_CONTENT_MISSING",
        title: "Could not open drawing",
        message:
          "This drawing exists in your account, but its drawing content is missing from storage.",
        severity: "recoverable",
        retryable: false,
        details: { documentId },
      },
      "NOT_FOUND",
    );
  }
  console.info("[server:documents] serialize repo.find start", {
    documentId,
  });
  const handle = await repo.find(documentId as DocumentId);
  console.info("[server:documents] serialize repo.find complete", {
    documentId,
  });
  console.info("[server:documents] serialize handle.doc start", {
    documentId,
  });
  const doc = await handle.doc();
  if (!doc) {
    console.warn("[server:documents] serialize empty doc", {
      documentId,
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Document not found in repository",
    });
  }
  console.info("[server:documents] serialize handle.doc complete", {
    documentId,
  });
  const { save } = await import("@automerge/automerge");
  console.info("[server:documents] serialize save start", {
    documentId,
  });
  const content = Buffer.from(save(doc)).toString("base64");
  console.info("[server:documents] serialize save complete", {
    documentId,
    bytes: content.length,
  });
  return content;
};

export const appRouter = router({
  adminMe: serverAdminProcedure.query(async (opts) => {
    return {
      id: opts.ctx.serverAdmin.id,
      username: opts.ctx.serverAdmin.username,
    };
  }),
  adminGetUserByUsername: serverAdminProcedure
    .input(z.string())
    .query(async (opts) => {
      const user = await getUserByUsername(opts.input);
      if (!user) {
        return null;
      }
      return {
        id: user.id,
        username: user.username,
        isServerAdmin: user.isServerAdmin,
        createdAt: user.createdAt,
      };
    }),
  adminResetUserPassword: serverAdminProcedure
    .input(
      z.object({
        username: z.string().min(1),
        newPassword: z.string().min(1),
      }),
    )
    .mutation(async (opts) => {
      const user = await getUserByUsername(opts.input.username);
      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "user not found",
        });
      }

      const registrationRecord = await createOpaqueRegistrationRecord({
        username: user.username,
        password: opts.input.newPassword,
      });
      const updatedUser = await updateUserRegistrationRecord({
        userId: user.id,
        registrationRecord,
      });
      if (!updatedUser) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "user not found after password reset",
        });
      }
      await deleteSessionsForUser(user.id);
      await deleteLoginAttempt(user.id);

      return {
        id: updatedUser.id,
        username: updatedUser.username,
        isServerAdmin: updatedUser.isServerAdmin,
        createdAt: updatedUser.createdAt,
        sessionsRevoked: true,
      };
    }),
  adminListUserDocuments: serverAdminProcedure
    .input(z.object({ username: z.string().min(1) }))
    .query(async (opts) => {
      const user = await getUserByUsername(opts.input.username);
      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "user not found",
        });
      }
      return await listAdminUserDocumentSummaries({
        currentAdminUserId: opts.ctx.serverAdmin.id,
        targetUserId: user.id,
      });
    }),
  adminListUserSessions: serverAdminProcedure
    .input(z.object({ username: z.string().min(1) }))
    .query(async (opts) => {
      const user = await getUserByUsername(opts.input.username);
      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "user not found",
        });
      }
      const sessions = await listSessionsForUser(user.id);
      return await Promise.all(
        sessions.map(async (session) => ({
          id: await getPublicSessionId(session.sessionKey),
          createdAt: session.createdAt,
          isCurrentAdminSession:
            opts.ctx.serverAdminSessionKey === session.sessionKey,
        })),
      ) satisfies AdminUserSession[];
    }),
  adminRevokeUserSession: serverAdminProcedure
    .input(
      z.object({
        username: z.string().min(1),
        sessionId: z.string().min(1),
      }),
    )
    .mutation(async (opts) => {
      const user = await getUserByUsername(opts.input.username);
      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "user not found",
        });
      }
      const sessionKey = await findSessionKeyByPublicId({
        userId: user.id,
        publicSessionId: opts.input.sessionId,
      });
      if (!sessionKey) {
        return {
          revoked: 0,
        } satisfies AdminUserSessionMutationResult;
      }
      const revoked = await deleteSessionForUser({
        userId: user.id,
        sessionKey,
      });
      return {
        revoked: revoked ? 1 : 0,
      } satisfies AdminUserSessionMutationResult;
    }),
  adminRevokeUserSessions: serverAdminProcedure
    .input(z.object({ username: z.string().min(1) }))
    .mutation(async (opts) => {
      const user = await getUserByUsername(opts.input.username);
      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "user not found",
        });
      }
      const sessions = await listSessionsForUser(user.id);
      await deleteSessionsForUser(user.id);
      return {
        revoked: sessions.length,
      } satisfies AdminUserSessionMutationResult;
    }),
  adminGetUserDocumentDetails: serverAdminProcedure
    .input(
      z.object({
        username: z.string().min(1),
        documentId: z.string().min(1),
      }),
    )
    .query(async (opts) => {
      const user = await getUserByUsername(opts.input.username);
      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "user not found",
        });
      }
      const document = await getAdminUserDocumentSummary({
        currentAdminUserId: opts.ctx.serverAdmin.id,
        targetUserId: user.id,
        documentId: opts.input.documentId,
      });
      if (!document) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "document not found for user",
        });
      }
      const [members, accessTokens] = await Promise.all([
        listDocumentMembersForServerAdmin({
          documentId: opts.input.documentId,
        }),
        listDocumentAccessTokensForAdminSupport(opts.input.documentId),
      ]);
      return {
        document,
        members,
        accessTokens,
      } satisfies AdminUserDocumentDetails;
    }),
  adminCreateUserDocumentShareLink: serverAdminProcedure
    .input(
      z.object({
        username: z.string().min(1),
        documentId: z.string().min(1),
      }),
    )
    .mutation(async (opts) => {
      const user = await getUserByUsername(opts.input.username);
      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "user not found",
        });
      }
      const documents = await getDocumentsByUserId(user.id);
      if (
        !documents.some((document) => document.id === opts.input.documentId)
      ) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "document not found for user",
        });
      }
      const currentAdminHasAccess = await getUserHasAccessToDocument({
        userId: opts.ctx.serverAdmin.id,
        documentId: opts.input.documentId,
      });
      if (currentAdminHasAccess) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "admin already has access to document",
        });
      }
      const shareToken = await rotateAnonymousCollaborativeDocumentShareToken(
        opts.input.documentId,
      );
      return { token: shareToken.token } satisfies DocumentInvitationToken;
    }),
  me: protectedProcedure.query(async (opts) => {
    const user = await getUser(opts.ctx.session.userId);
    if (!user) return null;
    return {
      id: user.id,
      username: user.username,
      isServerAdmin: user.isServerAdmin,
    };
  }),
  documents: protectedProcedure.query(async (opts) => {
    return await listAccountDocumentSummaries(opts.ctx.session.userId);
  }),
  deletedDocuments: protectedProcedure.query(async (opts) => {
    return await listDeletedAccountDocumentSummaries(opts.ctx.session.userId);
  }),
  listAccountCollaborativeDocuments: protectedProcedure.query(async (opts) => {
    const documents = await listAccountDocumentSummaries(
      opts.ctx.session.userId,
    );
    return documents.map((doc) => ({
      documentId: doc.id,
      name: doc.name,
      isAdmin: doc.isAdmin,
      thumbnailUrl: doc.thumbnailUrl,
    })) satisfies AccountCollaborativeDocumentSummary[];
  }),
  getDocument: protectedProcedure.input(z.string()).query(async (opts) => {
    const document = await getDocument({
      documentId: opts.input,
      userId: opts.ctx.session.userId,
    });
    if (!document) return null;
    return {
      id: document.id,
      name: document.name,
      isAdmin: document.isAdmin,
      thumbnailUrl: resolveThumbnailUrl(document.thumbnailStorageKey),
    } satisfies AccountDocumentDetails;
  }),
  uploadDocumentThumbnail: protectedProcedure
    .input(
      z.object({
        documentId: z.string().min(1),
        contentType: z.string().min(1),
      }),
    )
    .mutation(async (opts) => {
      const document = await getDocument({
        documentId: opts.input.documentId,
        userId: opts.ctx.session.userId,
      });
      if (!document) {
        throw appTrpcError(
          {
            code: "DOCUMENT_NOT_FOUND",
            title: "Could not open drawing",
            message: "This drawing is no longer available.",
            severity: "recoverable",
            retryable: false,
            details: { documentId: opts.input.documentId },
          },
          "NOT_FOUND",
        );
      }
      if (!document.isAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only document admins can upload thumbnails",
        });
      }

      const storageKey = buildDocumentThumbnailStorageKey(
        opts.input.documentId,
      );
      const uploadUrl = getDocumentThumbnailStore().presignPutUrl({
        key: storageKey,
        contentType: opts.input.contentType,
      });
      await upsertDocumentThumbnail({
        documentId: opts.input.documentId,
        storageKey,
        contentType: opts.input.contentType,
      });

      return {
        uploadUrl,
      } satisfies DocumentThumbnailUploadTarget;
    }),
  updateDocument: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string(),
      }),
    )
    .mutation(async (opts) => {
      const updatedDocument = await updateDocument({
        documentId: opts.input.id,
        userId: opts.ctx.session.userId,
        name: opts.input.name,
      });
      return {
        id: updatedDocument.id,
        name: updatedDocument.name,
      } satisfies AccountDocumentMutationResult;
    }),
  createDocument: protectedProcedure
    .input(
      z.object({
        name: z.string(),
      }),
    )
    .mutation(async (opts) => {
      const { documentId } = repo.create();
      const document = await createDocument({
        userId: opts.ctx.session.userId,
        documentId,
        name: opts.input.name,
      });
      return {
        document: { id: document.id, name: document.name },
      } satisfies CreatedAccountDocument;
    }),
  deleteDocument: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
      }),
    )
    .mutation(async (opts) => {
      try {
        const deleted = await deleteDocument({
          documentId: opts.input.id,
          userId: opts.ctx.session.userId,
        });
        return {
          id: deleted.id,
          deletedAt: deleted.deletedAt,
        } satisfies DeletedAccountDocument;
      } catch (error) {
        if (error instanceof Error && error.message === "Document not found") {
          throw appTrpcError(
            {
              code: "DOCUMENT_NOT_FOUND",
              title: "Could not delete drawing",
              message: "This drawing is no longer available.",
              severity: "recoverable",
              retryable: false,
              details: { documentId: opts.input.id },
            },
            "NOT_FOUND",
          );
        }
        if (
          error instanceof Error &&
          error.message === "User lacks delete permission"
        ) {
          throw appTrpcError(
            {
              code: "DOCUMENT_ACCESS_DENIED",
              title: "Could not delete drawing",
              message: "Only a drawing owner can delete this shared drawing.",
              severity: "recoverable",
              retryable: false,
              details: { documentId: opts.input.id },
            },
            "FORBIDDEN",
          );
        }
        throw error;
      }
    }),
  removeDocumentFromAccount: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
      }),
    )
    .mutation(async (opts) => {
      try {
        return (await removeDocumentFromAccount({
          documentId: opts.input.id,
          userId: opts.ctx.session.userId,
        })) satisfies RemovedAccountDocument;
      } catch (error) {
        if (error instanceof Error && error.message === "Document not found") {
          throw appTrpcError(
            {
              code: "DOCUMENT_NOT_FOUND",
              title: "Could not remove drawing",
              message: "This drawing is no longer available.",
              severity: "recoverable",
              retryable: false,
              details: { documentId: opts.input.id },
            },
            "NOT_FOUND",
          );
        }
        throw error;
      }
    }),
  restoreDocument: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
      }),
    )
    .mutation(async (opts) => {
      try {
        return (await restoreDocument({
          documentId: opts.input.id,
          userId: opts.ctx.session.userId,
        })) satisfies RestoredAccountDocument;
      } catch (error) {
        if (error instanceof Error && error.message === "Document not found") {
          throw appTrpcError(
            {
              code: "DOCUMENT_NOT_FOUND",
              title: "Could not restore drawing",
              message: "This deleted drawing is no longer available.",
              severity: "recoverable",
              retryable: false,
              details: { documentId: opts.input.id },
            },
            "NOT_FOUND",
          );
        }
        if (
          error instanceof Error &&
          error.message === "User lacks restore permission"
        ) {
          throw appTrpcError(
            {
              code: "DOCUMENT_ACCESS_DENIED",
              title: "Could not restore drawing",
              message: "Only a drawing owner can restore this shared drawing.",
              severity: "recoverable",
              retryable: false,
              details: { documentId: opts.input.id },
            },
            "FORBIDDEN",
          );
        }
        throw error;
      }
    }),

  resolveAccountCollaborativeDocument: protectedProcedure
    .input(
      z.object({
        documentId: z.string().min(1),
        deviceTag: z.string().min(1).max(128),
      }),
    )
    .query(async (opts) => {
      console.info("[server:documents] account resolve request", {
        documentId: opts.input.documentId,
        userId: opts.ctx.session.userId,
        deviceTag: opts.input.deviceTag,
      });
      const document = await getDocument({
        documentId: opts.input.documentId,
        userId: opts.ctx.session.userId,
      });
      if (!document) {
        console.warn("[server:documents] account resolve missing document", {
          documentId: opts.input.documentId,
          userId: opts.ctx.session.userId,
        });
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      }

      try {
        const content = await serializeRepoDocument(opts.input.documentId);
        const accessTokenScope = document.isAdmin ? "owner" : "device";
        const accessToken = await findOrCreateDocumentToken({
          documentId: opts.input.documentId,
          scope: accessTokenScope,
          tag: `account:${opts.ctx.session.userId}:device:${opts.input.deviceTag}`,
        });
        return {
          collabDocUrl: toAutomergeUrl(opts.input.documentId),
          accessToken: accessToken.token,
          accessTokenScope,
          content,
        } satisfies AccountCollaborativeDocumentResolution;
      } catch (err) {
        console.warn("[server:documents] account resolve failed", {
          documentId: opts.input.documentId,
          userId: opts.ctx.session.userId,
          error: err,
        });
        if (err instanceof TRPCError) {
          throw err;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to serialize document",
          cause: err,
        });
      }
    }),

  registerCollaborativeDocument: publicProcedure
    .input(
      z.object({
        documentId: z.string().min(1),
        content: z.string().min(1),
        deviceTag: z.string().min(1).max(128),
      }),
    )
    .mutation(async (opts) => {
      const rawDocId = opts.input.documentId.replace(
        /^automerge:/,
        "",
      ) as DocumentId;
      const binary = new Uint8Array(Buffer.from(opts.input.content, "base64"));
      repo.import(binary, { docId: rawDocId });
      const result = await createAnonymousCollaborativeDocument({
        documentId: rawDocId,
        ownerTag: opts.input.deviceTag,
      });
      if (opts.ctx.session) {
        await claimAnonymousCollaborativeDocument({
          userId: opts.ctx.session.userId,
          accessToken: result.accessToken,
        });
      }
      return {
        collabDocUrl: toAutomergeUrl(result.document.id),
        joinSecret: result.joinSecret,
        accessToken: result.accessToken,
        accessTokenScope: "owner",
      } satisfies RegisteredCollaborativeDocument;
    }),

  resolveAnonymousCollaborativeDocument: publicProcedure
    .input(
      z.object({
        joinSecret: z.string().min(1),
        deviceTag: z.string().min(1).max(128),
      }),
    )
    .query(async (opts) => {
      const invitation = await getDocumentInvitationByToken(
        opts.input.joinSecret,
        { scopes: ["share"] },
      );
      if (!invitation) {
        return null;
      }
      try {
        const content = await serializeRepoDocument(invitation.documentId);
        return {
          collabDocUrl: toAutomergeUrl(invitation.documentId),
          joinSecret: invitation.token,
          accessToken: (
            await findOrCreateDocumentToken({
              documentId: invitation.documentId,
              scope: "device",
              tag: opts.input.deviceTag,
            })
          ).token,
          accessTokenScope: "device",
          content,
        } satisfies AnonymousCollaborativeDocumentResolution;
      } catch (err) {
        if (err instanceof TRPCError) {
          throw err;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to serialize document",
          cause: err,
        });
      }
    }),
  rotateAnonymousCollaborativeShareLink: publicProcedure
    .input(
      z.object({
        accessToken: z.string().min(1),
      }),
    )
    .mutation(async (opts) => {
      const ownerToken = await getDocumentInvitationByToken(
        opts.input.accessToken,
        {
          scopes: ["owner"],
        },
      );
      if (!ownerToken) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Only the drawing owner can rotate the share link.",
        });
      }
      const shareToken = await rotateAnonymousCollaborativeDocumentShareToken(
        ownerToken.documentId,
      );
      return { joinSecret: shareToken.token };
    }),

  createOrRefreshDocumentInvitation: protectedProcedure
    .input(
      z.object({
        documentId: z.string(),
      }),
    )
    .mutation(async (opts) => {
      const documentInvitation = await createOrRefreshDocumentInvitation({
        userId: opts.ctx.session.userId,
        documentId: opts.input.documentId,
      });
      return documentInvitation
        ? ({
            token: documentInvitation.token,
          } satisfies DocumentInvitationToken)
        : null;
    }),

  documentInvitation: protectedProcedure
    .input(z.string())
    .query(async (opts) => {
      const documentInvitation = await getDocumentInvitation({
        documentId: opts.input,
        userId: opts.ctx.session.userId,
      });
      if (!documentInvitation) return null;
      return {
        token: documentInvitation.token,
      } satisfies DocumentInvitationToken;
    }),
  documentAccessTokens: protectedProcedure
    .input(z.string())
    .query(async (opts) => {
      const tokens = await listDocumentAccessTokensForAdmin({
        userId: opts.ctx.session.userId,
        documentId: opts.input,
      });
      return tokens.map((token) => {
        if (!isDocumentAccessTokenScope(token.scope)) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Invalid document access token scope",
          });
        }
        return {
          ...token,
          scope: token.scope,
        } satisfies DocumentAccessToken;
      });
    }),

  revokeDocumentAccessToken: protectedProcedure
    .input(
      z.object({
        documentId: z.string(),
        tokenId: z.string(),
      }),
    )
    .mutation(async (opts) => {
      const revoked = await revokeDocumentAccessTokenForAdmin({
        userId: opts.ctx.session.userId,
        documentId: opts.input.documentId,
        tokenId: opts.input.tokenId,
      });
      return { revoked } satisfies RevokeDocumentAccessTokenResult;
    }),

  acceptDocumentInvitation: protectedProcedure
    .input(
      z.object({
        token: z.string(),
      }),
    )
    .mutation(async (opts) => {
      const result = await addUserToDocument({
        userId: opts.ctx.session.userId,
        documentInvitationToken: opts.input.token,
      });
      return result
        ? ({
            documentId: result.documentId,
          } satisfies AcceptedDocumentInvitation)
        : null;
    }),
  claimCollaborativeDocument: protectedProcedure
    .input(
      z.object({
        accessToken: z.string(),
      }),
    )
    .mutation(async (opts) => {
      try {
        return (await claimAnonymousCollaborativeDocument({
          userId: opts.ctx.session.userId,
          accessToken: opts.input.accessToken,
        })) satisfies ClaimCollaborativeDocumentResult;
      } catch (error) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Only a drawing owner can claim this drawing.",
          cause: error,
        });
      }
    }),

  documentMembers: protectedProcedure.input(z.string()).query(async (opts) => {
    const members = await getDocumentMembers({
      documentId: opts.input,
      userId: opts.ctx.session.userId,
    });
    return members satisfies DocumentMember[] | null;
  }),

  logout: protectedProcedure.mutation(async (opts) => {
    await deleteSession(opts.ctx.session.sessionKey);
    appendSetCookieHeader(opts.ctx.res, buildClearedSessionCookie());
  }),

  registerStart: publicProcedure
    .input(RegisterStartParams)
    .mutation(async (opts) => {
      const { userIdentifier, registrationRequest } = opts.input;

      const user = await getUserByUsername(userIdentifier);
      if (user) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "user already registered",
        });
      }

      const { registrationResponse } = opaque.server.createRegistrationResponse(
        {
          serverSetup: getOpaqueServerSetup(),
          userIdentifier,
          registrationRequest,
        },
      );

      return { registrationResponse };
    }),

  registerFinish: publicProcedure
    .input(RegisterFinishParams)
    .mutation(async (opts) => {
      const { userIdentifier, registrationRecord } = opts.input;

      const existingUser = await getUserByUsername(userIdentifier);
      if (!existingUser) {
        await createUser({ username: userIdentifier, registrationRecord });
      }

      // return always the same result even if the user already exists to
      // avoid leaking the information if the user exists or not
      return;
    }),

  loginStart: publicProcedure.input(LoginStartParams).mutation(async (opts) => {
    const { userIdentifier, startLoginRequest } = opts.input;

    const user = await getUserByUsername(userIdentifier);
    if (!user)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "user not registered",
      });
    const { registrationRecord, id: userId } = user;

    const loginAttempt = await getLoginAttempt(userIdentifier);
    if (loginAttempt) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "login already started",
      });
    }

    const { serverLoginState, loginResponse } = opaque.server.startLogin({
      serverSetup: getOpaqueServerSetup(),
      userIdentifier,
      registrationRecord,
      startLoginRequest,
    });

    await createLoginAttempt({ userId, serverLoginState });

    return { loginResponse };
  }),
  loginFinish: publicProcedure
    .input(LoginFinishParams)
    .mutation(async (opts) => {
      const { userIdentifier, finishLoginRequest } = opts.input;

      const loginAttempt = await getLoginAttempt(userIdentifier);
      if (!loginAttempt || !loginAttempt.serverLoginState)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "login not started",
        });
      const { serverLoginState } = loginAttempt;
      const { sessionKey } = opaque.server.finishLogin({
        finishLoginRequest,
        serverLoginState,
      });

      const user = await getUserByUsername(userIdentifier);
      if (!user) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "user not found",
        });
      }
      await createSession({ sessionKey, userId: user.id });
      await deleteLoginAttempt(user.id);
      appendSetCookieHeader(opts.ctx.res, buildSessionCookie(sessionKey));

      return { success: true };
    }),
});

export type AppRouter = typeof appRouter;
