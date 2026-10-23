import { afterEach, expect, test } from "bun:test";

import { createAnonymousCollaborativeDocument } from "./db/createAnonymousCollaborativeDocument.js";
import {
  createDocumentToken,
  revokeDocumentToken,
} from "./db/documentTokens.js";
import { getDocumentInvitationByToken } from "./db/getDocumentInvitationByToken.js";
import { getDocumentThumbnail } from "./db/getDocumentThumbnail.js";
import { getSharePreview, renderSharePreview } from "./sharePreview.js";
import { setDocumentThumbnailStoreForTests } from "./storage/documentThumbnailStore.js";
import { appRouter } from "./trpc/appRouter.js";

const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aM4sAAAAASUVORK5CYII=";
const caller = () =>
  appRouter.createCaller({
    req: { headers: {} } as never,
    res: {} as never,
    session: null,
    serverAdmin: null,
  });
afterEach(() => {
  setDocumentThumbnailStoreForTests(null);
  delete process.env.R2_PUBLIC_BASE_URL;
});

test("guest owner publishes a crawler-readable preview; share credentials cannot overwrite it", async () => {
  const drawing = await createAnonymousCollaborativeDocument({
    documentId: "preview-drawing",
    ownerTag: "preview-owner",
  });
  process.env.R2_PUBLIC_BASE_URL = "https://images.example.com";
  const writes: string[] = [];
  setDocumentThumbnailStoreForTests({
    async getObject() {
      return new Uint8Array();
    },
    async deleteObject() {},
    async putObject(input) {
      writes.push(input.key);
      expect(input.contentType).toBe("image/png");
    },
  });
  await expect(
    caller().publishShareThumbnail({
      accessToken: drawing.joinSecret,
      content: png,
      contentType: "image/png",
    }),
  ).rejects.toThrow();
  await expect(
    caller().publishShareThumbnail({
      accessToken: drawing.accessToken,
      content: btoa("<svg/>"),
      contentType: "image/png",
    }),
  ).rejects.toThrow();
  expect(writes).toHaveLength(0);
  expect(
    await getSharePreview(drawing.joinSecret, "https://splatterboard.app"),
  ).toBeNull();
  await caller().publishShareThumbnail({
    accessToken: drawing.accessToken,
    content: png,
    contentType: "image/png",
  });
  const preview = await getSharePreview(
    drawing.joinSecret,
    "https://splatterboard.app",
  );
  expect(preview).toEqual({
    url: `https://splatterboard.app/draw/shared/${drawing.joinSecret}`,
    image: expect.stringMatching(
      /^https:\/\/images\.example\.com\/documents\/preview-drawing\/thumbnail-v2\.png\?v=\d+$/,
    ),
    imageType: "image/png",
  });
  expect(
    await getSharePreview(drawing.accessToken, "https://splatterboard.app"),
  ).toBeNull();
  const device = await createDocumentToken({
    documentId: "preview-drawing",
    scope: "device",
    tag: "recipient",
  });
  await caller().publishShareThumbnail({
    accessToken: device.token,
    content: png,
    contentType: "image/png",
  });
  expect(writes).toHaveLength(2);
  const token = await getDocumentInvitationByToken(drawing.joinSecret);
  await revokeDocumentToken({ tokenId: token!.id });
  expect(
    await getSharePreview(drawing.joinSecret, "https://splatterboard.app"),
  ).toBeNull();
});

test("failed storage upload does not advertise a missing image", async () => {
  const drawing = await createAnonymousCollaborativeDocument({
    documentId: "preview-outage",
    ownerTag: "preview-owner",
  });
  setDocumentThumbnailStoreForTests({
    async getObject() {
      return new Uint8Array();
    },
    async deleteObject() {},
    async putObject() {
      throw new Error("storage unavailable");
    },
  });
  await expect(
    caller().publishShareThumbnail({
      accessToken: drawing.accessToken,
      content: png,
      contentType: "image/png",
    }),
  ).rejects.toThrow("storage unavailable");
  expect(await getDocumentThumbnail("preview-outage")).toBeUndefined();
});

test("share HTML replaces generic metadata and escapes image URLs", () => {
  const html = renderSharePreview(
    `<html><head><title>App</title><link rel="canonical" href="https://old.example"><meta property="og:title" content="Old"><meta name="twitter:card" content="summary"></head><body><script src="./app.js"></script></body></html>`,
    {
      url: "https://splatterboard.app/draw/?join=abc&x=1",
      image: 'https://images.example.com/image.png?x="&y=1',
      imageType: "image/png",
    },
  );
  expect(html.match(/property="og:title"/g)).toHaveLength(1);
  expect(html.match(/name="twitter:card"/g)).toHaveLength(1);
  expect(html).toContain('content="summary_large_image"');
  expect(html).toContain(
    'property="og:image" content="https://images.example.com/image.png?x=&quot;&amp;y=1"',
  );
  expect(html).toContain('src="./app.js"');
  expect(html).not.toContain("old.example");
});
