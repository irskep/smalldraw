import { afterEach, describe, expect, it } from "bun:test";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { createDocument } from "../db/createDocument.js";
import { createUser } from "../db/createUser.js";
import { documentThumbnails, usersOnDocuments } from "../db/schema.js";
import { setDocumentThumbnailStoreForTests } from "../storage/documentThumbnailStore.js";
import { appRouter } from "./appRouter.js";

describe("document thumbnail routes", () => {
  afterEach(() => {
    setDocumentThumbnailStoreForTests(null);
    delete process.env.R2_PUBLIC_BASE_URL;
  });

  it("rejects non-admin thumbnail uploads", async () => {
    const owner = await createUser({
      username: "thumbnail-owner",
      registrationRecord: "registration-record",
    });
    const member = await createUser({
      username: "thumbnail-member",
      registrationRecord: "registration-record-2",
    });
    await createDocument({
      userId: owner.id,
      documentId: "thumbnail-doc-1",
      name: "Thumbnail Doc 1",
    });
    await db.insert(usersOnDocuments).values({
      userId: member.id,
      documentId: "thumbnail-doc-1",
      isAdmin: false,
    });

    const caller = appRouter.createCaller({
      req: { headers: {} } as never,
      res: {} as never,
      session: {
        sessionKey: "member-session",
        userId: member.id,
        createdAt: new Date(),
      },
      serverAdmin: null,
    });

    await expect(
      caller.uploadDocumentThumbnail({
        documentId: "thumbnail-doc-1",
        contentType: "image/png",
      }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it("returns presigned upload URL and persists thumbnail metadata", async () => {
    process.env.R2_PUBLIC_BASE_URL = "https://cdn.example.com";
    setDocumentThumbnailStoreForTests({
      async putObject() {},
      presignPutUrl(input) {
        return `https://presigned.example.com/${input.key}?type=${input.contentType}`;
      },
    });

    const owner = await createUser({
      username: "thumbnail-admin",
      registrationRecord: "registration-record",
    });
    await createDocument({
      userId: owner.id,
      documentId: "thumbnail-doc-2",
      name: "Thumbnail Doc 2",
    });

    const caller = appRouter.createCaller({
      req: { headers: {} } as never,
      res: {} as never,
      session: {
        sessionKey: "owner-session",
        userId: owner.id,
        createdAt: new Date(),
      },
      serverAdmin: null,
    });

    const result = await caller.uploadDocumentThumbnail({
      documentId: "thumbnail-doc-2",
      contentType: "image/png",
    });

    expect(result).toEqual({
      uploadUrl:
        "https://presigned.example.com/documents/thumbnail-doc-2/thumbnail.png?type=image/png",
    });

    const [thumbnail] = await db
      .select()
      .from(documentThumbnails)
      .where(eq(documentThumbnails.documentId, "thumbnail-doc-2"));
    expect(thumbnail?.storageKey).toBe(
      "documents/thumbnail-doc-2/thumbnail.png",
    );

    const documents = await caller.documents();
    expect(documents).toEqual([
      {
        id: "thumbnail-doc-2",
        name: "Thumbnail Doc 2",
        thumbnailUrl:
          "https://cdn.example.com/documents/thumbnail-doc-2/thumbnail.png",
      },
    ]);

    const document = await caller.getDocument("thumbnail-doc-2");
    expect(document).toEqual({
      id: "thumbnail-doc-2",
      name: "Thumbnail Doc 2",
      isAdmin: true,
      thumbnailUrl:
        "https://cdn.example.com/documents/thumbnail-doc-2/thumbnail.png",
    });
  });
});
