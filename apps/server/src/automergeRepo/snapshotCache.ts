import { type Doc, getHeads, save } from "@automerge/automerge";

/** Bounded serialized copies only: no live documents or authorization decisions. */
export class SnapshotCache {
  private entries = new Map<string, { heads: string; bytes: Uint8Array }>();
  private bytes = 0;
  constructor(
    private maxBytes = 8 * 1024 * 1024,
    private maxEntries = 32,
  ) {}

  get<T>(id: string, doc: Doc<T>): Uint8Array {
    const heads = getHeads(doc).sort().join(",");
    const found = this.entries.get(id);
    if (found?.heads === heads) {
      this.entries.delete(id);
      this.entries.set(id, found);
      return found.bytes;
    }
    if (found) this.remove(id);
    const bytes = save(doc);
    if (bytes.byteLength <= this.maxBytes && this.maxEntries > 0) {
      while (
        this.bytes + bytes.byteLength > this.maxBytes ||
        this.entries.size >= this.maxEntries
      ) {
        const oldest = this.entries.keys().next().value;
        if (oldest === undefined) break;
        this.remove(oldest);
      }
      this.entries.set(id, { heads, bytes });
      this.bytes += bytes.byteLength;
    }
    // Callers must not mutate the serialized bytes.
    return bytes;
  }

  private remove(id: string) {
    const entry = this.entries.get(id);
    if (entry) this.bytes -= entry.bytes.byteLength;
    this.entries.delete(id);
  }

  get sizeBytes() {
    return this.bytes;
  }
  get size() {
    return this.entries.size;
  }
}

export const snapshotCache = new SnapshotCache();
