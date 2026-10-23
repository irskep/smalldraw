import { eq } from "drizzle-orm";

import { db } from "./client.js";
import { assertDocumentAvailable } from "./documentModeration.js";
import { documentThumbnails } from "./schema.js";

export async function upsertDocumentThumbnail(input: {
  documentId: string;
  storageKey: string;
  contentType: string;
}) {
  const existing = await db.query.documentThumbnails.findFirst({
    where: eq(documentThumbnails.documentId, input.documentId),
  });

  assertDocumentAvailable(input.documentId);
  if (existing) {
    db.update(documentThumbnails)
      .set({
        storageKey: input.storageKey,
        legacyStorageKey:
          existing.legacyStorageKey ??
          (existing.storageKey.endsWith("/thumbnail.png")
            ? existing.storageKey
            : null),
        contentType: input.contentType,
        updatedAt: new Date(),
      })
      .where(eq(documentThumbnails.documentId, input.documentId))
      .run();
  } else {
    db.insert(documentThumbnails)
      .values({
        documentId: input.documentId,
        storageKey: input.storageKey,
        contentType: input.contentType,
      })
      .run();
  }

  return await db.query.documentThumbnails.findFirst({
    where: eq(documentThumbnails.documentId, input.documentId),
  });
}
