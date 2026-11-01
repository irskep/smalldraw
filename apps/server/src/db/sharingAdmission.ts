import { createHash } from "node:crypto";

import {
  isBlockedShareReferrer,
  SHARE_LINK_LIFETIME_MS,
  SHARE_PARTICIPANT_LIMIT,
  type ShareAvailability,
  type ShareAdmissionProof,
  type ShareSettings,
} from "@smalldraw/shared";
import { and, eq, isNull, sql } from "drizzle-orm";

import { generateId } from "../utils/generateId.js";
import { db } from "./client.js";
import { isDocumentBlocked } from "./documentModeration.js";
import {
  documentInvitations,
  documents,
  sharingAdmissionReceipts,
  sharingParticipants,
  usersOnDocuments,
} from "./schema.js";

type Connection = Pick<typeof db, "select" | "insert" | "update" | "delete">;
export type AdmissionInput = ShareAdmissionProof & {
  joinSecret: string;
  deviceTag: string;
  userId?: string;
  requestReferrer?: string;
};
export class AdmissionError extends Error {
  constructor(readonly availability: ShareAvailability) {
    super(availability);
  }
}
const hashKey = (documentId: string, key: string) =>
  createHash("sha256")
    .update(documentId + ":" + key)
    .digest("hex");

function credential(
  tx: Connection,
  documentId: string,
  input: ShareAdmissionProof,
) {
  const byToken = input.accessToken
    ? tx
        .select()
        .from(documentInvitations)
        .where(
          and(
            eq(documentInvitations.documentId, documentId),
            eq(documentInvitations.token, input.accessToken),
            isNull(documentInvitations.revokedAt),
          ),
        )
        .get()
    : undefined;
  if (byToken && (byToken.scope === "owner" || byToken.scope === "device"))
    return byToken;
  if (!input.admissionKey) return undefined;
  const receipt = tx
    .select()
    .from(sharingAdmissionReceipts)
    .where(
      eq(
        sharingAdmissionReceipts.keyHash,
        hashKey(documentId, input.admissionKey),
      ),
    )
    .get();
  return receipt
    ? tx
        .select()
        .from(documentInvitations)
        .where(
          and(
            eq(documentInvitations.id, receipt.tokenId),
            isNull(documentInvitations.revokedAt),
          ),
        )
        .get()
    : undefined;
}

function inspect(tx: Connection, input: AdmissionInput, now: Date) {
  // Keep lookup separate from validity: admitted recipients may reopen an old URL.
  const invitation = tx
    .select()
    .from(documentInvitations)
    .where(
      and(
        eq(documentInvitations.token, input.joinSecret),
        eq(documentInvitations.scope, "share"),
      ),
    )
    .get();
  const document = invitation
    ? tx
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.id, invitation.documentId),
            isNull(documents.deletedAt),
          ),
        )
        .get()
    : undefined;
  if (!invitation || !document || isDocumentBlocked(document.id))
    throw new AdmissionError("unavailable");
  const access = credential(tx, document.id, input);
  const membership = input.userId
    ? tx
        .select()
        .from(usersOnDocuments)
        .where(
          and(
            eq(usersOnDocuments.documentId, document.id),
            eq(usersOnDocuments.userId, input.userId),
          ),
        )
        .get()
    : undefined;
  const count = tx
    .select({ count: sql<number>`count(*)` })
    .from(sharingParticipants)
    .where(eq(sharingParticipants.documentId, document.id))
    .get()!.count;
  let availability: ShareAvailability = "open";
  if (invitation.revokedAt) availability = "unavailable";
  else if (
    (invitation.expiresAt?.getTime() ??
      invitation.createdAt.getTime() + SHARE_LINK_LIFETIME_MS) <= now.getTime()
  )
    availability = "expired";
  else if (!document.allowNewJoiners) availability = "closed";
  else if (count >= SHARE_PARTICIPANT_LIMIT) availability = "full";
  else if (
    isBlockedShareReferrer(input.navigationReferrer) ||
    isBlockedShareReferrer(input.requestReferrer)
  )
    availability = "blocked_referral";
  return {
    invitation,
    document,
    access,
    membership,
    availability,
    existingParticipant: Boolean(access || membership),
  };
}

export function inspectSharingAdmission(
  input: AdmissionInput,
  now = new Date(),
) {
  const result = inspect(db, input, now);
  return {
    documentId: result.document.id,
    availability: result.availability,
    existingParticipant: result.existingParticipant,
  };
}

function attachParticipant(
  tx: Connection,
  documentId: string,
  participantId: string,
  userId: string,
) {
  const current = tx
    .select()
    .from(sharingParticipants)
    .where(eq(sharingParticipants.id, participantId))
    .get();
  if (current?.userId && current.userId !== userId)
    throw new AdmissionError("unavailable");
  const existing = tx
    .select()
    .from(sharingParticipants)
    .where(
      and(
        eq(sharingParticipants.documentId, documentId),
        eq(sharingParticipants.userId, userId),
      ),
    )
    .get();
  if (existing && existing.id !== participantId) {
    tx.update(documentInvitations)
      .set({ participantId: existing.id })
      .where(eq(documentInvitations.participantId, participantId))
      .run();
    tx.delete(sharingParticipants)
      .where(eq(sharingParticipants.id, participantId))
      .run();
    return existing.id;
  }
  tx.update(sharingParticipants)
    .set({ userId })
    .where(eq(sharingParticipants.id, participantId))
    .run();
  return participantId;
}

export function admitShareParticipant(
  input: AdmissionInput & { confirmed: boolean },
  now = new Date(),
) {
  return db.transaction(
    (tx) => {
      const result = inspect(tx, input, now);
      const { document, access, membership } = result;
      if (!result.existingParticipant) {
        if (!input.confirmed) throw new AdmissionError("unavailable");
        if (result.availability !== "open")
          throw new AdmissionError(result.availability);
        if (!input.admissionKey || !/^[a-f0-9]{64}$/.test(input.admissionKey))
          throw new AdmissionError("unavailable");
        // A revoked admission key cannot be used to restore access.
        if (
          tx
            .select()
            .from(sharingAdmissionReceipts)
            .where(
              eq(
                sharingAdmissionReceipts.keyHash,
                hashKey(document.id, input.admissionKey),
              ),
            )
            .get()
        )
          throw new AdmissionError("unavailable");
      }
      let participantId = access?.participantId ?? undefined;
      const isOwner = access?.scope === "owner" || membership?.isAdmin === true;
      if (!isOwner && !participantId) {
        participantId = input.userId
          ? tx
              .select()
              .from(sharingParticipants)
              .where(
                and(
                  eq(sharingParticipants.documentId, document.id),
                  eq(sharingParticipants.userId, input.userId),
                ),
              )
              .get()?.id
          : undefined;
        participantId ??= tx
          .insert(sharingParticipants)
          .values({
            documentId: document.id,
            userId: input.userId,
            createdAt: now,
          })
          .returning()
          .get().id;
      }
      if (input.userId && participantId) {
        participantId = attachParticipant(
          tx,
          document.id,
          participantId,
          input.userId,
        );
        tx.insert(usersOnDocuments)
          .values({
            documentId: document.id,
            userId: input.userId,
            isAdmin: false,
          })
          .onConflictDoNothing()
          .run();
      }
      const scope: "owner" | "device" = isOwner ? "owner" : "device";
      // A signed-in account may open on another device without another admission.
      const existingDevice =
        !access && input.userId
          ? tx
              .select()
              .from(documentInvitations)
              .where(
                and(
                  eq(documentInvitations.documentId, document.id),
                  eq(documentInvitations.scope, scope),
                  eq(documentInvitations.tag, input.deviceTag),
                  isNull(documentInvitations.revokedAt),
                  participantId
                    ? eq(documentInvitations.participantId, participantId)
                    : isNull(documentInvitations.participantId),
                ),
              )
              .get()
          : undefined;
      const token =
        access ??
        existingDevice ??
        tx
          .insert(documentInvitations)
          .values({
            documentId: document.id,
            scope,
            token: generateId(32),
            tag: input.deviceTag,
            participantId,
            createdAt: now,
            lastUsedAt: now,
          })
          .returning()
          .get();
      if (participantId && token.participantId !== participantId)
        tx.update(documentInvitations)
          .set({ participantId })
          .where(eq(documentInvitations.id, token.id))
          .run();
      if (
        input.admissionKey &&
        !tx
          .select()
          .from(sharingAdmissionReceipts)
          .where(
            eq(
              sharingAdmissionReceipts.keyHash,
              hashKey(document.id, input.admissionKey),
            ),
          )
          .get()
      )
        tx.insert(sharingAdmissionReceipts)
          .values({
            documentId: document.id,
            keyHash: hashKey(document.id, input.admissionKey),
            tokenId: token.id,
          })
          .run();
      return {
        documentId: document.id,
        accessToken: token.token,
        accessTokenScope: token.scope as "owner" | "device",
        joinSecret: result.invitation.token,
      };
    },
    { behavior: "immediate" },
  );
}

export function attachSharedParticipantToAccount(
  userId: string,
  accessToken: string,
) {
  return db.transaction(
    (tx) => {
      const token = tx
        .select()
        .from(documentInvitations)
        .where(
          and(
            eq(documentInvitations.token, accessToken),
            eq(documentInvitations.scope, "device"),
            isNull(documentInvitations.revokedAt),
          ),
        )
        .get();
      if (!token?.participantId || isDocumentBlocked(token.documentId))
        throw new AdmissionError("unavailable");
      const doc = tx
        .select()
        .from(documents)
        .where(
          and(eq(documents.id, token.documentId), isNull(documents.deletedAt)),
        )
        .get();
      if (!doc) throw new AdmissionError("unavailable");
      attachParticipant(tx, token.documentId, token.participantId, userId);
      tx.insert(usersOnDocuments)
        .values({ documentId: token.documentId, userId, isAdmin: false })
        .onConflictDoNothing()
        .run();
      return { documentId: token.documentId };
    },
    { behavior: "immediate" },
  );
}

export function assertSharingOwner(
  documentId: string,
  userId?: string,
  accessToken?: string,
) {
  const document = db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), isNull(documents.deletedAt)))
    .get();
  const ownerToken = credential(db, documentId, { accessToken });
  const member = userId
    ? db
        .select()
        .from(usersOnDocuments)
        .where(
          and(
            eq(usersOnDocuments.documentId, documentId),
            eq(usersOnDocuments.userId, userId),
            eq(usersOnDocuments.isAdmin, true),
          ),
        )
        .get()
    : undefined;
  if (
    !document ||
    isDocumentBlocked(documentId) ||
    (!member && ownerToken?.scope !== "owner")
  )
    throw new AdmissionError("unavailable");
}

export function getSharingSettings(documentId: string): ShareSettings {
  const document = db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .get()!;
  const token = db
    .select()
    .from(documentInvitations)
    .where(
      and(
        eq(documentInvitations.documentId, documentId),
        eq(documentInvitations.scope, "share"),
        isNull(documentInvitations.revokedAt),
      ),
    )
    .get();
  if (!token) throw new AdmissionError("unavailable");
  return {
    token: token.token,
    expiresAt: new Date(
      token.expiresAt?.getTime() ??
        token.createdAt.getTime() + SHARE_LINK_LIFETIME_MS,
    ).toISOString(),
    allowNewJoiners: document.allowNewJoiners,
    participantLimit: SHARE_PARTICIPANT_LIMIT,
    participantCount: db
      .select({ count: sql<number>`count(*)` })
      .from(sharingParticipants)
      .where(eq(sharingParticipants.documentId, documentId))
      .get()!.count,
  };
}

export function ensureAccountParticipant(
  documentId: string,
  userId: string,
): string {
  const membership = db
    .select()
    .from(usersOnDocuments)
    .where(
      and(
        eq(usersOnDocuments.documentId, documentId),
        eq(usersOnDocuments.userId, userId),
      ),
    )
    .get();
  if (!membership || membership.isAdmin)
    throw new AdmissionError("unavailable");
  db.insert(sharingParticipants)
    .values({ documentId, userId })
    .onConflictDoNothing()
    .run();
  return db
    .select()
    .from(sharingParticipants)
    .where(
      and(
        eq(sharingParticipants.documentId, documentId),
        eq(sharingParticipants.userId, userId),
      ),
    )
    .get()!.id;
}
