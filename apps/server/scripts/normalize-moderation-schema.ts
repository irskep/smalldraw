import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const indexes = [
  {
    name: "documents_content_updated_idx",
    table: "documents",
    columns: ["content_updated_at", "id"],
  },
  {
    name: "document_moderation_taken_down_idx",
    table: "document_moderation",
    columns: ["taken_down_at", "document_id"],
  },
] as const;

/** Repair the two SQLite representations Drizzle Kit cannot round-trip.
 * Plain indexes support the same descending order through a backward scan. */
export function normalizeModerationSchema(sqlite: Database): void {
  const columns = sqlite
    .query<{ name: string; dflt_value: string | null }, []>(
      "PRAGMA table_info(documents)",
    )
    .all();
  const contentColumn = columns.find(
    (column) => column.name === "content_updated_at",
  );
  const normalizeDefault = contentColumn?.dflt_value === "0";
  // Changing this default through schema push emits CREATE INDEX twice. Rebuild
  // this known table transactionally first; foreign keys remain attached to the
  // final table name and their rows must not cascade during the replacement.
  const foreignKeys = sqlite
    .query<{ foreign_keys: number }, []>("PRAGMA foreign_keys")
    .get()!.foreign_keys;
  if (normalizeDefault) sqlite.exec("PRAGMA foreign_keys=OFF");
  try {
    sqlite.transaction(() => {
      if (normalizeDefault) {
        const names = [
          "id",
          "name",
          "created_at",
          "updated_at",
          "content_updated_at",
          "deleted_at",
        ];
        if (
          columns.length !== names.length ||
          !names.every((name) => columns.some((column) => column.name === name))
        ) {
          throw new Error(
            "Unexpected documents columns; refusing to normalize schema",
          );
        }
        const extraSchema = sqlite
          .query<{ name: string }, []>(
            "SELECT name FROM sqlite_master WHERE tbl_name='documents' AND type IN ('index','trigger') AND name NOT IN ('sqlite_autoindex_documents_1','documents_content_updated_idx')",
          )
          .all();
        if (extraSchema.length > 0)
          throw new Error(
            "Unexpected documents indexes/triggers; refusing to normalize schema",
          );
        sqlite.exec(`CREATE TABLE __moderation_documents (
          id text PRIMARY KEY NOT NULL,
          name text DEFAULT 'Untitled' NOT NULL,
          created_at integer DEFAULT (unixepoch()) NOT NULL,
          updated_at integer DEFAULT (unixepoch()) NOT NULL,
          content_updated_at integer DEFAULT '0' NOT NULL,
          deleted_at integer
        );
        INSERT INTO __moderation_documents SELECT id,name,created_at,updated_at,content_updated_at,deleted_at FROM documents;
        DROP TABLE documents;
        ALTER TABLE __moderation_documents RENAME TO documents;`);
      }
      for (const index of indexes) {
        const tableColumns = sqlite
          .query<{ name: string }, []>(`PRAGMA table_info(${index.table})`)
          .all();
        if (
          !index.columns.every((name) =>
            tableColumns.some((column) => column.name === name),
          )
        )
          continue;
        const parts = sqlite
          .query<{ name: string | null; desc: number; key: number }, []>(
            `PRAGMA index_xinfo(${index.name})`,
          )
          .all()
          .filter((part) => part.key);
        if (
          parts.length === index.columns.length &&
          parts.every(
            (part, i) => part.name === index.columns[i] && part.desc === 0,
          )
        )
          continue;
        sqlite.exec(
          `DROP INDEX IF EXISTS ${index.name}; CREATE INDEX ${index.name} ON ${index.table} (${index.columns.join(", ")});`,
        );
      }
      if (
        normalizeDefault &&
        sqlite.query("PRAGMA foreign_key_check").all().length > 0
      ) {
        throw new Error(
          "Foreign-key violation while normalizing moderation schema",
        );
      }
    })();
  } finally {
    if (normalizeDefault) sqlite.exec(`PRAGMA foreign_keys=${foreignKeys}`);
  }
}

if (import.meta.main) {
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  const configured = process.env.DATABASE_URL ?? "./sqlite/dev.db";
  const databasePath = path.isAbsolute(configured)
    ? configured
    : path.resolve(root, "apps/server", configured);
  if (configured !== ":memory:" && existsSync(databasePath)) {
    const sqlite = new Database(databasePath);
    try {
      sqlite.run("PRAGMA busy_timeout=5000");
      normalizeModerationSchema(sqlite);
    } finally {
      sqlite.close();
    }
  }
}
