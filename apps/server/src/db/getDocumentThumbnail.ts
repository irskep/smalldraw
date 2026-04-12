import { eq } from "drizzle-orm";
import { db } from "./client.js";
import { documentThumbnails } from "./schema.js";

export async function getDocumentThumbnail(documentId: string) {
  return await db.query.documentThumbnails.findFirst({
    where: eq(documentThumbnails.documentId, documentId),
  });
}
