/** Serialize each drawing's uploads so an older preview cannot finish last. */
export function createThumbnailUploadQueue(
  upload: (key: string, image: Blob) => Promise<void>,
): (key: string, image: Blob) => Promise<void> {
  const completedHashes = new Map<string, string>();
  const pending = new Map<string, Promise<void>>();
  return async (key, image) => {
    const previous = pending.get(key) ?? Promise.resolve();
    const next = previous
      .catch(() => {})
      .then(async () => {
        const digest = await crypto.subtle.digest(
          "SHA-256",
          await image.arrayBuffer(),
        );
        const hash =
          image.type +
          Array.from(new Uint8Array(digest), (byte) =>
            byte.toString(16).padStart(2, "0"),
          ).join("");
        if (completedHashes.get(key) === hash) return;
        await upload(key, image);
        completedHashes.set(key, hash);
      });
    pending.set(key, next);
    try {
      await next;
    } finally {
      if (pending.get(key) === next) pending.delete(key);
    }
  };
}
