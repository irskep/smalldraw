import type { Database } from "bun:sqlite";

/** drizzle-kit push applies schema only; perform the same data backfill at startup. */
export function backfillContentUpdatedAt(sqlite: Database): void {
  // Unit tests import the client before creating tables through migrations.
  const columns = sqlite
    .query<{ name: string }, []>("PRAGMA table_info(documents)")
    .all();
  if (!columns.some((column) => column.name === "content_updated_at")) return;
  sqlite.run(
    "UPDATE documents SET content_updated_at = updated_at WHERE content_updated_at = 0",
  );
  const thumbnailColumns = sqlite
    .query<{ name: string }, []>("PRAGMA table_info(document_thumbnails)")
    .all();
  if (thumbnailColumns.some((column) => column.name === "legacy_storage_key")) {
    sqlite.run(
      "UPDATE document_thumbnails SET legacy_storage_key = storage_key WHERE legacy_storage_key IS NULL AND storage_key LIKE '%/thumbnail.png'",
    );
  }
}
