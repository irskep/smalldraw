import type { DocumentId } from "@automerge/automerge-repo";
import { TRPCError } from "@trpc/server";

import { documentLifetime } from "../automergeRepo/automergeRepo.js";
import { buildDocumentThumbnailStorageKey } from "../db/thumbnailStorage.js";
import { upsertDocumentThumbnail } from "../db/upsertDocumentThumbnail.js";
import { getDocumentThumbnailStore } from "./documentThumbnailStore.js";

// Takedown can capture a target before the first network PUT completes.
export const pendingThumbnailKeys = new Map<
  string,
  { key: string; count: number }
>();

export async function publishDocumentThumbnail(
  documentId: string,
  contentType: string,
  content: string,
): Promise<void> {
  const binary = Buffer.from(content, "base64");
  const png =
    binary.length >= 24 &&
    binary
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    binary.toString("ascii", 12, 16) === "IHDR";
  const webp =
    binary.length >= 20 &&
    binary.toString("ascii", 0, 4) === "RIFF" &&
    binary.toString("ascii", 8, 12) === "WEBP";
  if (!(contentType === "image/png" ? png : webp))
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Preview must be a PNG or WebP thumbnail",
    });
  await documentLifetime.use(documentId as DocumentId, async () => {
    const key = buildDocumentThumbnailStorageKey(documentId);
    pendingThumbnailKeys.set(documentId, {
      key,
      count: (pendingThumbnailKeys.get(documentId)?.count ?? 0) + 1,
    });
    try {
      await getDocumentThumbnailStore().putObject({
        key,
        body: binary,
        contentType,
      });
      await upsertDocumentThumbnail({
        documentId,
        storageKey: key,
        contentType,
      });
    } finally {
      const remaining = (pendingThumbnailKeys.get(documentId)?.count ?? 1) - 1;
      if (remaining)
        pendingThumbnailKeys.set(documentId, { key, count: remaining });
      else pendingThumbnailKeys.delete(documentId);
    }
  });
}
