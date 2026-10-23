import { afterEach, describe, expect, it } from "bun:test";

import { eq } from "drizzle-orm";

import { db } from "../db/client.js";
import {
  documentThumbnails,
  documentInvitations,
  documentModeration,
  documents,
  users,
  usersOnDocuments,
} from "../db/schema.js";
import { setDocumentThumbnailStoreForTests } from "../storage/documentThumbnailStore";
import { appRouter } from "./appRouter.js";

function caller(admin = true) {
  return appRouter.createCaller({
    req: { headers: {} } as never,
    res: {} as never,
    session: null,
    serverAdmin: admin ? { id: "admin", username: "admin" } : null,
  });
}
async function seed() {
  await db.insert(documents).values([
    { id: "a", contentUpdatedAt: new Date(1000) },
    { id: "b", contentUpdatedAt: new Date(2000) },
    { id: "c", contentUpdatedAt: new Date(2000) },
  ]);
  await db
    .insert(users)
    .values({ id: "owner", username: "owner", registrationRecord: "opaque" });
  await db
    .insert(usersOnDocuments)
    .values({ userId: "owner", documentId: "b", isAdmin: true });
  await db
    .insert(documentInvitations)
    .values({ documentId: "a", token: "guest-share", scope: "share" });
}

afterEach(() => setDocumentThumbnailStoreForTests(null));
describe("moderation routes", () => {
  it("returns bounded authenticated thumbnails and tolerates missing or oversized objects", async () => {
    await seed();
    await db.insert(documentThumbnails).values({
      documentId: "a",
      storageKey: "test-thumb",
      contentType: "image/png",
    });
    let image = new Uint8Array([1, 2, 3]);
    let missing = false;
    setDocumentThumbnailStoreForTests({
      getObject: async () => {
        if (missing) throw new Error("Object missing");
        return image;
      },
      deleteObject: async () => {},
      putObject: async () => {},
    });
    const api = caller();
    expect(await api.adminDrawingThumbnail({ documentId: "a" })).toEqual({
      contentType: "image/png",
      data: "AQID",
    });
    image = new Uint8Array(2 * 1024 * 1024 + 1);
    expect(await api.adminDrawingThumbnail({ documentId: "a" })).toBeNull();
    missing = true;
    expect(await api.adminDrawingThumbnail({ documentId: "a" })).toBeNull();
    expect(await api.adminDrawingThumbnail({ documentId: "b" })).toBeNull();
    await db.update(documentThumbnails).set({ contentType: "image/svg+xml" });
    missing = false;
    expect(await api.adminDrawingThumbnail({ documentId: "a" })).toBeNull();
  });
  it("requires administrator authorization for metadata, previews, and mutations", async () => {
    const api = caller(false);
    for (const request of [
      () => api.adminDrawingFeed({}),
      () => api.adminFindDrawing({ lookup: "a" }),
      () => api.adminDrawingDetails({ documentId: "a" }),
      () => api.adminDrawingThumbnail({ documentId: "a" }),
      () => api.adminDrawingSnapshot({ documentId: "a" }),
      () => api.adminTakeDownDrawing({ documentId: "a", reason: "harmful" }),
      () => api.adminRetryDrawingCleanup({ documentId: "a" }),
    ])
      await expect(request()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await db
      .insert(users)
      .values({ id: "plain", username: "plain", registrationRecord: "opaque" });
    const ordinary = appRouter.createCaller({
      req: { headers: {} } as never,
      res: {} as never,
      session: {
        userId: "plain",
        sessionKey: "session",
        createdAt: new Date(),
      },
      serverAdmin: null,
    });
    await expect(ordinary.adminDrawingFeed({})).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("paginates tied content dates and distinguishes guests, owners, and shared drawings", async () => {
    await seed();
    const api = caller();
    const page = await api.adminDrawingFeed({ limit: 1 });
    expect(page.items.map((row) => row.id)).toEqual(["c"]);
    const second = await api.adminDrawingFeed({
      limit: 1,
      cursor: page.nextCursor!,
    });
    expect(second.items[0]?.id).toBe("b");
    expect(second.items[0]?.owners).toEqual([
      { id: "owner", username: "owner" },
    ]);
    const third = await api.adminDrawingFeed({
      limit: 1,
      cursor: second.nextCursor!,
    });
    expect(third.items[0]?.id).toBe("a");
    expect(third.nextCursor).toBeNull();
    expect(third.items[0]?.owners).toEqual([]);
    expect(
      (await api.adminDrawingFeed({ filter: "shared" })).items.map(
        (row) => row.id,
      ),
    ).toEqual(["a"]);
    // Metadata updates must not alter content order.
    await db
      .update(documents)
      .set({ updatedAt: new Date(), name: "renamed" })
      .where(eq(documents.id, "a"));
    expect((await api.adminDrawingFeed({ limit: 1 })).items[0]?.id).toBe("c");
  });

  it("resolves guest and account IDs and old/new links without creating access", async () => {
    await seed();
    const api = caller();
    for (const lookup of [
      "a",
      "automerge:a",
      "/draw/a",
      "/draw/shared/guest-share",
      "https://splatterboard.app/draw/?join=guest-share",
      "/draw/?local=automerge%3Aa",
      "/draw/?doc=a",
      "/invitation/guest-share",
    ]) {
      expect((await api.adminFindDrawing({ lookup }))?.id).toBe("a");
    }
    expect(
      (await api.adminFindDrawing({ lookup: "/draw/b" }))?.owners[0]?.username,
    ).toBe("owner");
    expect(await db.select().from(usersOnDocuments)).toHaveLength(1);
    expect(await db.select().from(documentInvitations)).toHaveLength(1);
    expect(await api.adminFindDrawing({ lookup: "/draw/new" })).toBeNull();
  });

  it("retains taken-down feed entries independently of document rows and denies previews", async () => {
    await seed();
    await db
      .insert(documentModeration)
      .values({ documentId: "a", administratorId: "admin", reason: "harmful" });
    const api = caller();
    expect((await api.adminDrawingFeed({})).items.map((row) => row.id)).toEqual(
      ["c", "b"],
    );
    const removed = await api.adminFindDrawing({
      lookup: "/draw/shared/guest-share",
    });
    expect(removed?.moderation?.reason).toBe("harmful");
    expect(removed?.shareTokens).toEqual([]);
    expect(removed?.hasThumbnail).toBe(false);
    await db.delete(documents).where(eq(documents.id, "a"));
    expect(
      (await api.adminDrawingFeed({ filter: "taken-down" })).items[0]?.id,
    ).toBe("a");
    await expect(
      api.adminDrawingThumbnail({ documentId: "a" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      api.adminDrawingSnapshot({ documentId: "a" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("bounds input and refuses cleanup of live content", async () => {
    await seed();
    const api = caller();
    await expect(api.adminDrawingFeed({ limit: 10000 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(
      api.adminTakeDownDrawing({ documentId: "a", reason: "  " }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      api.adminRetryDrawingCleanup({ documentId: "a" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
