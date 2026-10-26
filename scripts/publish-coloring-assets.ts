import { createHash } from "node:crypto";

import { S3Client } from "bun";

import type { PublishedAsset } from "./prepare-coloring-assets";

const bucket = "splatterboard-assets";
const origin = "https://assets.splatterboard.app";
const required = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
] as const;
for (const key of required)
  if (!process.env[key])
    throw new Error(
      `Missing ${key}; configure an upload key with access to splatterboard-assets in .env.prod`,
    );
const client = new S3Client({
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  bucket,
  region: "auto",
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
});
const entries: PublishedAsset[] = await Bun.file(
  ".coloring-assets/manifest.json",
).json();
const remote = new Map<string, { size: number; etag: string }>();
let continuationToken: string | undefined;
do {
  const page = await client.list({ prefix: "coloring/", continuationToken });
  for (const entry of page.contents ?? [])
    remote.set(entry.key, {
      size: entry.size ?? -1,
      etag: entry.eTag?.replaceAll('"', "") ?? "",
    });
  continuationToken = page.isTruncated ? page.nextContinuationToken : undefined;
} while (continuationToken);
let uploaded = 0,
  bytesUploaded = 0,
  checked = 0,
  cursor = 0;
await Promise.all(
  Array.from({ length: 16 }, async () => {
    while (cursor < entries.length) {
      const entry = entries[cursor++];
      const bytes = await Bun.file(entry.source).bytes();
      if (
        bytes.length !== entry.size ||
        createHash("md5").update(bytes).digest("hex") !== entry.md5
      )
        throw new Error(
          `Asset changed since build: ${entry.source}. Rebuild before publishing.`,
        );
      const existing = remote.get(entry.key);
      if (
        existing &&
        (existing.size !== entry.size || existing.etag !== entry.md5)
      )
        throw new Error(`Immutable object mismatch: ${entry.key}`);
      if (!existing) {
        const headers: Record<string, string> = {
          "Content-Type": entry.contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
          "Content-MD5": Buffer.from(entry.md5, "hex").toString("base64"),
        };
        if (entry.contentEncoding)
          headers["Content-Encoding"] = entry.contentEncoding;
        const response = await fetch(
          client.presign(entry.key, { method: "PUT", expiresIn: 600 }),
          {
            method: "PUT",
            headers,
            body: bytes,
            signal: AbortSignal.timeout(60000),
          },
        );
        if (!response.ok)
          throw new Error(
            `Asset upload failed (${response.status}): ${entry.key}`,
          );
        if (response.headers.get("etag")?.replaceAll('"', "") !== entry.md5)
          throw new Error(`Uploaded checksum mismatch: ${entry.key}`);
        await response.arrayBuffer();
        uploaded++;
        bytesUploaded += entry.size;
      }
      // Confirm the exact public URL and CORS policy before deploying its consumers.
      const published = await fetch(`${origin}/${entry.key}`, {
        method: "HEAD",
        headers: {
          Origin: "https://splatterboard.app",
          "Accept-Encoding": "gzip",
        },
        signal: AbortSignal.timeout(30000),
      });
      if (
        !published.ok ||
        published.headers.get("access-control-allow-origin") !==
          "https://splatterboard.app" ||
        !published.headers
          .get("content-type")
          ?.startsWith(entry.contentType.split(";")[0]) ||
        !published.headers.get("cache-control")?.includes("immutable")
      )
        throw new Error(
          `Public asset verification failed (${published.status}): ${entry.key}`,
        );
      if (++checked % 100 === 0)
        console.log(`Verified ${checked}/${entries.length} assets`);
    }
  }),
);
console.log(
  `Published and verified ${checked} assets; uploaded ${uploaded} objects (${(bytesUploaded / 1e6).toFixed(2)} MB). Existing versions retained.`,
);
