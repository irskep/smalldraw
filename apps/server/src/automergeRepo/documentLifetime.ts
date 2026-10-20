import type { DocumentId, Repo } from "@automerge/automerge-repo";

type Entry = { pins: number; touched: number; eviction?: Promise<void> };

/** Pins protect live sync sessions and HTTP operations; only idle decoded copies are evicted. */
export class DocumentLifetime {
  private entries = new Map<DocumentId, Entry>();
  constructor(
    private repo: Repo,
    private options = { maxIdle: 16, idleMs: 60_000 },
    private now = () => Date.now(),
  ) {}

  async acquire(id: DocumentId): Promise<() => void> {
    const entry = this.entry(id);
    entry.pins++;
    // An eviction already in progress finishes before this caller uses the repository.
    await entry.eviction?.catch(() => {
      /* Failed eviction retains the loaded document. */
    });
    let released = false;
    return () => {
      if (released) return;
      released = true;
      entry.pins--;
      entry.touched = this.now();
    };
  }

  async use<T>(id: DocumentId, work: () => Promise<T>): Promise<T> {
    const release = await this.acquire(id);
    try {
      return await work();
    } finally {
      release();
    }
  }

  private entry(id: DocumentId): Entry {
    let entry = this.entries.get(id);
    if (!entry) {
      entry = { pins: 0, touched: this.now() };
      this.entries.set(id, entry);
    }
    return entry;
  }

  async sweep(): Promise<void> {
    const handles = this.repo.handles;
    const idle = Object.keys(handles)
      .map((id) => {
        const documentId = id as DocumentId;
        return { id: documentId, entry: this.entry(documentId) };
      })
      .filter(
        ({ id, entry }) =>
          entry.pins === 0 && !entry.eviction && handles[id]?.isReady(),
      )
      .sort((a, b) => a.entry.touched - b.entry.touched);
    const excess = Math.max(0, idle.length - this.options.maxIdle);
    for (const [index, { id, entry }] of idle.entries()) {
      if (entry.pins || entry.eviction) continue;
      if (index >= excess && this.now() - entry.touched < this.options.idleMs)
        continue;
      const eviction = (async () => {
        await this.repo.flush([id]);
        // Acquisition during the flush pins the existing copy instead.
        if (!entry.pins) await this.repo.removeFromCache(id);
      })();
      entry.eviction = eviction;
      try {
        await eviction;
      } catch (error) {
        console.warn("[server:documents] idle flush/eviction failed", {
          documentId: id,
          error,
        });
      } finally {
        entry.eviction = undefined;
        if (!entry.pins && !this.repo.handles[id]) this.entries.delete(id);
      }
    }
    for (const [id, entry] of this.entries) {
      if (!entry.pins && !entry.eviction && !this.repo.handles[id])
        this.entries.delete(id);
    }
  }
}
