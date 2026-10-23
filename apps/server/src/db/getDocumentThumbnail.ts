import { eq } from "drizzle-orm";

import { db } from "./client.js";
import { isDocumentBlocked } from "./documentModeration.js";
import { documentThumbnails } from "./schema.js";

export async function getDocumentThumbnail(documentId: string) {
  if (isDocumentBlocked(documentId)) return undefined;
  return await db.query.documentThumbnails.findFirst({
    where: eq(documentThumbnails.documentId, documentId),
  });
}
