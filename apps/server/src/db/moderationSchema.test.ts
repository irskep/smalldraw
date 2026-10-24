import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { drizzle } from "drizzle-orm/bun-sqlite";

import journal from "../../drizzle/meta/_journal.json";
import { normalizeModerationSchema } from "../../scripts/normalize-moderation-schema.js";
import { backfillContentUpdatedAt } from "./backfillContentUpdatedAt.js";
import { documents } from "./schema.js";

const migration = (tag: string) =>
  readFileSync(
    path.join(import.meta.dir, "../../drizzle", `${tag}.sql`),
    "utf8",
  );

function createOldDatabase() {
  const sqlite = new Database(":memory:");
  for (const entry of journal.entries.filter((entry) => entry.idx < 8)) {
    sqlite.exec(migration(entry.tag));
  }
  return sqlite;
}

describe("moderation schema migration", () => {
  it("does nothing before tables exist and refuses to discard unexpected schema", () => {
    const empty = new Database(":memory:");
    normalizeModerationSchema(empty);
    expect(empty.query("SELECT name FROM sqlite_master").all()).toEqual([]);
    empty.close();
    const sqlite = createOldDatabase();
    try {
      sqlite.exec(migration("0008_document_moderation"));
      sqlite.exec(
        "PRAGMA foreign_keys=ON; CREATE INDEX additional_document_index ON documents(name)",
      );
      expect(() => normalizeModerationSchema(sqlite)).toThrow(
        "Unexpected documents indexes/triggers",
      );
      expect(sqlite.query("PRAGMA foreign_keys").get()).toEqual({
        foreign_keys: 1,
      });
      expect(
        sqlite
          .query(
            "SELECT name FROM sqlite_master WHERE name='additional_document_index'",
          )
          .get(),
      ).not.toBeNull();
    } finally {
      sqlite.close();
    }
  });

  it("normalizes a populated deployed database before repeated schema push without losing references", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "moderation-push-"));
    const file = path.join(dir, "app.db");
    const sqlite = new Database(file);
    const tables = [
      "documents",
      "users_on_documents",
      "document_invitations",
      "document_thumbnails",
      "document_moderation",
    ];
    try {
      for (const entry of journal.entries.filter((entry) => entry.idx < 10))
        sqlite.exec(migration(entry.tag));
      sqlite.exec(`PRAGMA foreign_keys=ON;
        INSERT INTO users(id,username,registration_record) VALUES('owner','owner','record');
        INSERT INTO documents(id,name,created_at,updated_at,content_updated_at,deleted_at) VALUES('kept','Keep this',11,22,33,44);
        INSERT INTO users_on_documents(user_id,document_id,is_admin) VALUES('owner','kept',1);
        INSERT INTO document_invitations(id,document_id,token,scope) VALUES('invite','kept','secret-token','share');
        INSERT INTO document_thumbnails(document_id,storage_key,content_type) VALUES('kept','key','image/png');
        INSERT INTO document_moderation(document_id,administrator_id,reason) VALUES('removed','owner','test');`);
      const before = tables.map((table) =>
        sqlite.prepare(`SELECT * FROM ${table}`).all(),
      );
      normalizeModerationSchema(sqlite);
      normalizeModerationSchema(sqlite);
      expect(sqlite.query("PRAGMA foreign_keys").get()).toEqual({
        foreign_keys: 1,
      });
      const root = path.resolve(import.meta.dir, "../../../..");
      for (let i = 0; i < 2; i++) {
        const process = Bun.spawn(
          [
            Bun.which("bun")!,
            "node_modules/drizzle-kit/bin.cjs",
            "push",
            "--force",
          ],
          {
            cwd: root,
            env: { ...Bun.env, DATABASE_URL: file },
            stdout: "pipe",
            stderr: "pipe",
          },
        );
        const [stdout, stderr, code] = await Promise.all([
          new Response(process.stdout).text(),
          new Response(process.stderr).text(),
          process.exited,
        ]);
        expect({ code, errors: stderr }).toEqual({ code: 0, errors: "" });
        expect(stdout).toContain("No changes detected");
      }
      expect(
        tables.map((table) => sqlite.prepare(`SELECT * FROM ${table}`).all()),
      ).toEqual(before);
      expect(sqlite.query("PRAGMA foreign_key_check").all()).toEqual([]);
      sqlite.exec("INSERT INTO documents(id) VALUES('new')");
      expect(
        sqlite
          .query(
            "SELECT content_updated_at, typeof(content_updated_at) AS type FROM documents WHERE id='new'",
          )
          .get(),
      ).toEqual({ content_updated_at: 0, type: "integer" });
    } finally {
      sqlite.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("retains legacy thumbnail cleanup targets through migration and schema-push backfill", () => {
    const sqlite = createOldDatabase();
    try {
      sqlite.exec(migration("0008_document_moderation"));
      sqlite.exec("INSERT INTO documents(id) VALUES ('old'), ('new')");
      sqlite.exec(
        "INSERT INTO document_thumbnails(document_id,storage_key,content_type) VALUES ('old','documents/old/thumbnail.png','image/png'),('new','documents/new/thumbnail-v2.png','image/png')",
      );
      sqlite.exec(migration("0009_legacy_thumbnail_cleanup"));
      expect(
        sqlite
          .query(
            "SELECT legacy_storage_key FROM document_thumbnails WHERE document_id='old'",
          )
          .get(),
      ).toEqual({ legacy_storage_key: "documents/old/thumbnail.png" });
      expect(
        sqlite
          .query(
            "SELECT legacy_storage_key FROM document_thumbnails WHERE document_id='new'",
          )
          .get(),
      ).toEqual({ legacy_storage_key: null });
      sqlite.exec(
        "UPDATE document_thumbnails SET legacy_storage_key=NULL WHERE document_id='old'",
      );
      backfillContentUpdatedAt(sqlite);
      expect(
        sqlite
          .query(
            "SELECT legacy_storage_key FROM document_thumbnails WHERE document_id='old'",
          )
          .get(),
      ).toEqual({ legacy_storage_key: "documents/old/thumbnail.png" });
    } finally {
      sqlite.close();
    }
  });

  it("preserves existing content and tokens, backfills dates, and orders timestamp ties", () => {
    const sqlite = createOldDatabase();
    try {
      sqlite.exec(`
        INSERT INTO documents (id, name, updated_at) VALUES
          ('a', 'Drawing A', 100), ('b', 'Drawing B', 100), ('c', 'Drawing C', 50);
        INSERT INTO document_invitations (id, document_id, token, scope)
          VALUES ('invitation', 'a', 'existing-token', 'share');
      `);
      sqlite.exec(migration("0008_document_moderation"));
      expect(
        sqlite
          .query(
            "SELECT id, content_updated_at FROM documents ORDER BY content_updated_at DESC, id DESC",
          )
          .all(),
      ).toEqual([
        { id: "b", content_updated_at: 100 },
        { id: "a", content_updated_at: 100 },
        { id: "c", content_updated_at: 50 },
      ]);
      expect(
        sqlite.query("SELECT token FROM document_invitations").get(),
      ).toEqual({ token: "existing-token" });
      expect(
        sqlite.query("SELECT name FROM documents WHERE id = 'a'").get(),
      ).toEqual({ name: "Drawing A" });
      backfillContentUpdatedAt(sqlite);
      expect(
        sqlite
          .query("SELECT content_updated_at FROM documents WHERE id = 'a'")
          .get(),
      ).toEqual({ content_updated_at: 100 });
    } finally {
      sqlite.close();
    }
  });

  it("backfills schema-push databases and preserves explicitly supplied content timestamps", () => {
    const sqlite = createOldDatabase();
    try {
      sqlite.exec("INSERT INTO documents (id, updated_at) VALUES ('old', 123)");
      // Production uses schema push, which doesn't execute migration data statements.
      sqlite.exec(
        migration("0008_document_moderation").split("UPDATE documents")[0]!,
      );
      backfillContentUpdatedAt(sqlite);
      expect(
        sqlite
          .query("SELECT content_updated_at FROM documents WHERE id = 'old'")
          .get(),
      ).toEqual({ content_updated_at: 123 });
      const now = Math.floor(Date.now() / 1000);
      drizzle(sqlite)
        .insert(documents)
        .values({ id: "new", contentUpdatedAt: new Date() })
        .run();
      const row = sqlite
        .query<{ content_updated_at: number }, []>(
          "SELECT content_updated_at FROM documents WHERE id = 'new'",
        )
        .get()!;
      expect(row.content_updated_at).toBeGreaterThanOrEqual(now);
      // Administrative updated_at changes do not alter the content feed.
      sqlite.exec("UPDATE documents SET updated_at = 999 WHERE id = 'old'");
      backfillContentUpdatedAt(sqlite);
      expect(
        sqlite
          .query("SELECT content_updated_at FROM documents WHERE id = 'old'")
          .get(),
      ).toEqual({ content_updated_at: 123 });
    } finally {
      sqlite.close();
    }
  });

  it("retains the block, audit, and retry target after document and admin deletion", () => {
    const sqlite = createOldDatabase();
    try {
      sqlite.exec(migration("0008_document_moderation"));
      sqlite.exec(`
        PRAGMA foreign_keys = ON;
        INSERT INTO users (id, username, registration_record) VALUES ('admin', 'admin', 'record');
        INSERT INTO documents (id) VALUES ('removed');
        INSERT INTO document_moderation (document_id, administrator_id, reason, thumbnail_storage_key, cleanup_attempts, last_error)
          VALUES ('removed', 'admin', 'Harmful content', 'thumbnail-key', 1, 'Storage unavailable');
        DELETE FROM documents WHERE id = 'removed';
        DELETE FROM users WHERE id = 'admin';
      `);
      expect(
        sqlite
          .query(
            "SELECT document_id, administrator_id, cleanup_state, thumbnail_storage_key, cleanup_attempts, last_error FROM document_moderation",
          )
          .get(),
      ).toEqual({
        document_id: "removed",
        administrator_id: "admin",
        cleanup_state: "pending",
        thumbnail_storage_key: "thumbnail-key",
        cleanup_attempts: 1,
        last_error: "Storage unavailable",
      });
    } finally {
      sqlite.close();
    }
  });

  it("uses bounded indexed feed, token, and cleanup queries on a populated database", () => {
    const sqlite = createOldDatabase();
    try {
      sqlite.exec(migration("0008_document_moderation"));
      normalizeModerationSchema(sqlite);
      sqlite.exec(`WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<10000)
        INSERT INTO documents (id, content_updated_at) SELECT printf('%06d', x), x / 2 FROM n;
        INSERT INTO document_invitations (id, document_id, token, scope)
          SELECT id, id, 'token-' || id, 'share' FROM documents WHERE content_updated_at % 3 = 0;
        ANALYZE;
      `);
      const plan = (query: string) =>
        JSON.stringify(sqlite.query(`EXPLAIN QUERY PLAN ${query}`).all());
      const feed = plan(`SELECT d.id FROM documents d
        WHERE (d.content_updated_at, d.id) < (4000, '008000')
          AND NOT EXISTS (SELECT 1 FROM document_moderation m WHERE m.document_id = d.id)
          AND EXISTS (SELECT 1 FROM document_invitations i WHERE i.document_id = d.id AND i.scope = 'share' AND i.revoked_at IS NULL)
        ORDER BY d.content_updated_at DESC, d.id DESC LIMIT 31`);
      expect(feed).toContain("documents_content_updated_idx");
      expect(feed).toContain("document_invitations_document_scope_idx");
      expect(feed).not.toContain("TEMP B-TREE");
      expect(
        plan(
          "SELECT document_id FROM document_moderation WHERE cleanup_state = 'pending' AND next_retry_at <= 100 ORDER BY next_retry_at LIMIT 10",
        ),
      ).toContain("document_moderation_cleanup_idx");
      expect(
        plan(
          "SELECT document_id FROM document_moderation ORDER BY taken_down_at DESC, document_id DESC LIMIT 31",
        ),
      ).toContain("document_moderation_taken_down_idx");
    } finally {
      sqlite.close();
    }
  });
});
