import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import journal from "../../drizzle/meta/_journal.json";
import { backfillSharingPolicy } from "./backfillSharingPolicy";

test("sharing migration and schema-push backfill preserve old recipients and expiry", () => {
  for (const schemaPush of [false, true]) {
    const sqlite = new Database(":memory:");
    try {
      const migration = (name: string) =>
        readFileSync(
          new URL(`../../drizzle/${name}.sql`, import.meta.url),
          "utf8",
        );
      for (const entry of journal.entries.filter((e) => e.idx < 11))
        sqlite.exec(migration(entry.tag));
      sqlite.exec("PRAGMA foreign_keys = ON");
      sqlite.exec(
        "INSERT INTO documents (id, name) VALUES ('drawing', 'Old drawing')",
      );
      sqlite.exec(
        "INSERT INTO users (id, username, registration_record) VALUES ('user', 'person', 'test')",
      );
      sqlite.exec(
        "INSERT INTO users_on_documents (user_id, document_id, is_admin) VALUES ('user', 'drawing', 0)",
      );
      sqlite.exec(
        "INSERT INTO document_invitations (id, document_id, token, scope, tag, created_at) VALUES ('share', 'drawing', 'invitation', 'share', NULL, 100), ('account-device', 'drawing', 'account-token', 'device', 'account:user:device:1', 100), ('guest', 'drawing', 'guest-token', 'device', 'guest-1', 100)",
      );
      const sql = migration(journal.entries.find((e) => e.idx === 11)!.tag);
      sqlite.exec(
        schemaPush
          ? sql.split("UPDATE document_invitations SET expires_at")[0]!
          : sql,
      );
      backfillSharingPolicy(sqlite);
      backfillSharingPolicy(sqlite);
      expect(
        sqlite
          .query("SELECT count(*) AS count FROM sharing_participants")
          .get(),
      ).toEqual({ count: 2 });
      expect(
        sqlite
          .query(
            "SELECT expires_at FROM document_invitations WHERE scope = 'share'",
          )
          .get(),
      ).toEqual({ expires_at: 604900 });
      expect(
        sqlite
          .query(
            "SELECT count(*) AS count FROM document_invitations WHERE scope = 'device' AND participant_id IS NOT NULL",
          )
          .get(),
      ).toEqual({ count: 2 });
      expect(sqlite.query("PRAGMA foreign_key_check").all()).toEqual([]);
    } finally {
      sqlite.close();
    }
  }
});
