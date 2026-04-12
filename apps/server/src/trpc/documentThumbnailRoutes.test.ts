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
        contentBase64: Buffer.from("png-bytes").toString("base64"),
      }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it("uploads thumbnail metadata and exposes thumbnail URLs", async () => {
    process.env.R2_PUBLIC_BASE_URL = "https://cdn.example.com";
    const uploaded: Array<{
      key: string;
      contentType: string;
      size: number;
    }> = [];
    setDocumentThumbnailStoreForTests({
      async putObject(input) {
        const bytes =
          typeof input.body === "string"
            ? new TextEncoder().encode(input.body)
            : input.body instanceof Uint8Array
              ? input.body
              : input.body instanceof ArrayBuffer
                ? new Uint8Array(input.body)
                : new Uint8Array(await input.body.arrayBuffer());
        uploaded.push({
          key: input.key,
          contentType: input.contentType,
          size: bytes.byteLength,
        });
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
      contentBase64: Buffer.from("png-bytes").toString("base64"),
    });

    expect(result).toEqual({
      documentId: "thumbnail-doc-2",
      thumbnailUrl:
        "https://cdn.example.com/documents/thumbnail-doc-2/thumbnail.png",
    });
    expect(uploaded).toEqual([
      {
        key: "documents/thumbnail-doc-2/thumbnail.png",
        contentType: "image/png",
        size: 9,
      },
    ]);

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
