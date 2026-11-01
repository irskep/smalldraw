import { expect, test } from "bun:test";

import {
  isBlockedShareReferrer,
  SHARE_LINK_LIFETIME_MS,
} from "@smalldraw/shared";
import { eq } from "drizzle-orm";

import { claimAnonymousCollaborativeDocument } from "./claimAnonymousCollaborativeDocument";
import { db } from "./client";
import { createAnonymousCollaborativeDocument } from "./createAnonymousCollaborativeDocument";
import { createOrGetDocumentInvitation } from "./createOrGetDocumentInvitation";
import { createUser } from "./createUser";
import { rotateAnonymousCollaborativeDocumentShareToken } from "./rotateAnonymousCollaborativeDocumentShareToken";
import { documentInvitations, documents, sharingParticipants } from "./schema";
import {
  admitShareParticipant,
  attachSharedParticipantToAccount,
  assertSharingOwner,
  getSharingSettings,
  inspectSharingAdmission,
} from "./sharingAdmission";

const key = (n: number) => n.toString(16).padStart(64, "0");
async function setup() {
  const registration = await createAnonymousCollaborativeDocument({
    documentId: crypto.randomUUID(),
    ownerTag: "owner",
  });
  const join = (n: number, extra = {}) =>
    admitShareParticipant({
      joinSecret: registration.joinSecret,
      deviceTag: `device-${n}`,
      admissionKey: key(n),
      confirmed: true,
      ...extra,
    });
  return { ...registration, join };
}

test("previews are read-only; explicit confirmation is required; owner is excluded", async () => {
  const r = await setup();
  for (let i = 0; i < 20; i++)
    expect(
      inspectSharingAdmission({
        joinSecret: r.joinSecret,
        deviceTag: "crawler",
      }).availability,
    ).toBe("open");
  expect(() => r.join(1, { confirmed: false })).toThrow();
  expect(getSharingSettings(r.document.id).participantCount).toBe(0);
  const owner = r.join(1, { confirmed: false, accessToken: r.accessToken });
  expect(owner.accessTokenScope).toBe("owner");
  expect(getSharingSettings(r.document.id).participantCount).toBe(0);
});

test("last slot admits once, retries are idempotent, tags alone cannot recover credentials", async () => {
  const r = await setup();
  for (let i = 1; i <= 9; i++) r.join(i);
  const results = await Promise.allSettled([
    Promise.resolve().then(() => r.join(10)),
    Promise.resolve().then(() => r.join(11)),
  ]);
  expect(
    results.filter((result) => result.status === "fulfilled"),
  ).toHaveLength(1);
  const first = r.join(10);
  expect(r.join(10).accessToken).toBe(first.accessToken);
  expect(() => r.join(12, { deviceTag: "device-10" })).toThrow("full");
  expect(getSharingSettings(r.document.id).participantCount).toBe(10);
});

test("expiry, closure, replacement and referral never lock out an admitted participant", async () => {
  const r = await setup();
  const joined = r.join(1);
  db.update(documents)
    .set({ allowNewJoiners: false })
    .where(eq(documents.id, r.document.id))
    .run();
  expect(() => r.join(2)).toThrow("closed");
  const renewed = await rotateAnonymousCollaborativeDocumentShareToken(
    r.document.id,
  );
  expect(getSharingSettings(r.document.id).allowNewJoiners).toBe(false);
  expect(getSharingSettings(r.document.id).participantCount).toBe(1);
  expect(() => r.join(2)).toThrow("unavailable");
  expect(
    r.join(1, {
      confirmed: false,
      navigationReferrer: "https://news.ycombinator.com/",
    }).accessToken,
  ).toBe(joined.accessToken);
  db.update(documents)
    .set({ allowNewJoiners: true })
    .where(eq(documents.id, r.document.id))
    .run();
  expect(() =>
    admitShareParticipant(
      {
        joinSecret: renewed.token,
        deviceTag: "new",
        admissionKey: key(2),
        confirmed: true,
      },
      new Date(Date.now() + SHARE_LINK_LIFETIME_MS + 1000),
    ),
  ).toThrow("expired");
  expect(
    admitShareParticipant(
      {
        joinSecret: renewed.token,
        deviceTag: "returning",
        accessToken: joined.accessToken,
        confirmed: false,
      },
      new Date(Date.now() + SHARE_LINK_LIFETIME_MS + 1000),
    ).accessToken,
  ).toBe(joined.accessToken);
});

test("HN and Reddit referrals block admission with parsed hostname boundaries", async () => {
  for (const host of [
    "news.ycombinator.com",
    "reddit.com",
    "old.reddit.com",
    "www.reddit.com",
    "redd.it",
    "www.redd.it",
  ]) {
    expect(isBlockedShareReferrer(`https://${host}/item`)).toBe(true);
  }
  for (const value of [
    undefined,
    "",
    "https://notreddit.com",
    "https://reddit.com.example.org",
    "https://example.org/?reddit.com",
    "bad URL",
  ])
    expect(isBlockedShareReferrer(value)).toBe(false);
  const r = await setup();
  expect(() =>
    r.join(1, { navigationReferrer: "https://reddit.com/r/art" }),
  ).toThrow("blocked_referral");
  expect(() =>
    r.join(1, { requestReferrer: "https://news.ycombinator.com/item?id=1" }),
  ).toThrow("blocked_referral");
  expect(getSharingSettings(r.document.id).participantCount).toBe(0);
  expect(r.join(1).accessToken).toBeTruthy();
});

test("account identities across browsers count once, guest attachment merges after expiry", async () => {
  const r = await setup();
  const user = await createUser({
    username: "participant",
    registrationRecord: "test",
  });
  const account = r.join(1, { userId: user.id });
  const otherDevice = r.join(2, { userId: user.id, confirmed: false });
  expect(otherDevice.accessToken).not.toBe(account.accessToken);
  expect(getSharingSettings(r.document.id).participantCount).toBe(1);
  const guest = r.join(3);
  expect(getSharingSettings(r.document.id).participantCount).toBe(2);
  db.update(documentInvitations)
    .set({ expiresAt: new Date(0) })
    .where(eq(documentInvitations.token, r.joinSecret))
    .run();
  attachSharedParticipantToAccount(user.id, guest.accessToken);
  expect(getSharingSettings(r.document.id).participantCount).toBe(1);
  expect(r.join(3, { userId: user.id, confirmed: false }).accessToken).toBe(
    guest.accessToken,
  );
  const stranger = await createUser({
    username: "stranger",
    registrationRecord: "test",
  });
  expect(() =>
    attachSharedParticipantToAccount(stranger.id, guest.accessToken),
  ).toThrow();
});

test("revocation doesn't recycle slots and admission receipts cannot resurrect access", async () => {
  const r = await setup();
  const guest = r.join(1);
  db.update(documentInvitations)
    .set({ revokedAt: new Date() })
    .where(eq(documentInvitations.token, guest.accessToken))
    .run();
  expect(() => r.join(1)).toThrow("unavailable");
  expect(getSharingSettings(r.document.id).participantCount).toBe(1);
  expect(() =>
    assertSharingOwner(r.document.id, undefined, guest.accessToken),
  ).toThrow();
  expect(() =>
    assertSharingOwner(r.document.id, undefined, r.joinSecret),
  ).toThrow();
  assertSharingOwner(r.document.id, undefined, r.accessToken);
  expect(db.select().from(sharingParticipants).all()).toHaveLength(1);
});

test("opening sharing on another owner device never renews an expired invitation", async () => {
  const r = await setup();
  const user = await createUser({
    username: "owner",
    registrationRecord: "test",
  });
  await claimAnonymousCollaborativeDocument({
    userId: user.id,
    accessToken: r.accessToken,
  });
  db.update(documentInvitations)
    .set({ expiresAt: new Date(1000) })
    .where(eq(documentInvitations.token, r.joinSecret))
    .run();
  const invitation = await createOrGetDocumentInvitation({
    documentId: r.document.id,
    userId: user.id,
  });
  expect(invitation.token).toBe(r.joinSecret);
  expect(invitation.expiresAt!.getTime()).toBe(1000);
});

test("drawings already over the cap retain participants without admitting more", async () => {
  const r = await setup();
  const first = r.join(1);
  for (let i = 2; i <= 10; i++) r.join(i);
  db.insert(sharingParticipants).values({ documentId: r.document.id }).run();
  expect(() => r.join(12)).toThrow("full");
  expect(r.join(1, { confirmed: false }).accessToken).toBe(first.accessToken);
  expect(getSharingSettings(r.document.id).participantCount).toBe(11);
});
