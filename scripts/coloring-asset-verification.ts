import { createHash } from "node:crypto";

import type { PublishedAsset } from "./prepare-coloring-assets";

// Bump this when the public verification contract changes.
export const verificationPrefix = "asset-verification/v1/";
export const assetOrigin = "https://assets.splatterboard.app";
export const requestOrigin = "https://splatterboard.app";
export interface RemoteAsset {
  size: number;
  etag: string;
}

export function planAssetVerification(
  entries: PublishedAsset[],
  remote: Map<string, RemoteAsset>,
  records: Set<string>,
  audit = false,
) {
  const verify = new Set<string>();
  const writeRecords: string[] = [];
  let reusedCollections = 0;
  const representatives = new Map<string, string>();
  const groups = Map.groupBy(entries, (entry) =>
    entry.key.slice(0, entry.key.lastIndexOf("/")),
  );
  for (const collection of groups.values()) {
    const sorted = [...collection].sort((a, b) => a.key.localeCompare(b.key));
    const fingerprint = createHash("sha256")
      .update(JSON.stringify({ assetOrigin, requestOrigin }))
      .update(
        JSON.stringify(sorted.map(({ source: _source, ...entry }) => entry)),
      )
      .digest("hex");
    const recordKey = `${verificationPrefix}${fingerprint}.json`;
    let missing = false;
    for (const entry of sorted) {
      const existing = remote.get(entry.key);
      if (
        existing &&
        (existing.size !== entry.size || existing.etag !== entry.md5)
      )
        throw new Error(`Immutable object mismatch: ${entry.key}`);
      if (!existing) {
        if (audit)
          throw new Error(
            `Missing object: ${entry.key}; run assets:publish to restore it.`,
          );
        missing = true;
      }
      representatives.set(
        `${entry.contentType}|${entry.contentEncoding ?? ""}`,
        entry.key,
      );
    }
    if (audit || missing || !records.has(recordKey)) {
      for (const entry of collection) verify.add(entry.key);
      if (!audit) writeRecords.push(recordKey);
    } else {
      reusedCollections++;
    }
  }
  // Always exercise each MIME/encoding combination against the live CDN.
  for (const key of representatives.values()) verify.add(key);
  return { verify, writeRecords, reusedCollections };
}

export async function fetchPublicAsset(
  key: string,
  request: (url: string, init: RequestInit) => Promise<Response> = fetch,
  sleep: (ms: number) => Promise<unknown> = (ms) => Bun.sleep(ms),
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const response = await request(`${assetOrigin}/${key}`, {
      method: "HEAD",
      headers: { Origin: requestOrigin, "Accept-Encoding": "gzip" },
      signal: AbortSignal.timeout(30000),
    });
    if (attempt === 3 || (response.status !== 429 && response.status < 500))
      return response;
    const retryAfter = response.headers.get("retry-after");
    const requested =
      retryAfter === null
        ? 0
        : /^\d+$/.test(retryAfter)
          ? Number(retryAfter) * 1000
          : Date.parse(retryAfter) - Date.now();
    const delay = Math.max(
      1000 * 2 ** attempt,
      Number.isFinite(requested) ? requested : 0,
    );
    // Do not ignore a long server-requested cooldown or hang a deployment.
    if (delay > 30000) return response;
    await sleep(delay);
  }
}
