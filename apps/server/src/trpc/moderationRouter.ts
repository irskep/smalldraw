import type { DocumentId } from "@automerge/automerge-repo";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { documentLifetime, repo } from "../automergeRepo/automergeRepo.js";
import { snapshotCache } from "../automergeRepo/snapshotCache.js";
import { assertDocumentAvailable } from "../db/documentModeration.js";
import { getDocumentThumbnail } from "../db/getDocumentThumbnail.js";
import {
  findModerationDrawing,
  getModerationDrawing,
  listModerationDrawings,
} from "../db/moderationQueries.js";
import {
  retryDocumentCleanup,
  takeDownDocument,
} from "../moderation/documentModeration.js";
import { getDocumentThumbnailStore } from "../storage/documentThumbnailStore.js";
import { serverAdminProcedure } from "./trpc.js";

const documentInput = z.object({
  documentId: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/),
});
async function requireDrawing(documentId: string) {
  const drawing = await getModerationDrawing(documentId);
  if (!drawing)
    throw new TRPCError({ code: "NOT_FOUND", message: "Drawing not found" });
  return drawing;
}

export const moderationProcedures = {
  adminDrawingFeed: serverAdminProcedure
    .input(
      z.object({
        filter: z.enum(["all", "shared", "taken-down"]).default("all"),
        cursor: z
          .object({
            at: z.number().int().nonnegative().max(8640000000000000),
            id: z.string().min(1).max(128),
          })
          .optional(),
        limit: z.number().int().min(1).max(60).default(24),
      }),
    )
    .query(({ input, ctx }) => {
      ctx.res.setHeader?.("Cache-Control", "private, no-store");
      return listModerationDrawings(input);
    }),
  adminFindDrawing: serverAdminProcedure
    .input(z.object({ lookup: z.string().trim().min(1).max(2048) }))
    .query(async ({ input, ctx }) => {
      ctx.res.setHeader?.("Cache-Control", "private, no-store");
      try {
        return await findModerationDrawing(input.lookup);
      } catch (error) {
        if (error instanceof TypeError || error instanceof URIError)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Enter a drawing link or ID.",
          });
        throw error;
      }
    }),
  adminDrawingDetails: serverAdminProcedure
    .input(documentInput)
    .query(({ input, ctx }) => {
      ctx.res.setHeader?.("Cache-Control", "private, no-store");
      return requireDrawing(input.documentId);
    }),
  adminDrawingThumbnail: serverAdminProcedure
    .input(documentInput)
    .query(async ({ input, ctx }) => {
      ctx.res.setHeader?.("Cache-Control", "private, no-store");
      assertDocumentAvailable(input.documentId);
      await requireDrawing(input.documentId);
      const thumbnail = await getDocumentThumbnail(input.documentId);
      if (
        !thumbnail ||
        !["image/png", "image/webp", "image/jpeg"].includes(
          thumbnail.contentType,
        )
      )
        return null;
      let object: Uint8Array;
      try {
        object = await getDocumentThumbnailStore().getObject(
          thumbnail.storageKey,
        );
      } catch {
        return null;
      }
      assertDocumentAvailable(input.documentId);
      if (!object || object.byteLength > 2 * 1024 * 1024) return null;
      return {
        contentType: thumbnail.contentType,
        data: Buffer.from(object).toString("base64"),
      };
    }),
  adminDrawingSnapshot: serverAdminProcedure
    .input(documentInput)
    .query(async ({ input, ctx }) => {
      ctx.res.setHeader?.("Cache-Control", "private, no-store");
      assertDocumentAvailable(input.documentId);
      await requireDrawing(input.documentId);
      return documentLifetime.use(input.documentId as DocumentId, async () => {
        assertDocumentAvailable(input.documentId);
        const handle = await repo.find(input.documentId as DocumentId, {
          signal: AbortSignal.timeout(10_000),
        });
        await handle.whenReady(["ready"], {
          signal: AbortSignal.timeout(10_000),
        });
        assertDocumentAvailable(input.documentId);
        return Buffer.from(
          snapshotCache.get(input.documentId, handle.doc()),
        ).toString("base64");
      });
    }),
  adminTakeDownDrawing: serverAdminProcedure
    .input(documentInput.extend({ reason: z.string().trim().min(1).max(1000) }))
    .mutation(async ({ input, ctx }) => {
      await requireDrawing(input.documentId);
      await takeDownDocument({ ...input, administratorId: ctx.serverAdmin.id });
    }),
  adminRetryDrawingCleanup: serverAdminProcedure
    .input(documentInput)
    .mutation(async ({ input }) => {
      const drawing = await requireDrawing(input.documentId);
      if (!drawing.moderation)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Drawing has not been taken down",
        });
      await retryDocumentCleanup(input.documentId);
    }),
};
