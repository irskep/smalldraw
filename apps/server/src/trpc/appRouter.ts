import type { DocumentId } from "@automerge/automerge-repo";
import type {
  AccountCollaborativeDocumentResolution,
  AccountCollaborativeDocumentSummary,
  AnonymousCollaborativeDocumentResolution,
  ClaimCollaborativeDocumentResult,
  DocumentThumbnailUploadTarget,
  RegisteredCollaborativeDocument,
} from "@smalldraw/shared";
import * as opaque from "@serenity-kit/opaque";
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
import { deleteLoginAttempt } from "../db/deleteLoginAttempt.js";
import { deleteSession } from "../db/deleteSession.js";
import { findOrCreateDocumentToken } from "../db/documentTokens.js";
import { getDocument } from "../db/getDocument.js";
import { getDocumentInvitation } from "../db/getDocumentInvitation.js";
import { getDocumentInvitationByToken } from "../db/getDocumentInvitationByToken.js";
import { getDocumentMembers } from "../db/getDocumentMembers.js";
import { getDocumentsByUserId } from "../db/getDocumentsByUserId.js";
import { getLoginAttempt } from "../db/getLoginAttempt.js";
import { getUser } from "../db/getUser.js";
import { getUserByUsername } from "../db/getUserByUsername.js";
import { listDocumentAccessTokensForAdmin } from "../db/listDocumentAccessTokensForAdmin.js";
import { revokeDocumentAccessTokenForAdmin } from "../db/revokeDocumentAccessTokenForAdmin.js";
import { rotateAnonymousCollaborativeDocumentShareToken } from "../db/rotateAnonymousCollaborativeDocumentShareToken.js";
import {
  buildDocumentThumbnailStorageKey,
  buildDocumentThumbnailUrl,
} from "../db/thumbnailStorage.js";
import { updateDocument } from "../db/updateDocument.js";
import { upsertDocumentThumbnail } from "../db/upsertDocumentThumbnail.js";
import {
  LoginFinishParams,
  LoginStartParams,
  RegisterFinishParams,
  RegisterStartParams,
} from "../schema.js";
import { getDocumentThumbnailStore } from "../storage/documentThumbnailStore.js";
import { getOpaqueServerSetup } from "../utils/getOpaqueServerSetup.js";
import {
  protectedProcedure,
  publicProcedure,
  router,
  serverAdminProcedure,
  appTrpcError,
} from "./trpc.js";

const resolveThumbnailUrl = (
  storageKey: string | null | undefined,
): string | null =>
  storageKey
    ? buildDocumentThumbnailUrl(storageKey, process.env.R2_PUBLIC_BASE_URL)
    : null;

const listAccountDocumentSummaries = async (userId: string) => {
  const documents = await getDocumentsByUserId(userId);
  return documents.map((doc) => ({
    id: doc.id,
    name: doc.name,
    thumbnailUrl: resolveThumbnailUrl(doc.thumbnailStorageKey),
  }));
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
  listAccountCollaborativeDocuments: protectedProcedure.query(async (opts) => {
    const documents = await listAccountDocumentSummaries(
      opts.ctx.session.userId,
    );
    return documents.map((doc) => ({
      documentId: doc.id,
      name: doc.name,
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
    };
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
      return { id: updatedDocument.id, name: updatedDocument.name };
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
      return { document: { id: document.id, name: document.name } };
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
      return documentInvitation ? { token: documentInvitation.token } : null;
    }),

  documentInvitation: protectedProcedure
    .input(z.string())
    .query(async (opts) => {
      const documentInvitation = await getDocumentInvitation({
        documentId: opts.input,
        userId: opts.ctx.session.userId,
      });
      if (!documentInvitation) return null;
      return { token: documentInvitation.token };
    }),
  documentAccessTokens: protectedProcedure
    .input(z.string())
    .query(async (opts) => {
      return await listDocumentAccessTokensForAdmin({
        userId: opts.ctx.session.userId,
        documentId: opts.input,
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
      return { revoked };
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
      return result ? { documentId: result.documentId } : null;
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
    return members;
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
