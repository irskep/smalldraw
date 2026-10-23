import { AppErrorException, createAppError } from "@smalldraw/shared";
import { eq } from "drizzle-orm";

import { db } from "./client.js";
import {
  documentModeration,
  documents,
  documentInvitations,
} from "./schema.js";

/** Synchronous checks also guard storage commits after asynchronous work. */
export function isDocumentBlocked(documentId: string): boolean {
  return Boolean(
    db
      .select({ id: documentModeration.documentId })
      .from(documentModeration)
      .where(eq(documentModeration.documentId, documentId))
      .get(),
  );
}

export function assertDocumentAvailable(documentId: string): void {
  if (isDocumentBlocked(documentId))
    throw new AppErrorException(
      createAppError({
        code: "DOCUMENT_NOT_FOUND",
        title: "Drawing unavailable",
        message: "This drawing is unavailable.",
        severity: "recoverable",
        retryable: false,
      }),
    );
}

export function recordDocumentContentChange(documentId: string): void {
  if (isDocumentBlocked(documentId)) return;
  db.update(documents)
    .set({ contentUpdatedAt: new Date() })
    .where(eq(documents.id, documentId))
    .run();
}

/** Revoked device/owner tokens can learn only that their document is unavailable. */
export function blockedDocumentForToken(token: string): string | null {
  const invitation = db
    .select({
      documentId: documentInvitations.documentId,
      scope: documentInvitations.scope,
    })
    .from(documentInvitations)
    .where(eq(documentInvitations.token, token))
    .get();
  return invitation &&
    (invitation.scope === "owner" || invitation.scope === "device") &&
    isDocumentBlocked(invitation.documentId)
    ? invitation.documentId
    : null;
}
