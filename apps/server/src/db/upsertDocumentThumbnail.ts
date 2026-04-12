import { eq } from "drizzle-orm";
import { db } from "./client.js";
import { documentThumbnails } from "./schema.js";

export async function upsertDocumentThumbnail(input: {
  documentId: string;
  storageKey: string;
  contentType: string;
}) {
  const existing = await db.query.documentThumbnails.findFirst({
    where: eq(documentThumbnails.documentId, input.documentId),
  });

  if (existing) {
    await db
      .update(documentThumbnails)
      .set({
        storageKey: input.storageKey,
        contentType: input.contentType,
      })
      .where(eq(documentThumbnails.documentId, input.documentId));
  } else {
    await db.insert(documentThumbnails).values({
      documentId: input.documentId,
      storageKey: input.storageKey,
      contentType: input.contentType,
    });
  }

  return await db.query.documentThumbnails.findFirst({
    where: eq(documentThumbnails.documentId, input.documentId),
  });
}
