import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import type { StorageAdapter, StorageKey } from "@automerge/automerge-repo";

export class SqliteStorageAdapter implements StorageAdapter {
  private db: Database;

  constructor(
    dbPath: string,
    private options: {
      journalMode?: "WAL" | "DELETE";
      isBlocked?: (id: string) => boolean;
    } = {},
  ) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.run(`PRAGMA journal_mode=${options.journalMode ?? "WAL"}`);
    // Keep committed writes durable; NORMAL would trade durability for throughput.
    this.db.run("PRAGMA synchronous=FULL");
    this.db.run("PRAGMA busy_timeout=5000");
    this.db.run(`
      CREATE TABLE IF NOT EXISTS automerge_data (
        key TEXT PRIMARY KEY,
        value BLOB NOT NULL
      )
    `);
  }

  async load(key: StorageKey): Promise<Uint8Array | undefined> {
    if (this.options.isBlocked?.(key[0])) return undefined;
    const result = this.db
      .query("SELECT value FROM automerge_data WHERE key = ?")
      .get(this.serializeKey(key)) as { value: Uint8Array } | undefined;

    if (!result) {
      return undefined;
    }

    const buffer = result.value as Buffer | Uint8Array;
    return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  }

  async save(key: StorageKey, data: Uint8Array): Promise<void> {
    // A blocked handle may still have a scheduled flush. Discard it rather than
    // rejecting an internal background promise or resurrecting deleted bytes.
    if (this.options.isBlocked?.(key[0])) return;
    this.db
      .query("INSERT OR REPLACE INTO automerge_data (key, value) VALUES (?, ?)")
      .run(this.serializeKey(key), data);
  }

  async remove(key: StorageKey): Promise<void> {
    this.db
      .query("DELETE FROM automerge_data WHERE key = ?")
      .run(this.serializeKey(key));
  }

  async loadRange(
    keyPrefix: StorageKey,
  ): Promise<{ key: StorageKey; data: Uint8Array }[]> {
    if (this.options.isBlocked?.(keyPrefix[0])) return [];
    const prefix = this.serializeKey(keyPrefix);
    const rows = this.db
      .query("SELECT key, value FROM automerge_data WHERE key >= ? AND key < ?")
      .all(prefix, nextPrefix(prefix)) as { key: string; value: Uint8Array }[];

    return rows.map((row) => ({
      key: this.deserializeKey(row.key),
      data:
        row.value instanceof Uint8Array ? row.value : new Uint8Array(row.value),
    }));
  }

  async removeRange(keyPrefix: StorageKey): Promise<void> {
    const prefix = this.serializeKey(keyPrefix);
    this.db
      .query("DELETE FROM automerge_data WHERE key >= ? AND key < ?")
      .run(prefix, nextPrefix(prefix));
  }

  hasDocumentContent(documentId: string): boolean {
    if (this.options.isBlocked?.(documentId)) return false;
    const snapshotPrefix = `${documentId}/snapshot/`;
    const incrementalPrefix = `${documentId}/incremental/`;
    const row = this.db
      .query(
        `
          SELECT 1
          FROM automerge_data
          WHERE (key >= ? AND key < ?)
             OR (key >= ? AND key < ?)
          LIMIT 1
        `,
      )
      .get(
        snapshotPrefix,
        nextPrefix(snapshotPrefix),
        incrementalPrefix,
        nextPrefix(incrementalPrefix),
      ) as { 1: number } | null | undefined;
    return row != null;
  }

  checkReady(): void {
    this.db.query("SELECT key FROM automerge_data LIMIT 0").all();
  }

  private serializeKey(key: StorageKey): string {
    return key.join("/");
  }

  private deserializeKey(key: string): StorageKey {
    return key.split("/");
  }
}

function nextPrefix(prefix: string): string {
  return `${prefix}\uffff`;
}
