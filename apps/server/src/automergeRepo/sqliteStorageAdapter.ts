import type { StorageAdapter, StorageKey } from "@automerge/automerge-repo";
import { Database } from "bun:sqlite";
import { dirname } from "path";
import { mkdirSync } from "fs";

export class SqliteStorageAdapter implements StorageAdapter {
  private db: Database;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS automerge_data (
        key TEXT PRIMARY KEY,
        value BLOB NOT NULL
      )
    `);
  }

  async load(key: StorageKey): Promise<Uint8Array | undefined> {
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
    const prefix = this.serializeKey(keyPrefix);
    const rows = this.db
      .query("SELECT key, value FROM automerge_data WHERE key LIKE ?")
      .all(`${prefix}%`) as { key: string; value: Uint8Array }[];

    return rows.map((row) => ({
      key: this.deserializeKey(row.key),
      data:
        row.value instanceof Uint8Array ? row.value : new Uint8Array(row.value),
    }));
  }

  async removeRange(keyPrefix: StorageKey): Promise<void> {
    const prefix = this.serializeKey(keyPrefix);
    this.db
      .query("DELETE FROM automerge_data WHERE key LIKE ?")
      .run(`${prefix}%`);
  }

  private serializeKey(key: StorageKey): string {
    return key.join("/");
  }

  private deserializeKey(key: string): StorageKey {
    return key.split("/");
  }
}
